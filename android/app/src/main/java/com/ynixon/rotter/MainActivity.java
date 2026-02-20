package com.ynixon.rotter;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
    private static final long FADE_MS = 600;
    private static final long REFRESH_INTERVAL_MIN = 3;

    private TextView tvTime;
    private TextView tvTitle;
    private TextView tvNewBadge;
    private Button btnLink;
    private Button btnRefresh;
    private ImageButton btnMiniRefresh;
    private ImageButton btnTheme;
    private View tickerCard;

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
        btnLink       = findViewById(R.id.btn_link);
        btnRefresh    = findViewById(R.id.btn_refresh);
        btnMiniRefresh= findViewById(R.id.btn_mini_refresh);
        btnTheme      = findViewById(R.id.btn_theme);
        tickerCard    = findViewById(R.id.ticker_card);

        tvTitle.setText(R.string.loading);
        tvNewBadge.setVisibility(View.GONE);
        btnLink.setVisibility(View.GONE);

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

        // new items first, then by descending timestamp
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
        showEntry();
    }

    private void showEntry() {
        if (entries.isEmpty()) return;
        NewsEntry e = entries.get(tickerIndex);

        // fade out → update content → fade in → schedule next
        tickerCard.animate().alpha(0f).setDuration(FADE_MS).withEndAction(() -> {
            tvTime.setText(e.getDate());
            tvTitle.setText(e.getTitle());

            if (e.getLink() != null && !e.getLink().isEmpty()) {
                btnLink.setVisibility(View.VISIBLE);
            } else {
                btnLink.setVisibility(View.GONE);
            }

            if (e.isNew()) {
                tvNewBadge.setVisibility(View.VISIBLE);
                e.setIsNew(false);
            } else {
                tvNewBadge.setVisibility(View.GONE);
            }

            tickerCard.animate().alpha(1f).setDuration(FADE_MS).start();

            nextTick = () -> {
                tickerIndex = (tickerIndex + 1) % entries.size();
                showEntry();
            };
            handler.postDelayed(nextTick, DISPLAY_MS);
        }).start();
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
