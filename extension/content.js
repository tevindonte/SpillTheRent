/**
 * Listing overlay v0.3 — StreetEasy, Zillow, Apartments.com
 * Load unpacked: chrome://extensions → Load unpacked → extension/
 */
(function () {
  const DEFAULT_API = "https://spillthe.rent";

  const SITE_PARSERS = [
    {
      origins: ["https://www.streeteasy.com", "https://streeteasy.com"],
      parse: parseStreetEasy,
    },
    {
      origins: ["https://www.zillow.com", "https://zillow.com"],
      parse: parseZillow,
    },
    {
      origins: ["https://www.apartments.com", "https://apartments.com"],
      parse: parseApartmentsCom,
    },
  ];

  function getApiBase() {
    return new Promise((resolve) => {
      if (!chrome?.storage?.sync) {
        resolve(DEFAULT_API);
        return;
      }
      chrome.storage.sync.get(["apiBase"], (r) => {
        resolve((r.apiBase || DEFAULT_API).replace(/\/$/, ""));
      });
    });
  }

  function parseStreetEasy() {
    const title =
      document.querySelector("h1")?.textContent?.trim() ||
      document.querySelector('[data-testid="listing-title"]')?.textContent?.trim() ||
      "";

    const addressEl =
      document.querySelector('[data-testid="listing-address"]') ||
      document.querySelector(".details .address") ||
      document.querySelector('[itemprop="streetAddress"]');

    let address = addressEl?.textContent?.trim() || "";

    if (!address) {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
      if (ogTitle && ogTitle.includes("|")) {
        address = ogTitle.split("|")[0].trim();
      }
    }

    if (!address && /\/building\//.test(location.pathname)) {
      const slug = location.pathname.split("/").pop() || "";
      address = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return { title, address: address || title };
  }

  function parseZillow() {
    const address =
      document.querySelector('[data-testid="bdp-building-address"]')?.textContent?.trim() ||
      document.querySelector("h1")?.textContent?.trim() ||
      document.querySelector('meta[property="og:title"]')?.content?.split("|")[0]?.trim() ||
      "";
    return { title: address, address };
  }

  function parseApartmentsCom() {
    const address =
      document.querySelector(".propertyAddressContainer h1")?.textContent?.trim() ||
      document.querySelector('[class*="propertyAddress"]')?.textContent?.trim() ||
      document.querySelector("h1")?.textContent?.trim() ||
      "";
    return { title: address, address };
  }

  function getParser() {
    return SITE_PARSERS.find((s) => s.origins.includes(location.origin));
  }

  async function lookup() {
    const parser = getParser();
    if (!parser) return;

    const { title, address } = parser.parse();
    if (!address || address.length < 5) return;

    const apiBase = await getApiBase();
    const res = await fetch(`${apiBase}/api/extension/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, title }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.building) return;

    injectBanner(data.building, apiBase);
  }

  function injectBanner(building, apiBase) {
    if (document.getElementById("spill-extension-banner")) return;

    const hpd = building.hpd_open_violations ?? 0;
    const score =
      building.spill_score != null
        ? ` · ${Number(building.spill_score).toFixed(1)}/5`
        : "";
    const el = document.createElement("div");
    el.id = "spill-extension-banner";
    el.className = "spill-ext-banner";
    const warn = hpd > 0;
    el.innerHTML = `
      <strong>spillthe.rent</strong>
      <span>${warn ? `⚠️ ${hpd} open HPD violation${hpd === 1 ? "" : "s"}${score}` : `Building intel on file${score}`}</span>
      <a href="${apiBase}/?building=${building.id}" target="_blank" rel="noopener">Open rap sheet →</a>
    `;
    document.body.prepend(el);
  }

  if (getParser()) {
    lookup().catch(() => {});
  }
})();
