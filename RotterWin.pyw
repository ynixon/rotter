import tkinter as tk
from tkinter import font
import feedparser
import threading
import webbrowser
from datetime import datetime

# RSS feed URL for Rotter News
FEED_URL = 'https://www.rotter.net/rss/rotternews.xml'
REFRESH_INTERVAL = 60  # seconds
TICKER_SPEED = 20  # pixels per second

class RotterTicker(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Rotter News Ticker')
        screen_width = self.winfo_screenwidth()
        self.geometry(f"{screen_width}x60+0+0")
        self.overrideredirect(True)
        self.attributes('-topmost', True)
        self.configure(bg='#222')
        self.protocol('WM_DELETE_WINDOW', self.on_close)

        # Font setup
        self.ticker_font = font.Font(family='Segoe UI', size=18, weight='bold')
        self.ticker_fg = '#fff'
        self.ticker_bg = '#222'
        self.button_bg = '#444'
        self.button_fg = '#fff'
        self.button_active_bg = '#0F80FF'

        # Frame for buttons
        self.button_frame = tk.Frame(self, bg=self.ticker_bg)
        self.button_frame.pack(side=tk.RIGHT, padx=5)
        # Close button
        self.close_btn = tk.Button(self.button_frame, text="✕", bg=self.button_bg, fg=self.button_fg,
                                  width=3, height=1, font=('Arial', 12, 'bold'),
                                  activebackground=self.button_active_bg, relief=tk.FLAT, command=self.on_close)
        self.close_btn.pack(side=tk.RIGHT, padx=3)
        self.create_tooltip(self.close_btn, "Close Ticker")
        # Refresh button
        self.refresh_btn = tk.Button(self.button_frame, text="↻", bg=self.button_bg, fg=self.button_fg,
                                    width=3, height=1, font=('Arial', 12, 'bold'),
                                    activebackground=self.button_active_bg, relief=tk.FLAT, command=self.on_refresh)
        self.refresh_btn.pack(side=tk.RIGHT, padx=3)
        self.create_tooltip(self.refresh_btn, "Refresh News")
        # Link button
        self.link_btn = tk.Button(self.button_frame, text="🔗", bg=self.button_bg, fg=self.button_fg,
                                 width=3, height=1, font=('Arial', 12, 'bold'),
                                 activebackground=self.button_active_bg, relief=tk.FLAT, command=self.open_link)
        self.link_btn.pack(side=tk.RIGHT, padx=3)
        self.create_tooltip(self.link_btn, "Open Current News Link")

        # Canvas for ticker
        self.canvas = tk.Canvas(self, height=60, bg=self.ticker_bg, highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True, side=tk.LEFT)

        # State
        self.headlines = []
        self.current_index = 0
        self.next_index = 0
        self.is_running = True
        self.current_text_id = None
        self.next_text_id = None
        self.current_link = None

        # Start fetching and ticker
        self.after(100, self.fetch_feed)
        self.after(200, self.animate_ticker)

    def create_tooltip(self, widget, text):
        def enter(event):
            x = widget.winfo_rootx() + 30
            y = widget.winfo_rooty() + 30
            self.tooltip = tk.Toplevel(widget)
            self.tooltip.wm_overrideredirect(True)
            self.tooltip.wm_geometry(f"+{x}+{y}")
            label = tk.Label(self.tooltip, text=text, justify='left',
                             background="#ffffe0", relief="solid", borderwidth=1,
                             font=("Arial", 10, "normal"))
            label.pack(ipadx=4, ipady=2)
        def leave(event):
            if hasattr(self, "tooltip"):
                self.tooltip.destroy()
        widget.bind("<Enter>", enter)
        widget.bind("<Leave>", leave)

    def fetch_feed(self):
        def _fetch():
            try:
                feed = feedparser.parse(FEED_URL)
                entries = []
                for entry in feed.entries:
                    title = entry.title
                    date = entry.published if 'published' in entry else ''
                    link = entry.link if 'link' in entry else None
                    try:
                        dt = datetime.strptime(date, "%a, %d %b %Y %H:%M:%S %z")
                        time_str = dt.strftime('%H:%M')
                    except Exception:
                        time_str = ''
                    timestamp = int(dt.timestamp()) if date else 0
                    entries.append({'title': title, 'time': time_str, 'timestamp': timestamp, 'link': link})
                entries.sort(key=lambda x: x['timestamp'], reverse=True)
                self.headlines = entries[:10]
            except Exception as e:
                self.headlines = [{'title': f'שגיאה בטעינת חדשות: {e}', 'time': '', 'timestamp': 0, 'link': None}]
            finally:
                if self.is_running:
                    self.after(REFRESH_INTERVAL * 1000, self.fetch_feed)
        threading.Thread(target=_fetch, daemon=True).start()

    def on_refresh(self):
        self.fetch_feed()

    def open_link(self):
        if self.headlines and self.current_index < len(self.headlines):
            headline = self.headlines[self.current_index]
            link = headline.get('link')
            if link:
                webbrowser.open(link)
            else:
                webbrowser.open('https://www.rotter.net')

    def animate_ticker(self):
        if not self.headlines:
            self.after(500, self.animate_ticker)
            return
        # Prepare a single string with all headlines separated by ' | '
        gap = ' | '
        headlines_text = gap.join([
            f"[{h['time']}] {h['title']}" for h in self.headlines
        ])
        self.canvas.delete('all')
        screen_width = self.winfo_width() - self.button_frame.winfo_width() - 10
        text_id = self.canvas.create_text(-10, 30, anchor='w', text=headlines_text, font=self.ticker_font, fill=self.ticker_fg)
        text_bbox = self.canvas.bbox(text_id)
        text_width = text_bbox[2] - text_bbox[0] if text_bbox else 400
        x = -text_width
        def move():
            nonlocal x
            if not self.is_running:
                return
            x += 4  # Move right, slower than before
            self.canvas.coords(text_id, x, 30)
            if x < screen_width:
                self.after(int(1000 / TICKER_SPEED), move)
            else:
                self.after(50, self.animate_ticker)
        move()

    def on_close(self):
        self.is_running = False
        self.destroy()

if __name__ == '__main__': 
    app = RotterTicker()
    app.mainloop()
