# spillthe.rent Chrome extension (beta)

Shows a banner on **StreetEasy**, **Zillow**, and **Apartments.com** listing pages with HPD violation count and a link to the building rap sheet.

## Install locally (free, unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Visit a supported listing page

## Configure

Click the extension icon → set API base (default `https://spillthe.rent`, or `http://localhost:3000` for dev).

## Notes

- v0.3 uses `/api/extension/match` address/title match against Supabase.
- Chrome Web Store publish is a separate step (privacy policy, review).
