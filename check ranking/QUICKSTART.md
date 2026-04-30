# 🚀 Quick Start Guide

## Start the Application

```bash
cd "D:\ViberCode\check ranking"
npm start
```

The server will run on **http://localhost:5000**

## Open the Dashboard

Open the file `client/index.html` in your web browser:
- **Windows**: Double-click `client/index.html`
- **Or**: Open any browser and drag `client/index.html` into it
- **Or**: Right-click and select "Open with" → Your browser

## How to Use

### Step 1: Add a Website 🌐
1. Go to the **"Add Website"** tab
2. Enter your domain (e.g., `example.com`)
3. Optionally enter a site name
4. Click **"Add Website"**

### Step 2: Add Keywords 🔑
1. Click the **"Keywords"** tab
2. Enter a keyword you want to track (e.g., `seo tips`)
3. Click **"Add"**
4. Repeat for more keywords

### Step 3: Check Rankings 🔍
1. Click the **"Check Rankings"** button
2. ⏳ Wait 1-2 minutes (automatic delays prevent Google blocking)
3. System searches Google for each keyword
4. Records the position where your domain appears

### Step 4: View Results 📊
1. Go to the **"Rankings"** tab
2. See current rankings with:
   - 🥇 Top 10 keywords
   - 🥈 Top 50 keywords  
   - Not ranked keywords
3. Detailed table shows each keyword's position

## Example

```
Domain: example.com
Keywords:
  - "best seo tool" → Position #15
  - "rank checker" → Position #3
  - "google rankings" → Not ranked
```

## API Endpoints

Developers can also use the REST API directly:

```bash
# List all websites
curl http://localhost:5000/api/sites

# Add a website
curl -X POST http://localhost:5000/api/sites \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com","name":"My Site"}'

# Add keywords
curl -X POST http://localhost:5000/api/keywords \
  -H "Content-Type: application/json" \
  -d '{"siteId":1,"keyword":"my keyword"}'

# Check rankings
curl -X POST http://localhost:5000/api/refresh/1

# Get current rankings
curl http://localhost:5000/api/rankings/1
```

## Important Notes ⚠️

1. **Google Blocking**: After checking ~50-100 keywords, Google may temporarily block your IP
   - Wait 30 minutes and try again
   - Track fewer keywords per session

2. **Accuracy**: Rankings vary by:
   - Your location
   - Search history
   - Time of day
   - Google algorithm changes

3. **Database**: Data is stored in `db/rankings.db` (SQLite)
   - To reset: Delete the `.db` file and restart

## Troubleshooting

### Dashboard won't load
- Make sure server is running: `npm start`
- Check browser console for errors (F12)
- Try `http://localhost:5000/api/health`

### No results when checking rankings
- Try with a site that actually ranks (e.g., your real website)
- Check if Google is blocking your IP (wait 30 min)
- Try with fewer keywords

### Database errors
```bash
# Reset database
rm db/rankings.db
npm start  # Recreates fresh database
```

## Files Overview

```
check ranking/
├── server.js              ← Backend server
├── package.json          ← Dependencies
├── db/
│   ├── rankings.db       ← Database (auto-created)
│   ├── schema.js         ← Schema definition
│   └── rankings.js       ← Database queries
├── modules/
│   └── scraper.js        ← Google searcher
└── client/
    └── index.html        ← Dashboard (open in browser)
```

## Need Help?

Check the full README.md for detailed API documentation and advanced usage.

---

**Created with ❤️ for tracking keyword rankings**
