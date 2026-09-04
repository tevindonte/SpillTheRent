# Production launch: Stripe, QA, MVT

Focused checklist for the three items you deferred. Work top to bottom.

---

## 1. Stripe (Lease Shield + watchlist premium)

**What it does:** $9.99 one-time → `profiles.watchlist_premium_until` +90 days → unlimited watchlist + premium-only email alerts (cron).

**Code paths (already built):**

| Step | Endpoint / UI |
|------|----------------|
| Checkout | `POST /api/stripe/checkout` (signed in) |
| Webhook | `POST /api/stripe/webhook` (`checkout.session.completed`) |
| UI | Profile → Lease Shield card |
| Limit | Free users: 3 saves (`FREE_WATCHLIST_LIMIT`) |
| Alerts | `GET /api/cron/watchlist-alerts` (premium emails only) |

### A. Stripe Dashboard (test mode first)

1. [dashboard.stripe.com](https://dashboard.stripe.com) → **Developers → API keys**
   - Copy **Secret key** (`sk_test_...` for test).
2. **Developers → Webhooks → Add endpoint**
   - URL: `https://spillthe.rent/api/stripe/webhook`
   - Events: **`checkout.session.completed`** only
   - Copy **Signing secret** (`whsec_...`).
3. For local webhook testing (optional): `stripe listen --forward-to localhost:3000/api/stripe/webhook`

### B. Render env vars (Web Service → Environment)

| Variable | Value |
|----------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_...` then `sk_live_...` at go-live |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from the endpoint above |
| `NEXT_PUBLIC_SITE_URL` | `https://spillthe.rent` (checkout success/cancel URLs) |

Redeploy after saving.

### C. Supabase

- Migration `20260609000001_watchlist_premium.sql` applied (`watchlist_premium_until` on `profiles`).
- Table `saved_buildings` exists (from growth migration).

### D. Lease Shield test (test mode)

1. Sign in at `https://spillthe.rent/login`.
2. Profile → **Upgrade watchlist** → Stripe Checkout.
3. Card: `4242 4242 4242 4242`, any future expiry, any CVC.
4. After redirect: Profile shows **Lease Shield active**.
5. **Supabase → Table Editor → profiles** → your row → `watchlist_premium_until` ~90 days ahead.
6. Save **4+** buildings on watchlist (building panel / compare); should not 403.
7. **Stripe → Webhooks** → endpoint → recent deliveries → `200` on `checkout.session.completed`.

**If checkout says “Payments are not configured”:** `STRIPE_SECRET_KEY` missing on Render.

**If paid but not premium:** webhook secret wrong, or webhook URL not `https://spillthe.rent/api/stripe/webhook`; check Render logs.

### E. Watchlist email cron (premium alerts)

| Where | Variable |
|-------|----------|
| Render | `CRON_SECRET` (random long string) |
| GitHub Actions secrets | Same `CRON_SECRET`, optional `SITE_URL=https://spillthe.rent` |

Manual test:

```bash
curl -sS -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://spillthe.rent/api/cron/watchlist-alerts"
```

Expect JSON with `ok` / counts (not 401/503).

### F. Go live on Stripe

- Swap `sk_test_` / test `whsec_` for **live** keys and a **live** webhook endpoint (same URL).
- Consider Stripe **tax** and **business** settings before marketing paid upgrade.

---

## 2. Full production QA

Use **production** (`https://spillthe.rent`) after each deploy. Hard-refresh (Ctrl+Shift+R).

### Map

- [ ] Default NYC view loads dots within ~30s (per-tile; “Loading map…” clears).
- [ ] Pan to Hudson Yards, LIC, Bed-Stuy: dots appear, not permanent empty blocks.
- [ ] Zoom to 14+: individual markers / rent pills where data exists.
- [ ] Click building → panel opens; HPD / reviews load.
- [ ] Filters (stabilized, HPD, Google rating) reduce markers correctly.

### Auth

- [ ] Magic link / OAuth login completes; lands on map or profile.
- [ ] Logout works; protected routes redirect to `/login`.
- [ ] Profile loads handle, reviews, rentals tabs.

### Submit content (signed in)

- [ ] **Rate building** from map panel → review saves, appears on building.
- [ ] **Report rent** → saves.
- [ ] **Add building** (+ on map) → creates or links existing.

### Compare

- [ ] Add 2–3 buildings to compare → drawer opens.
- [ ] URL `?compare=id1,id2` restores drawer on load.
- [ ] Share link opens compare for recipient.

### Watchlist + Lease Shield

- [ ] Free account: 4th save shows upgrade message.
- [ ] After test purchase: unlimited saves; profile shows active.
- [ ] (Optional) Cron run sends email if you have watchlist + premium + alert-worthy change.

### DHCR (if using)

- [ ] `/tools/rent-history` upload PDF → row in profile DHCR section.
- [ ] Migration `080` + `100` applied.

### Extension (Chrome)

Extension ID: `bddecdkjeggppempopcmkagelgbodhon`

- [ ] Load unpacked from `extension/` (or store build); dev mode OK until published.
- [ ] **StreetEasy** listing page → banner with HPD count + link to spillthe.rent.
- [ ] **Zillow** rental listing → same.
- [ ] **Apartments.com** listing → same.
- [ ] Non-listing pages → no banner (no errors in extension console).
- [ ] Click through opens correct building (or honest “no match”).
- [ ] Store: privacy URL `https://spillthe.rent/privacy` loads.

Details: `extension/CHROME_WEB_STORE.md`

### SEO / misc

- [ ] `/about`, `/faq`, `/privacy`, `/leaderboard` load.
- [ ] `/building/[id]` deep link from extension works.

---

## 3. MVT on map (later; not required now)

Classic **per-tile markers** are the production map. MVT is optional perf for zoom &lt; 14.

### Prerequisites

1. Run in Supabase SQL (order):
   - `20260611000001_complexes_mvt.sql`
   - `20260612000001_fix_complexes_mvt_srid.sql` (fixes empty tiles)
2. Verify tile returns **non-zero** bytes:

```bash
curl -sS -o /dev/null -w "%{http_code} bytes:%{size_download}\n" \
  "https://spillthe.rent/api/complexes/mvt/12/1205/1539"
```

Expect `200` and `bytes:` **&gt; 0** (Manhattan sample tile).

### Re-enable on client (when ready)

Only after bytes &gt; 0 in prod:

- Restore `MapMvtLayer` at zoom &lt; 14 in `MapView.tsx`.
- Keep per-tile markers at zoom ≥ 14 (do **not** use single geojson batch for city view; 1k row cap).

Until then, ignore MVT migrations for map UX.

---

## Quick reference: env vars on Render

| Variable | Required for |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | App |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App |
| `SUPABASE_SERVICE_ROLE_KEY` | API admin, webhooks, cron |
| `NEXT_PUBLIC_SITE_URL` | Auth links, Stripe redirects |
| `NEXT_PUBLIC_CARTO_API_KEY` | Map basemap (no “API KEY REQUIRED” watermark) |
| `STRIPE_SECRET_KEY` | Lease Shield |
| `STRIPE_WEBHOOK_SECRET` | Premium after payment |
| `CRON_SECRET` | Watchlist alert cron |

### CARTO basemap key (do this if the map shows carto.com watermarks)

1. Request a free key: [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/) (~5M tiles/month).
2. Render → Environment → add `NEXT_PUBLIC_CARTO_API_KEY` = that key.
3. Redeploy (must rebuild; `NEXT_PUBLIC_*` is baked in at build time).

---

## Suggested order this week

1. **Map:** confirm `c65af26` on prod (you).
2. **Stripe test mode:** keys + webhook + one test purchase (30 min).
3. **QA checklist:** auth, submit, compare, extension (1–2 hrs).
4. **Chrome:** publish when review passes.
5. **MVT:** only if you want faster city-zoom; verify SQL + tile bytes first.
