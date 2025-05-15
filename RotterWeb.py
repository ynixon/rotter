from flask import Flask, render_template, jsonify
import feedparser
import html
import re
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

        # Extend time window to get more entries (3 hours instead of 1)
        three_hours_ago = datetime.now() - timedelta(hours=3)
        
        entries = []
        for entry in feed.entries:
            entry_datetime = datetime.strptime(entry.published, "%a, %d %b %Y %H:%M:%S %z").replace(tzinfo=None)
            if entry_datetime > three_hours_ago:
                # Extract media content if available
                media_content = None
                media_type = None
                
                # Check for enclosures (common for images and media in RSS)
                if hasattr(entry, 'enclosures') and entry.enclosures:
                    for enclosure in entry.enclosures:
                        if 'url' in enclosure and 'type' in enclosure:
                            media_content = enclosure['url']
                            media_type = enclosure['type']
                            break
                
                # Check for media content in the description if no enclosures
                if not media_content and hasattr(entry, 'description'):
                    # Look for image tags
                    img_match = re.search(r'<img[^>]+src="([^">]+)"', entry.description)
                    if img_match:
                        media_content = img_match.group(1)
                        media_type = 'image'
                    # Look for video tags or iframes (often used for embedded videos)
                    else:
                        video_match = re.search(r'<(iframe|video)[^>]+src="([^">]+)"', entry.description)
                        if video_match:
                            media_content = video_match.group(2)
                            media_type = 'video'
                  # Create entry data
                entry_data = {
                    'date': format_time(entry.published), 
                    'title': html.unescape(entry.title),
                    'timestamp': int(entry_datetime.timestamp()),  # Store as integer for consistency
                }
                
                # Add description if available
                if hasattr(entry, 'description'):
                    entry_data['description'] = html.unescape(entry.description)
                
                # Add media content if found
                if media_content:
                    entry_data['media_url'] = media_content
                    entry_data['media_type'] = media_type
                
                # Add link to the full article
                if hasattr(entry, 'link'):
                    entry_data['link'] = entry.link
                    
                entries.append(entry_data)
          # Sort entries by timestamp in descending order (newest first)
        entries.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
        
        # Keep the timestamp field as it's needed for client-side filtering
        # (Don't remove the timestamp field anymore)

        # Create a JSON response with UTF-8 encoding
        response = jsonify({'entries': entries})
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return response
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=True)
