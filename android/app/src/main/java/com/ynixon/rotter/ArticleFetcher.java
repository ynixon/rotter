package com.ynixon.rotter;

import android.text.Html;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;

/**
 * Fetches an article page from rotter.net and extracts the main post body text.
 * The RSS <description> is always empty, so we scrape on demand.
 */
public class ArticleFetcher {

    /** Returns clean plain text of the article body, or null on failure. */
    public static String fetchBody(String articleUrl) {
        if (articleUrl == null || articleUrl.isEmpty()) return null;
        try {
            URL url = new URL(articleUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(8_000);
            conn.setReadTimeout(10_000);
            conn.setRequestProperty("User-Agent", "RotterNews-Android/1.0");
            conn.setRequestProperty("Accept-Charset", "windows-1255");

            if (conn.getResponseCode() != 200) return null;

            StringBuilder sb = new StringBuilder();
            try (InputStream is = conn.getInputStream();
                 BufferedReader br = new BufferedReader(
                         new InputStreamReader(is, Charset.forName("windows-1255")))) {
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line).append('\n');
                }
            }
            return extractBody(sb.toString());
        } catch (Exception e) {
            return null;
        }
    }

    private static String extractBody(String html) {
        // Remove <script>…</script> and <style>…</style> blocks first
        String clean = html
                .replaceAll("(?si)<script[^>]*>.*?</script>", " ")
                .replaceAll("(?si)<style[^>]*>.*?</style>", " ");

        // Strategy 1: rotter.net wraps the scoop body in a specific div/td.
        // Try several candidate selectors, most-specific first.
        String[] startMarkers = {
            "id=\"scoopBody\"",
            "id=\"scoop_body\"",
            "class=\"scoopBody\"",
            "class=\"scoop_body\"",
            "class=\"newsbody\"",
            "class=\"post_body\"",
            "class=\"postbody\"",
            "class=\"prow1 valmiddle\"",
            "class=\"prow1\"",
        };
        for (String marker : startMarkers) {
            String body = extractBetweenTag(clean, marker);
            if (body != null) {
                String text = stripTags(body);
                if (text.length() > 20) return text;
            }
        }

        // Strategy 2: largest <p> block in the page
        String largest = largestParagraph(clean);
        if (largest != null && largest.length() > 20) return largest;

        return null;
    }

    /** Given a marker string (e.g. id="foo"), find the enclosing tag and return its inner HTML. */
    private static String extractBetweenTag(String html, String marker) {
        int markerIdx = html.indexOf(marker);
        if (markerIdx < 0) return null;

        // Walk back to the opening '<'
        int tagStart = html.lastIndexOf('<', markerIdx);
        if (tagStart < 0) return null;

        // Find the closing '>' of the opening tag
        int tagEnd = html.indexOf('>', markerIdx);
        if (tagEnd < 0) return null;

        // Determine the tag name so we can find the matching closing tag
        String tagContent = html.substring(tagStart + 1, tagEnd);
        String tagName = tagContent.split("\\s+")[0].toLowerCase();
        if (tagName.isEmpty()) return null;

        // Find end of content: search for </tagName>
        int contentStart = tagEnd + 1;
        int contentEnd   = html.toLowerCase().indexOf("</" + tagName + ">", contentStart);
        if (contentEnd < 0) return null;

        return html.substring(contentStart, contentEnd);
    }

    /** Strip all HTML tags and decode entities, normalise whitespace. */
    private static String stripTags(String html) {
        // Replace block-level tags with newlines so text reads naturally
        String s = html.replaceAll("(?i)<br\\s*/?>", "\n")
                       .replaceAll("(?i)</(p|div|li|tr|td|h[1-6])>", "\n")
                       .replaceAll("<[^>]+>", "");
        // Decode HTML entities
        s = Html.fromHtml(s, Html.FROM_HTML_MODE_LEGACY).toString();
        // Collapse runs of blank lines to a single newline, trim
        s = s.replaceAll("[ \\t]+", " ")
             .replaceAll("\\n{3,}", "\n\n")
             .trim();
        return s;
    }

    /** Fallback: return the content of the longest <p>…</p> block. */
    private static String largestParagraph(String html) {
        String lower   = html.toLowerCase();
        String best    = null;
        int    bestLen = 0;
        int    idx     = 0;
        while (true) {
            int pStart = lower.indexOf("<p", idx);
            if (pStart < 0) break;
            int pContent = lower.indexOf('>', pStart);
            if (pContent < 0) break;
            int pEnd = lower.indexOf("</p>", pContent);
            if (pEnd < 0) break;
            String inner = stripTags(html.substring(pContent + 1, pEnd));
            if (inner.length() > bestLen) { best = inner; bestLen = inner.length(); }
            idx = pEnd + 4;
        }
        return best;
    }
}
