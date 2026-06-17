# BigQuery Release Pulse

A premium, highly interactive dashboard that parses the official Google Cloud BigQuery release notes and provides instant search, dynamic category filtering, and smart sharing to X (Twitter).

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have Python 3.8+ installed.

### 2. Install Dependencies
Install the required packages using pip:
```bash
pip install Flask requests feedparser beautifulsoup4
```

### 3. Run the Server
Start the Flask application:
```bash
python app.py
```

### 4. Access the App
Open your browser and navigate to:
**[http://127.0.0.1:5001](http://127.0.0.1:5001)**

---

## 🏗️ Technical Architecture

The application is structured into a lightweight backend proxy/parser and a rich, glassmorphic single-page frontend:

```
├── app.py                  # Flask Web Server & RSS Parser
├── templates/
│   └── index.html          # Semantic HTML Structure
└── static/
    ├── css/
    │   └── style.css       # Custom Responsive Styles (Midnight Dark Theme)
    └── js/
        └── app.js          # Client-Side Application Logic
```

### 1. Backend (Server Side) - `app.py`
*   **RSS Parser**: Uses `feedparser` to fetch raw XML data from Google's official BigQuery feeds.
*   **HTML Extractor**: Employs `BeautifulSoup` to split long date blocks into individual, structured update entries (e.g. separates features, issues, and announcements).
*   **Caching Strategy**: Implements an in-memory cache with a 5-minute TTL (Time-To-Live) to avoid overloading Google's servers. A manual force refresh query parameter (`?refresh=true`) allows users to bypass this cache.

### 2. Frontend (Client Side)
*   **Dynamic Filtering**: Instantly filters release notes by category pills (e.g. Feature, Issue, Announcement, Change, Deprecation) which are built dynamically from the feed payload.
*   **Real-time Search**: Filters timeline events instantly as you type matching titles, content, categories, or dates.
*   **Twitter Web Intent Integration**: Includes a mock Twitter editor modal with progress rings that counts URLs as exactly 23 characters (conforming to Twitter's link algorithm) and dynamically truncates text to fit within the 280-character limit.

---

## 🔌 API Endpoints

### Get Release Notes
Returns a list of parsed and cleaned release updates.

*   **URL**: `/api/release-notes`
*   **Method**: `GET`
*   **Query Parameters**: 
    *   `refresh` (optional): Set to `true` to force a network reload instead of serving cached data.
*   **Response Format**: `JSON`
*   **Example Response**:
    ```json
    {
      "source": "network",
      "last_fetched": "2026-06-17T17:15:30.123456",
      "updates": [
        {
          "id": "June_17_2026_0",
          "date": "June 17, 2026",
          "type": "Feature",
          "content_html": "<p>You can enable autonomous embedding generation...",
          "text_content": "You can enable autonomous embedding generation on new or existing tables...",
          "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_17_2026_0"
        }
      ]
    }
    ```

---

## 🎨 Design System
The UI utilizes a modern space-dark theme featuring:
*   **Backdrop Blur**: Semi-transparent, blur-filtered dialogs and controls.
*   **Dynamic Status Badges**: Visual indicators of feed health and update timings.
*   **Timeline Layout**: A vertical timeline layout with styled connectors.
*   **Tailored Badge Colors**: Green for features, red for issues, blue for announcements, and purple for changes.
