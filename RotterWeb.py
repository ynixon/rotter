from flask import Flask, render_template, jsonify
import feedparser
import html
from datetime import datetime, timedelta

# Function to format date
def format_time(date_str):
    try:
        parsed_date = datetime.strptime(date_str, "%a, %d %b %Y %H:%M:%S %z").replace(tzinfo=None)
        return parsed_date.strftime("%H:%M")
    except Exception as e:
        print(f"Error: {e}")
        return "Error parsing date"

app = Flask(__name__)
app.static_folder = 'static'

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/getFeed')
def get_feed():
    try:
        feed = feedparser.parse('https://www.rotter.net/rss/rotternews.xml')
        if feed.status != 200:
            return jsonify({'error': 'Failed to fetch the feed'})

        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        
        entries = []
        for entry in feed.entries:
            entry_datetime = datetime.strptime(entry.published, "%a, %d %b %Y %H:%M:%S %z").replace(tzinfo=None)
            if entry_datetime > one_hour_ago:
                entries.append({'date': format_time(entry.published), 'title': html.unescape(entry.title)})

        # Create a JSON response with UTF-8 encoding
        response = jsonify({'entries': entries})
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return response
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=True)
