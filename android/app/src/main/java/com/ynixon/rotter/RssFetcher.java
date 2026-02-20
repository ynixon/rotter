package com.ynixon.rotter;

import android.text.Html;
import android.util.Xml;

import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserException;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class RssFetcher {

    private static final String RSS_URL = "https://www.rotter.net/rss/rotternews.xml";

    // RSS pub date: "Sun, 01 Jan 2023 12:00:00 +0200" — day can be 1 or 2 digits
    private static final SimpleDateFormat[] DATE_FORMATS = {
        new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss Z", Locale.ENGLISH),
        new SimpleDateFormat("EEE, d MMM yyyy HH:mm:ss Z",  Locale.ENGLISH)
    };
    private static final SimpleDateFormat TIME_FMT =
        new SimpleDateFormat("HH:mm", Locale.ENGLISH);

    public static List<NewsEntry> fetch() {
        try {
            URL url = new URL(RSS_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(10_000);
            conn.setRequestProperty("User-Agent", "RotterNews-Android/1.0");
            if (conn.getResponseCode() == 200) {
                try (InputStream is = conn.getInputStream()) {
                    return parse(is);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    private static List<NewsEntry> parse(InputStream is)
            throws XmlPullParserException, IOException {

        List<NewsEntry> result = new ArrayList<>();
        long threeHoursAgo = System.currentTimeMillis() - 3 * 60 * 60 * 1000L;

        XmlPullParser xpp = Xml.newPullParser();
        xpp.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false);
        xpp.setInput(is, "UTF-8");

        String title = null, pubDate = null, link = null;
        boolean inItem = false;
        String currentTag = null;

        int event = xpp.getEventType();
        while (event != XmlPullParser.END_DOCUMENT) {
            switch (event) {
                case XmlPullParser.START_TAG:
                    currentTag = xpp.getName();
                    if ("item".equals(currentTag)) {
                        inItem = true;
                        title = null; pubDate = null; link = null;
                    }
                    break;

                case XmlPullParser.TEXT:
                    if (inItem && currentTag != null) {
                        String text = xpp.getText().trim();
                        switch (currentTag) {
                            case "title":   title   = text; break;
                            case "pubDate": pubDate = text; break;
                            case "link":    link    = text; break;
                        }
                    }
                    break;

                case XmlPullParser.END_TAG:
                    if ("item".equals(xpp.getName()) && inItem) {
                        inItem = false;
                        NewsEntry entry = buildEntry(title, pubDate, link, threeHoursAgo);
                        if (entry != null) result.add(entry);
                    }
                    currentTag = null;
                    break;
            }
            event = xpp.next();
        }

        result.sort((a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp()));
        return result;
    }

    private static NewsEntry buildEntry(String title, String pubDate, String link,
                                        long threeHoursAgo) {
        if (title == null || pubDate == null) return null;

        Date date = tryParseDate(pubDate);
        if (date == null || date.getTime() < threeHoursAgo) return null;

        String cleanTitle = Html.fromHtml(title, Html.FROM_HTML_MODE_LEGACY).toString().trim();
        String timeStr    = TIME_FMT.format(date);
        long   timestamp  = date.getTime() / 1000L;

        return new NewsEntry(cleanTitle, timeStr, link, timestamp);
    }

    private static Date tryParseDate(String raw) {
        for (SimpleDateFormat fmt : DATE_FORMATS) {
            try {
                return fmt.parse(raw);
            } catch (ParseException ignored) { }
        }
        return null;
    }
}
