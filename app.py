import feedparser
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup
import re
import datetime

app = Flask(__name__)

# Cache for parsed feed data
feed_cache = {
    "data": None,
    "last_fetched": None
}

def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def create_update_dict(date, update_type, elements, entry_link, index):
    content_html = "".join(str(el) for el in elements)
    text_content = " ".join(el.get_text() for el in elements if hasattr(el, 'get_text'))
    text_content = clean_text(text_content)
    
    update_id = f"{date.replace(' ', '_').replace(',', '')}_{index}"
    return {
        "id": update_id,
        "date": date,
        "type": update_type,
        "content_html": content_html,
        "text_content": text_content,
        "link": f"{entry_link}#{update_id}"
    }

def parse_entry_content(entry_html, date, entry_link):
    soup = BeautifulSoup(entry_html, 'html.parser')
    for a in soup.find_all('a'):
        a['target'] = '_blank'
        a['rel'] = 'noopener noreferrer'
    updates = []
    
    current_type = "Update"
    current_elements = []
    
    for child in soup.contents:
        if child.name == 'h3':
            if current_elements:
                updates.append(create_update_dict(date, current_type, current_elements, entry_link, len(updates)))
                current_elements = []
            current_type = child.get_text(strip=True)
        elif child.name:
            current_elements.append(child)
            
    if current_elements:
        updates.append(create_update_dict(date, current_type, current_elements, entry_link, len(updates)))
        
    return updates

def fetch_and_parse_feed():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    feed = feedparser.parse(url)
    
    all_updates = []
    for entry in feed.entries:
        date = entry.title
        entry_link = entry.link
        
        content_val = ""
        if entry.get('content'):
            content_val = entry.get('content')[0]['value']
        elif entry.get('summary'):
            content_val = entry.get('summary')
            
        if content_val:
            parsed_updates = parse_entry_content(content_val, date, entry_link)
            all_updates.extend(parsed_updates)
            
    return all_updates

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = datetime.datetime.now()
    
    # Check cache (cache for 5 minutes)
    if not force_refresh and feed_cache["data"] and feed_cache["last_fetched"]:
        elapsed = (now - feed_cache["last_fetched"]).total_seconds()
        if elapsed < 300: # 5 minutes
            return jsonify({
                "source": "cache",
                "last_fetched": feed_cache["last_fetched"].isoformat(),
                "updates": feed_cache["data"]
            })
            
    try:
        updates = fetch_and_parse_feed()
        feed_cache["data"] = updates
        feed_cache["last_fetched"] = now
        return jsonify({
            "source": "network",
            "last_fetched": now.isoformat(),
            "updates": updates
        })
    except Exception as e:
        if feed_cache["data"]:
            return jsonify({
                "source": "error_fallback_cache",
                "last_fetched": feed_cache["last_fetched"].isoformat(),
                "error": str(e),
                "updates": feed_cache["data"]
            })
        return jsonify({
            "error": str(e),
            "updates": []
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
