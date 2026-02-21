from flask import Flask, render_template, jsonify, request
import feedparser
import html
import re
import os
import requests as _requests
from datetime import datetime, timedelta

_ARTICLE_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'he,en;q=0.9',
}

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

def _extract_article_body(html_text):
    """Extract main article body text from rotter.net HTML (mirrors ArticleFetcher.java logic)."""
    # Strip script/style blocks
    clean = re.sub(r'(?si)<script[^>]*>.*?</script>', ' ', html_text)
    clean = re.sub(r'(?si)<style[^>]*>.*?</style>', ' ', clean)

    markers = [
        'id="scoopBody"', 'id="scoop_body"',
        'class="scoopBody"', 'class="scoop_body"',
        'class="newsbody"', 'class="post_body"',
        'class="postbody"', 'class="prow1 valmiddle"', 'class="prow1"',
    ]
    for marker in markers:
        idx = clean.find(marker)
        if idx < 0:
            continue
        tag_start = clean.rfind('<', 0, idx)
        if tag_start < 0:
            continue
        tag_end = clean.find('>', idx)
        if tag_end < 0:
            continue
        tag_name = re.split(r'\s+', clean[tag_start + 1:tag_end])[0].lower()
        if not tag_name:
            continue
        content_start = tag_end + 1
        content_end = clean.lower().find(f'</{tag_name}>', content_start)
        if content_end < 0:
            continue
        text = _strip_tags(clean[content_start:content_end])
        if len(text) > 20:
            return text

    # Fallback: largest <p> block
    best, best_len = None, 0
    for m in re.finditer(r'(?si)<p[^>]*>(.*?)</p>', clean):
        text = _strip_tags(m.group(1))
        if len(text) > best_len:
            best, best_len = text, len(text)
    return best if best and best_len > 20 else None


def _strip_tags(raw):
    """Strip HTML tags, decode entities, normalise whitespace."""
    s = re.sub(r'(?i)<br\s*/?>', '\n', raw)
    s = re.sub(r'(?i)</(p|div|li|tr|td|h[1-6])>', '\n', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


@app.route('/getArticle')
def get_article():
    url = request.args.get('url', '').strip()
    if not url or not url.startswith('http'):
        return jsonify({'error': 'Invalid URL'}), 400
    try:
        resp = _requests.get(url, headers=_ARTICLE_HEADERS, timeout=12, allow_redirects=True)
        resp.raise_for_status()
        raw = resp.content.decode('windows-1255', errors='replace')
        body = _extract_article_body(raw)
        return jsonify({'body': body or ''})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/getFeed')
def get_feed():
    try:
        hours_back = int(request.args.get('hours', 4))
        if hours_back not in (1, 2, 4, 8, 16):
            hours_back = 4

        feed = feedparser.parse('https://www.rotter.net/rss/rotternews.xml')
        if feed.status != 200:
            return jsonify({'error': 'Failed to fetch the feed'})

        cutoff = datetime.now() - timedelta(hours=hours_back)
        
        entries = []
        for entry in feed.entries:
            entry_datetime = datetime.strptime(entry.published, "%a, %d %b %Y %H:%M:%S %z").replace(tzinfo=None)
            if entry_datetime > cutoff:
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
                
                # Add description + plain-text body if available
                if hasattr(entry, 'description'):
                    entry_data['description'] = html.unescape(entry.description)
                    body_text = _strip_tags(entry.description)
                    if len(body_text) > 20:
                        entry_data['body'] = body_text
                
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
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port, debug=False)
