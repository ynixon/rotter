package com.ynixon.rotter;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.app.AppCompatDelegate;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class MainActivity extends AppCompatActivity {

    private static final long DISPLAY_MS = 5000;
    private static final long FADE_MS    = 500;
    private static final long SLIDE_MS   = 280;
    private static final long REFRESH_INTERVAL_MIN = 3;
    private static final int  SWIPE_VELOCITY_THRESHOLD = 300;
    private static final int  SWIPE_DISTANCE_THRESHOLD = 80;

    // direction constants
    private static final int DIR_INITIAL = 0;
    private static final int DIR_NEXT    = 1;   // slide left
    private static final int DIR_PREV    = -1;  // slide right
    private static final int DIR_AUTO    = 2;   // fade (auto-advance, no touch)

    private TextView tvTime;
    private TextView tvTitle;
    private TextView tvNewBadge;
    private TextView tvCounter;
    private TextView tvDescription;
    private Button btnLink;
    private Button btnRefresh;
    private ImageButton btnMiniRefresh;
    private ImageButton btnTheme;
    private ImageButton btnExpand;
    private View tickerCard;
    private boolean isExpanded = false;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable nextTick;
    private ScheduledExecutorService refreshScheduler;

    private List<NewsEntry> entries = new ArrayList<>();
    private int tickerIndex = 0;
    private boolean isRefreshing = false;
    private boolean isNightMode;
    private long lastSeenTimestamp;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SharedPreferences prefs = getPreferences(MODE_PRIVATE);
        isNightMode = prefs.getBoolean("night_mode", true);
        lastSeenTimestamp = prefs.getLong("last_seen_ts", 0);

        AppCompatDelegate.setDefaultNightMode(
            isNightMode ? AppCompatDelegate.MODE_NIGHT_YES : AppCompatDelegate.MODE_NIGHT_NO
        );

        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        tvTime        = findViewById(R.id.tv_time);
        tvTitle       = findViewById(R.id.tv_title);
        tvNewBadge    = findViewById(R.id.tv_new_badge);
        tvCounter     = findViewById(R.id.tv_counter);
        tvDescription = findViewById(R.id.tv_description);
        btnLink       = findViewById(R.id.btn_link);
        btnRefresh    = findViewById(R.id.btn_refresh);
        btnMiniRefresh= findViewById(R.id.btn_mini_refresh);
        btnTheme      = findViewById(R.id.btn_theme);
        btnExpand     = findViewById(R.id.btn_expand);
        tickerCard    = findViewById(R.id.ticker_card);

        tvTitle.setText(R.string.loading);
        tvNewBadge.setVisibility(View.GONE);
        btnLink.setVisibility(View.GONE);

        TextView tvFooter = findViewById(R.id.footer);
        tvFooter.setText(getString(R.string.footer) + " • v" + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")");

        btnRefresh.setOnClickListener(v -> triggerRefresh());
        btnMiniRefresh.setOnClickListener(v -> triggerRefresh());

        btnTheme.setOnClickListener(v -> {
            isNightMode = !isNightMode;
            getPreferences(MODE_PRIVATE).edit().putBoolean("night_mode", isNightMode).apply();
            AppCompatDelegate.setDefaultNightMode(
                isNightMode ? AppCompatDelegate.MODE_NIGHT_YES : AppCompatDelegate.MODE_NIGHT_NO
            );
        });

        btnLink.setOnClickListener(v -> {
            if (tickerIndex < entries.size()) {
                String url = entries.get(tickerIndex).getLink();
                if (url != null && !url.isEmpty()) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                }
            }
        });

        btnExpand.setOnClickListener(v -> {
            isExpanded = !isExpanded;
            btnExpand.animate().rotation(isExpanded ? 180f : 0f).setDuration(200).start();
            if (isExpanded && tickerIndex < entries.size()) {
                NewsEntry cur = entries.get(tickerIndex);
                // Show link button immediately if we have a URL
                String url = cur.getLink();
                btnLink.setVisibility(
                    (url != null && !url.isEmpty()) ? View.VISIBLE : View.GONE);
                // Show body: use cache if available, otherwise fetch asynchronously
                if (cur.isBodyFetched()) {
                    showBodyText(cur.getCachedBody());
                } else {
                    tvDescription.setText(R.string.loading_body);
                    tvDescription.setVisibility(View.VISIBLE);
                    fetchArticleBody(cur);
                }
            } else {
                tvDescription.setVisibility(View.GONE);
                btnLink.setVisibility(View.GONE);
            }
        });

        // Swipe gesture: left → next, right → previous
        GestureDetector gestureDetector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onSingleTapUp(MotionEvent e) {
                if (entries.isEmpty()) return false;
                cancelTick();
                if (e.getX() < tickerCard.getWidth() / 2f) {
                    // tap left half → previous
                    tickerIndex = (tickerIndex - 1 + entries.size()) % entries.size();
                    showEntry(DIR_PREV);
                } else {
                    // tap right half → next
                    tickerIndex = (tickerIndex + 1) % entries.size();
                    showEntry(DIR_NEXT);
                }
                return true;
            }

            @Override
            public boolean onFling(MotionEvent e1, MotionEvent e2, float velocityX, float velocityY) {
                if (entries.isEmpty()) return false;
                float distanceX = e2.getX() - e1.getX();
                if (Math.abs(distanceX) > SWIPE_DISTANCE_THRESHOLD
                        && Math.abs(velocityX) > SWIPE_VELOCITY_THRESHOLD) {
                    cancelTick();
                    if (velocityX < 0) {
                        tickerIndex = (tickerIndex + 1) % entries.size();
                        showEntry(DIR_NEXT);
                    } else {
                        tickerIndex = (tickerIndex - 1 + entries.size()) % entries.size();
                        showEntry(DIR_PREV);
                    }
                    return true;
                }
                return false;
            }
        });

        tickerCard.setOnTouchListener((v, event) -> {
            gestureDetector.onTouchEvent(event);
            return true;
        });

        fetchFeed(false);
        startAutoRefresh();
    }

    private void triggerRefresh() {
        if (!isRefreshing) fetchFeed(true);
    }

    private void fetchFeed(boolean showSpinner) {
        if (isRefreshing) return;
        isRefreshing = true;
        if (showSpinner) tvTitle.setText(R.string.loading);

        Executors.newSingleThreadExecutor().execute(() -> {
            List<NewsEntry> result = RssFetcher.fetch();
            handler.post(() -> {
                isRefreshing = false;
                if (result != null && !result.isEmpty()) {
                    onEntriesLoaded(result);
                } else if (entries.isEmpty()) {
                    tvTitle.setText(R.string.error_loading);
                    Toast.makeText(this, R.string.error_loading, Toast.LENGTH_SHORT).show();
                }
            });
        });
    }

    private void onEntriesLoaded(List<NewsEntry> loaded) {
        long maxTs = 0;
        for (NewsEntry e : loaded) {
            e.setIsNew(e.getTimestamp() > lastSeenTimestamp);
            if (e.getTimestamp() > maxTs) maxTs = e.getTimestamp();
        }

        loaded.sort((a, b) -> {
            if (a.isNew() != b.isNew()) return a.isNew() ? -1 : 1;
            return Long.compare(b.getTimestamp(), a.getTimestamp());
        });

        int newCount = 0;
        for (NewsEntry e : loaded) if (e.isNew()) newCount++;

        entries = loaded;
        tickerIndex = 0;

        if (maxTs > lastSeenTimestamp) {
            lastSeenTimestamp = maxTs;
            getPreferences(MODE_PRIVATE).edit().putLong("last_seen_ts", lastSeenTimestamp).apply();
        }

        if (newCount > 0) {
            Toast.makeText(this,
                newCount + " " + getString(R.string.new_headlines),
                Toast.LENGTH_SHORT).show();
        }

        cancelTick();
        showEntry(DIR_INITIAL);
    }

    /**
     * @param direction DIR_NEXT (slide left), DIR_PREV (slide right), DIR_INITIAL (fade in)
     */
    private void showEntry(int direction) {
        if (entries.isEmpty()) return;
        NewsEntry e = entries.get(tickerIndex);
        float screenWidth = getResources().getDisplayMetrics().widthPixels;

        if (direction == DIR_INITIAL) {
            // First load: simple fade in
            tickerCard.setAlpha(0f);
            applyContent(e);
            tickerCard.animate().alpha(1f).setDuration(FADE_MS)
                .withEndAction(this::scheduleNextTick).start();
            return;
        }

        if (direction == DIR_AUTO) {
            // Auto-advance (timer): fade out then fade in
            tickerCard.animate().alpha(0f).setDuration(FADE_MS)
                .withEndAction(() -> {
                    applyContent(e);
                    tickerCard.animate().alpha(1f).setDuration(FADE_MS)
                        .withEndAction(this::scheduleNextTick).start();
                }).start();
            return;
        }

        // Slide out current card, then slide in new card from opposite side
        float slideOutX = direction == DIR_NEXT ? -screenWidth : screenWidth;
        float slideInX  = direction == DIR_NEXT ?  screenWidth : -screenWidth;

        tickerCard.animate()
            .translationX(slideOutX)
            .setDuration(SLIDE_MS)
            .withEndAction(() -> {
                applyContent(e);
                tickerCard.setTranslationX(slideInX);
                tickerCard.animate()
                    .translationX(0f)
                    .setDuration(SLIDE_MS)
                    .withEndAction(this::scheduleNextTick)
                    .start();
            })
            .start();
    }

    private void applyContent(NewsEntry e) {
        tvTime.setText(e.getDate());
        tvTitle.setText(e.getTitle());
        tvCounter.setText((tickerIndex + 1) + " / " + entries.size());
        // Collapse on every new message; user must tap expand to see description/link
        isExpanded = false;
        btnExpand.setRotation(0f);
        tvDescription.setVisibility(View.GONE);
        btnLink.setVisibility(View.GONE);
        if (e.isNew()) {
            tvNewBadge.setVisibility(View.VISIBLE);
            e.setIsNew(false);
        } else {
            tvNewBadge.setVisibility(View.GONE);
        }
    }

    private void fetchArticleBody(NewsEntry entry) {
        Executors.newSingleThreadExecutor().execute(() -> {
            String body = ArticleFetcher.fetchBody(entry.getLink());
            entry.setCachedBody(body != null ? body : "");
            handler.post(() -> {
                // Only update UI if this entry is still the one being shown
                if (tickerIndex < entries.size() && entries.get(tickerIndex) == entry && isExpanded) {
                    showBodyText(entry.getCachedBody());
                }
            });
        });
    }

    private void showBodyText(String body) {
        if (body != null && !body.isEmpty()) {
            tvDescription.setText(body);
            tvDescription.setVisibility(View.VISIBLE);
        } else {
            tvDescription.setVisibility(View.GONE);
        }
    }

    private void scheduleNextTick() {
        nextTick = () -> {
            tickerIndex = (tickerIndex + 1) % entries.size();
            showEntry(DIR_AUTO);
        };
        handler.postDelayed(nextTick, DISPLAY_MS);
    }

    private void cancelTick() {
        if (nextTick != null) {
            handler.removeCallbacks(nextTick);
            nextTick = null;
        }
    }

    private void startAutoRefresh() {
        refreshScheduler = Executors.newSingleThreadScheduledExecutor();
        refreshScheduler.scheduleAtFixedRate(
            () -> handler.post(() -> fetchFeed(false)),
            REFRESH_INTERVAL_MIN, REFRESH_INTERVAL_MIN, TimeUnit.MINUTES
        );
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cancelTick();
        if (refreshScheduler != null) refreshScheduler.shutdownNow();
    }
}
