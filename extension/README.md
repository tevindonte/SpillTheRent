# spillthe.rent Chrome extension (beta)

Shows a banner on StreetEasy listing pages with HPD violation count and a link to the building rap sheet.

## Install locally (free, unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Visit a StreetEasy listing page

## Configure

Click the extension icon → set API base (default `https://spillthe.rent`, or `http://localhost:3000` for dev).

## Notes

- v0.1 uses `/api/complexes/search` title match — address parsing will improve in later versions.
- Chrome Web Store publish is a separate step (privacy policy, review).
