/**
 * StreetEasy listing overlay (v0.1 stub).
 * Load unpacked in Chrome → chrome://extensions → Developer mode → Load unpacked → /extension
 *
 * Set API base in popup if testing against localhost.
 */
(function () {
  const DEFAULT_API = "https://spillthe.rent";

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

  function parseAddress() {
    const h1 = document.querySelector("h1");
    const title = h1?.textContent?.trim() || "";
    const breadcrumb = document.querySelector("[data-testid='breadcrumb']");
    const text = breadcrumb?.textContent || document.body.innerText.slice(0, 2000);
    return { title, text };
  }

  async function lookup() {
    const { title, text } = parseAddress();
    if (!title && !text) return;

    const apiBase = await getApiBase();
    const q = encodeURIComponent(title || text.slice(0, 120));
    const res = await fetch(`${apiBase}/api/complexes/search?q=${q}&limit=1`);
    if (!res.ok) return;
    const data = await res.json();
    const hit = data.results?.[0];
    if (!hit) return;

    injectBanner(hit, apiBase);
  }

  function injectBanner(building, apiBase) {
    if (document.getElementById("spill-extension-banner")) return;

    const hpd = building.hpd_open_violations ?? 0;
    const el = document.createElement("div");
    el.id = "spill-extension-banner";
    el.className = "spill-ext-banner";
    const warn = hpd > 0;
    el.innerHTML = `
      <strong>spillthe.rent</strong>
      <span>${warn ? `⚠️ ${hpd} open HPD violation${hpd === 1 ? "" : "s"}` : "✓ See full building intel"}</span>
      <a href="${apiBase}/?building=${building.id}" target="_blank" rel="noopener">Open rap sheet →</a>
    `;
    document.body.prepend(el);
  }

  if (/streeteasy\.com/.test(location.hostname)) {
    lookup().catch(() => {});
  }
})();
