# Publish spillthe.rent extension to the Chrome Web Store

The extension code is in this folder (`manifest.json` v0.3). Publishing is done in Google’s dashboard — not automatic from GitHub.

## Prerequisites

1. **Google Chrome Web Store developer account** — [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) — **$5 one-time** registration fee.
2. **Privacy policy URL** — host on your site, e.g. `https://spillthe.rent/privacy` (create a simple page if you don’t have one).
3. **Screenshots** — at least one 1280×800 or 640×400 image of the banner on a listing page.

## Package the extension

1. Zip the contents of `extension/` (not the parent folder):
   - `manifest.json`, `content.js`, `content.css`, `popup.html`, `popup.js`
2. Do **not** include `README.md` or `CHROME_WEB_STORE.md` in the zip.

## Listing copy (starter)

- **Name:** spillthe.rent — NYC Building Intel  
- **Summary:** HPD violations and tenant intel on StreetEasy, Zillow, and Apartments.com.  
- **Description:** Before you tour, see open HPD violations and community scores from spillthe.rent. Opens the full building rap sheet on spillthe.rent.  
- **Category:** Productivity or Lifestyle  
- **Single purpose:** Show building safety/rent intel on rental listing sites.

## Permissions justification (for review)

| Permission | Why |
|------------|-----|
| `storage` | Remember optional custom API base URL |
| Host permissions (listing sites + spillthe.rent) | Inject banner and call match API |

## Submit

1. Developer Dashboard → **New item** → upload zip  
2. Fill privacy, screenshots, permissions justification  
3. Submit for review (often a few days to 2 weeks)

## After approval

Users install from the store. Keep `content.js` DOM selectors updated when StreetEasy/Zillow change layouts.

## Dev / staging

Unpacked load still works: `chrome://extensions` → Developer mode → Load unpacked → this folder. Set API base to `http://localhost:3000` when testing locally.
