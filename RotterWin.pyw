import tkinter as tk
import feedparser
import html
from datetime import datetime, timedelta


def refresh_feed():
    global current_item, news_items
    current_item = 0
    news_items = fetch_news()
    show_next_headline()


def format_time(date_str):
    try:
        parsed_date = datetime.strptime(date_str, "%a, %d %b %Y %H:%M:%S %z")
        return parsed_date.strftime("%H:%M")
    except Exception as e:
        print(f"Error: {e}")
        return "Error parsing date"


def fetch_news():
    feed = feedparser.parse('https://www.rotter.net/rss/rotternews.xml')
    if feed.status != 200:
        print("Failed to fetch the feed")
        return []

    first_entry_datetime = datetime.strptime(feed.entries[0].published, "%a, %d %b %Y %H:%M:%S %z")
    one_hour_ago = datetime.now(first_entry_datetime.tzinfo) - timedelta(hours=1)

    entries = [f"{html.unescape(entry.title)} ({format_time(entry.published)})" for entry in feed.entries if datetime.strptime(entry.published, "%a, %d %b %Y %H:%M:%S %z") > one_hour_ago]
    
    return entries


def show_next_headline():
    global current_item, news_items

    # Update to next headline
    canvas.itemconfig(news_text, text=news_items[current_item])
    
    # Center and right-align the text
    text_width = canvas.bbox(news_text)[2] - canvas.bbox(news_text)[0]
    canvas.coords(news_text, (screen_width + text_width) / 2, 30)

    current_item += 1

    # If reached end, fetch news again and reset current item
    if current_item >= len(news_items):
        news_items = fetch_news()
        current_item = 0

    root.after(5000, show_next_headline)  # Schedule next headline in 5 seconds


root = tk.Tk()
root.title("Always On Top News Banner")
screen_width = root.winfo_screenwidth()
root.geometry(f"{screen_width}x60+0+0")
root.attributes("-topmost", True)

canvas = tk.Canvas(root, bg="black", height=60, width=screen_width)
canvas.pack(fill=tk.BOTH, expand=1)

news_items = fetch_news()
current_item = 0
news_text = canvas.create_text(screen_width/2, 30, text=news_items[current_item] if news_items else "No recent news", fill="white", font=("Arial", 20), anchor="e")

show_next_headline()  # Start showing headlines

refresh_button = tk.Button(root, text="Refresh Feed", command=refresh_feed, bg="black", fg="white", font=("Arial", 12))
canvas.create_window(screen_width - 50, 30, anchor="e", window=refresh_button)

root.mainloop()
