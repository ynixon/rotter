from flask import Flask, render_template, jsonify, request
import feedparser
import html
import re
import os
import requests as _requests
import urllib.parse as _urlparse
from datetime import datetime, timedelta

_ARTICLE_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'he,en;q=0.9',
    'Referer': 'https://www.rotter.net/',
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
    """Extract main article body text from rotter.net HTML."""
    # Strip script/style blocks
    clean = re.sub(r'(?si)<script[^>]*>.*?</script>', ' ', html_text)
    clean = re.sub(r'(?si)<style[^>]*>.*?</style>', ' ', clean)

    # Known named containers (show_item.asp pages)
    markers = [
        'id="scoopBody"', 'id="scoop_body"', 'id="newsContent"',
        'id="articleBody"', 'id="article_body"', 'id="maintext"',
        'class="scoopBody"', 'class="scoop_body"',
        'class="newsbody"', 'class="news_body"', 'class="post_body"',
        'class="postbody"', 'class="prow1 valmiddle"', 'class="prow1"',
        'class="td_content"', 'class="article_content"',
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

    # Fallback: scan every <p> and <td> block, pick the longest one that
    # contains Hebrew text. Rotter .shtml pages use a table-based layout so
    # the article body is the biggest Hebrew-bearing <td>.
    _HEB = re.compile(r'[\u05d0-\u05ea]')
    best, best_len = None, 0
    for tag in ('p', 'td'):
        for m in re.finditer(rf'(?si)<{tag}[^>]*>(.*?)</{tag}>', clean):
            text = _strip_tags(m.group(1))
            if len(text) > best_len and _HEB.search(text):
                best, best_len = text, len(text)
    return best if best and best_len > 50 else None



def _strip_tags(raw):
    """Strip HTML tags, decode entities, normalise whitespace."""
    s = re.sub(r'(?i)<br\s*/?>', '\n', raw)
    s = re.sub(r'(?i)</(p|div|li|tr|td|h[1-6])>', '\n', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


def _decode_response(content):
    """Try common Hebrew encodings and return the first that works."""
    for enc in ('windows-1255', 'utf-8', 'iso-8859-8'):
        try:
            return content.decode(enc)
        except (UnicodeDecodeError, LookupError):
            pass
    return content.decode('utf-8', errors='replace')


def _resolve_rotter_url(url):
    """Convert show_item.asp?id=XXXXX → XXXXX.shtml (the canonical article URL).

    Rotter RSS links use the show_item.asp redirect which only works inside a
    real browser (Cloudflare JS challenge). The permanent, fetchable URL is the
    numeric .shtml page in the same folder.
    """
    m = re.search(r'show_item\.asp\?id=(\d+)', url)
    if m:
        article_id = m.group(1)
        base = re.match(r'(https?://[^/]+(?:/[^?]+/)?)show_item\.asp', url)
        folder = base.group(1) if base else 'https://www.rotter.net/forum/scoops1/'
        return folder + article_id + '.shtml'
    return url


@app.route('/getArticle')
def get_article():
    url = request.args.get('url', '').strip()
    if not url or not url.startswith('http'):
        return jsonify({'error': 'Invalid URL'}), 400

    # Rotter RSS links use show_item.asp?id=XXXXX which only resolves inside a
    # real browser (Cloudflare JS redirect). Convert to the real .shtml URL.
    url = _resolve_rotter_url(url)

    # Strategy 1: allorigins CORS proxy — most reliable from Render; rotter
    # .shtml pages are served without JS challenges through this proxy.
    try:
        proxy_url = 'https://api.allorigins.win/raw?url=' + _urlparse.quote(url, safe='')
        resp = _requests.get(proxy_url, timeout=15)
        resp.raise_for_status()
        body = _extract_article_body(_decode_response(resp.content))
        if body:
            return jsonify({'body': body})
    except Exception:
        pass

    # Strategy 2: Jina Reader API — clean markdown extraction, handles JS.
    # Short timeout because it frequently times out from this server.
    try:
        resp = _requests.get(
            'https://r.jina.ai/' + url,
            headers={'Accept': 'text/plain', 'X-No-Cache': 'true'},
            timeout=10,
        )
        resp.raise_for_status()
        text = resp.text.strip()
        # Jina prepends metadata (Title / URL Source / ...) then "---"
        parts = re.split(r'\n-{3,}\n', text, maxsplit=1)
        content = parts[-1].strip() if len(parts) > 1 else text
        content = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', content)
        if len(content) > 20:
            return jsonify({'body': content})
    except Exception:
        pass

    # Strategy 3: direct fetch (blocked by Cloudflare on most articles)
    try:
        resp = _requests.get(url, headers=_ARTICLE_HEADERS, timeout=8, allow_redirects=True)
        resp.raise_for_status()
        body = _extract_article_body(_decode_response(resp.content))
        if body:
            return jsonify({'body': body})
    except Exception:
        pass

    return jsonify({'body': ''})


@app.route('/debugArticle')
def debug_article():
    """Diagnostic endpoint — visit /debugArticle?url=<article_url> to see what each strategy returns."""
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({'error': 'pass ?url=<article_url>'}), 400
    resolved = _resolve_rotter_url(url)
    out = {'original_url': url, 'resolved_url': resolved}
    url = resolved

    # Jina
    try:
        resp = _requests.get('https://r.jina.ai/' + url,
                             headers={'Accept': 'text/plain', 'X-No-Cache': 'true'}, timeout=20)
        out['jina_status'] = resp.status_code
        out['jina_len'] = len(resp.text)
        out['jina_preview'] = resp.text[:600]
    except Exception as e:
        out['jina_error'] = str(e)

    # Direct
    try:
        resp = _requests.get(url, headers=_ARTICLE_HEADERS, timeout=10, allow_redirects=True)
        out['direct_status'] = resp.status_code
        out['direct_len'] = len(resp.content)
        raw = _decode_response(resp.content)
        out['direct_has_scoopBody'] = 'scoopBody' in raw
        out['direct_preview'] = raw[:400]
    except Exception as e:
        out['direct_error'] = str(e)

    # allorigins
    try:
        resp = _requests.get('https://api.allorigins.win/raw?url=' + _urlparse.quote(url, safe=''), timeout=15)
        out['allorigins_status'] = resp.status_code
        out['allorigins_len'] = len(resp.content)
        raw = _decode_response(resp.content)
        out['allorigins_has_scoopBody'] = 'scoopBody' in raw
        # Show a slice from the body area (skip HTML headers/CSS)
        body_start = raw.find('<BODY') if '<BODY' in raw else raw.find('<body')
        if body_start < 0:
            body_start = 0
        out['allorigins_body_preview'] = raw[body_start:body_start + 1500]
        # Run the extractor and report result
        extracted = _extract_article_body(raw)
        out['allorigins_extracted_len'] = len(extracted) if extracted else 0
        out['allorigins_extracted_preview'] = extracted[:400] if extracted else None
    except Exception as e:
        out['allorigins_error'] = str(e)

    return jsonify(out)


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
