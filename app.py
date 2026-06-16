import os
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import re
import hashlib
import datetime
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# In-memory cache for parsed release notes
CACHE = {
    'data': None,
    'last_updated': None
}

FEED_URL = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml'

def clean_plain_text(html_content):
    """Converts HTML content to clean plain text suitable for a Tweet."""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Extract plain text
    text = soup.get_text()
    
    # Normalize whitespaces and replace newlines/tabs with single space
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_feed():
    """Fetches the Atom feed and segments each entry into individual updates."""
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching feed: {e}")
        return None, f"Failed to fetch feed: {str(e)}"

    try:
        root = ET.fromstring(response.content)
    except Exception as e:
        print(f"Error parsing XML: {e}")
        return None, f"Failed to parse XML: {str(e)}"

    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    parsed_entries = []

    for entry in root.findall('atom:entry', ns):
        title_elem = entry.find('atom:title', ns)
        date_str = title_elem.text if title_elem is not None else 'Unknown Date'
        
        updated_elem = entry.find('atom:updated', ns)
        updated_str = updated_elem.text if updated_elem is not None else ''
        
        id_elem = entry.find('atom:id', ns)
        entry_id = id_elem.text if id_elem is not None else ''
        
        link_elem = entry.find('atom:link', ns)
        link = link_elem.attrib.get('href', '') if link_elem is not None else ''
        
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ''
        
        # Segment HTML content by <h3> headers
        soup = BeautifulSoup(content_html, 'html.parser')
        current_type = 'Feature'
        current_content = []
        item_index = 0

        # Iterate over all child nodes to segment by h3 tags
        for child in soup.contents:
            if child.name == 'h3':
                # Save previous segment if it exists
                if current_content:
                    html_snippet = ''.join(str(c) for c in current_content).strip()
                    if html_snippet:
                        plain_text = clean_plain_text(html_snippet)
                        unique_id = hashlib.md5(f"{entry_id}_{item_index}".encode('utf-8')).hexdigest()
                        
                        parsed_entries.append({
                            'id': unique_id,
                            'date': date_str,
                            'raw_date': updated_str,
                            'link': link,
                            'type': current_type,
                            'content': html_snippet,
                            'plain_text': plain_text
                        })
                        item_index += 1
                    current_content = []
                current_type = child.get_text().strip()
            else:
                # Include tags and strings
                current_content.append(child)

        # Append the final segment
        if current_content:
            html_snippet = ''.join(str(c) for c in current_content).strip()
            if html_snippet:
                plain_text = clean_plain_text(html_snippet)
                unique_id = hashlib.md5(f"{entry_id}_{item_index}".encode('utf-8')).hexdigest()
                parsed_entries.append({
                    'id': unique_id,
                    'date': date_str,
                    'raw_date': updated_str,
                    'link': link,
                    'type': current_type,
                    'content': html_snippet,
                    'plain_text': plain_text
                })

    # Sort parsed entries by raw_date descending
    parsed_entries.sort(key=lambda x: x.get('raw_date', ''), reverse=True)
    return parsed_entries, None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', '0') == '1'
    
    if force_refresh or CACHE['data'] is None:
        data, err = parse_feed()
        if err:
            if CACHE['data'] is not None:
                # Fallback to cache if feed fetch fails
                return jsonify({
                    'status': 'warning',
                    'message': f"Refresh failed, using cached data. Error: {err}",
                    'data': CACHE['data'],
                    'last_updated': CACHE['last_updated']
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': err
                }), 500
        CACHE['data'] = data
        CACHE['last_updated'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    return jsonify({
        'status': 'success',
        'data': CACHE['data'],
        'last_updated': CACHE['last_updated']
    })

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
