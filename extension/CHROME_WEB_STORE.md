# Chrome Web Store listing — copy/paste guide

Extension ID: `bddecdkjeggppempopcmkagelgbodhon` (from your dashboard)

## Privacy tab (required before publish)

| Field | URL |
|-------|-----|
| Privacy policy | `https://spillthe.rent/privacy` |

Deploy `main` first so that URL is live.

## Store listing → Product details

**Title** (from package — keep):  
`spillthe.rent — NYC Building Intel`

**Summary** (from package — keep or use):  
`See HPD violations and tenant reviews on StreetEasy, Zillow, and Apartments.com before you tour.`

**Description** (paste this):

```
spillthe.rent helps NYC renters research a building before they sign a lease.

When you're browsing rentals on StreetEasy, Zillow, or Apartments.com, this extension shows a small banner with:
• Open HPD violation count for the matched building
• Community score when available
• One click to open the full building "rap sheet" on spillthe.rent

On spillthe.rent you can read tenant reviews, see rent reports, compare buildings, and check official NYC data (violations, bedbugs, and more). No landlord ads — built for renters.

How it works
1. Open a listing on a supported site.
2. The extension reads the listing address/title on that page only.
3. It asks spillthe.rent to match that address to our building database.
4. If we have data, you see warnings and a link to research further.

What we don't do
• We don't access sites other than the three listing domains and spillthe.rent.
• We don't collect passwords or payment info from listing sites.
• We don't change listing prices or contact landlords for you.

Optional: click the extension icon to point at a custom API URL (for developers testing locally).

Questions or feedback: https://spillthe.rent/about
Privacy: https://spillthe.rent/privacy
```

**Category:** Household (or Productivity — either is fine)

**Language:** English

## URLs

| Field | Value |
|-------|--------|
| Official URL / Homepage | `https://spillthe.rent` |
| Support URL | `https://spillthe.rent/about` |

Register `spillthe.rent` in Google Search Console if you want "official" site verification.

## Graphic assets (you must create)

| Asset | Size | Tip |
|-------|------|-----|
| **Store icon** | 128×128 PNG | Orange "S" or map pin on dark background; no tiny text |
| **Screenshot** (required) | 1280×800 or 640×400 | Use `extension/chrome-store-screenshot-1280x800.png` (or capture a real listing) |
| Small promo tile | 440×280 | Optional |
| Marquee | 1400×560 | Optional |

Screenshot how-to: install extension unpacked → open any StreetEasy rental URL → capture full browser window showing the banner.

## Package tab

Zip only: `manifest.json`, `content.js`, `content.css`, `popup.html`, `popup.js`  
Version in manifest should match upload (currently `0.3.0`).

## Distribution / Access

- **Visibility:** Public (when ready)
- **Mature content:** No (unless you add adult themes later)

## Single purpose (if asked)

"Display NYC building safety and tenant-review information on rental listing pages by matching the listing address to spillthe.rent."

## Permissions justification (review)

- **storage** — Save optional custom API base URL in extension settings.
- **Host access (listing sites)** — Read address/title on the open listing page to match a building.
- **Host access (spillthe.rent)** — Call the public match API and open the rap sheet.

## Test instructions (for reviewers)

```
1. Install the extension.
2. Go to https://www.streeteasy.com/building/ (any Manhattan rental listing).
3. A spillthe.rent banner should appear at the top with HPD info or "Building intel on file".
4. Click "Open rap sheet →" — should open https://spillthe.rent/?building=...
```

Provide a sample StreetEasy URL if you have a building with data in your DB.

## After submit

Review often takes a few days to 2 weeks. Bump `version` in `manifest.json` for each update upload.
