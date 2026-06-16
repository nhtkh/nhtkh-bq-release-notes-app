# BigQuery Release Notes Dashboard & X/Twitter Publisher

A modern, fast, and feature-rich single-page dashboard built with **Python Flask** and **Vanilla HTML5, CSS3, and JavaScript**. It fetches the official Google Cloud BigQuery release notes Atom feed, segments individual updates by date/category, and offers fuzzy search, filtering, and a custom Tweet composer to share updates on X/Twitter.

---

## ✨ Features

- **🔄 Atom Feed Integration**: Fetches release notes directly from the official Google Cloud Atom feed with automatic server-side, in-memory caching.
- **✂️ Update Segmentation**: Parses the day-grouped feed entries using `BeautifulSoup4` and breaks them down into distinct updates (e.g., separating Features, Issues, or Deprecations released on the same day).
- **🔍 Instant Fuzzy Search**: Real-time keyword filtering across all content, categories, and dates with character matching.
- **🏷️ Category Filtering**: Filter chips to isolate updates by type (Features, Issues, Changed, Deprecated) with dynamic counts updating instantly.
- **🐦 Single & Batch Tweet Composer**:
  - Click any card to select it.
  - Generates pre-formatted tweets including the date, type, plain-text summary, and official documentation permalink.
  - Interactive modal with a custom SVG character counter progress ring tracking Twitter's 280-character limit (warns and blocks submission on overflow).
  - Select multiple cards to compile a bulleted batch-update summary.
- **🔗 Link Sharing**: One-click quick action to copy documentation permalinks straight to the clipboard.
- **📱 Responsive Glassmorphic UI**: High-fidelity dark mode with clean typography, dynamic card scale transitions, and custom scrollbars.

---

## 📂 Project Directory Structure

```text
bq-release-notes/
├── templates/
│   └── index.html          # Core dashboard HTML structure and Tweet composer modal
├── static/
│   ├── css/
│   │   └── styles.css      # Custom stylesheet (Glassmorphic dark theme, animations)
│   └── js/
│       └── app.js          # Client-side state manager, timeline renderer, and Tweet compiler
├── app.py                  # Python Flask server (Feed fetcher, HTML segmenter, caching)
├── .gitignore              # Standard git ignore definitions
└── README.md               # Project documentation
```

---

## 🛠️ Technology Stack

- **Backend**: Python 3, Flask, Requests, BeautifulSoup4
- **Frontend**: Vanilla HTML5, CSS3 (Flexbox/Grid/Transitions), JavaScript (ES6+)
- **APIs & Protocols**: XML/Atom parsing, Twitter Web Intent (`https://twitter.com/intent/tweet`)

---

## 🚀 Installation & Local Development

### 1. Prerequisites
Ensure you have Python 3 installed. You will need `flask`, `requests`, and `beautifulsoup4`.

### 2. Install Dependencies
If you have a standard Python environment, install the requirements via pip:
```bash
pip install flask requests beautifulsoup4
```

*Note: If you are using the Anaconda distribution, these packages are likely already installed.*

### 3. Start the Server
Run the Flask application from the project root:
```bash
python app.py
```

The server will spin up in debug mode and listen on:
👉 **[http://127.0.0.1:5000/](http://127.0.0.1:5000/)**

---

## ⚙️ How Request-Response Cycles Work

1. **Page Load**: Opening `/` returns the static HTML template. The client JS instantly calls `/api/release-notes` to populate the timeline.
2. **Caching**: To keep responses sub-millisecond, the server returns a cached JSON list of release notes.
3. **Manual Refresh**: Clicking **Refresh Notes** sends a query param `/api/release-notes?refresh=1`. The Flask server bypasses its cache, fetches the raw Atom XML feed directly from Google Cloud's servers, parses/segments the notes, saves them to the cache, and returns the fresh updates to the browser.
4. **Tweet Generation**: Selecting updates and clicking **Tweet** opens a modal pre-filled with formatted text. Clicking **Post to Twitter** opens Twitter Web Intent in a new tab with the URL-encoded text ready to publish.
