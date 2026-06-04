/**
 * StreetEasy listing overlay v0.2
 * Load unpacked: chrome://extensions → Load unpacked → extension/
 */
(function () {
  const DEFAULT_API = "https://spillthe.rent";
  const ALLOWED_ORIGINS = ["https://www.streeteasy.com", "https://streeteasy.com"];

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

  function parseListing() {
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

  async function lookup() {
    const { title, address } = parseListing();
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

  if (ALLOWED_ORIGINS.some((o) => location.origin === o)) {
    lookup().catch(() => {});
  }
})();
