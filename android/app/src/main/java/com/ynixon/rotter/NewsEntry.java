package com.ynixon.rotter;

public class NewsEntry {
    private final String title;
    private final String date;
    private final String link;
    private final String description;
    private final long timestamp;
    private boolean isNew;
    // Populated lazily by ArticleFetcher (RSS <description> is always empty on rotter.net)
    private String cachedBody = null;

    public NewsEntry(String title, String date, String link, String description, long timestamp) {
        this.title = title;
        this.date = date;
        this.link = link;
        this.description = description;
        this.timestamp = timestamp;
    }

    public String getTitle()       { return title; }
    public String getDate()        { return date; }
    public String getLink()        { return link; }
    public String getDescription() { return description; }
    public long   getTimestamp()   { return timestamp; }
    public boolean isNew()         { return isNew; }
    public void setIsNew(boolean isNew) { this.isNew = isNew; }

    /** null = not yet fetched; "" = fetched but empty; otherwise the article body. */
    public String getCachedBody()              { return cachedBody; }
    public void   setCachedBody(String body)   { this.cachedBody = body; }
    public boolean isBodyFetched()             { return cachedBody != null; }
}
