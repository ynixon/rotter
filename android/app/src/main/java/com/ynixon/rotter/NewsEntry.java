package com.ynixon.rotter;

public class NewsEntry {
    private final String title;
    private final String date;
    private final String link;
    private final long timestamp;
    private boolean isNew;

    public NewsEntry(String title, String date, String link, long timestamp) {
        this.title = title;
        this.date = date;
        this.link = link;
        this.timestamp = timestamp;
    }

    public String getTitle()    { return title; }
    public String getDate()     { return date; }
    public String getLink()     { return link; }
    public long   getTimestamp(){ return timestamp; }
    public boolean isNew()      { return isNew; }
    public void setIsNew(boolean isNew) { this.isNew = isNew; }
}
