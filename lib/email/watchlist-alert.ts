import { ZEPTO_API } from "@/lib/email/zeptomail";

export type WatchlistAlertEmail = {
  to: string;
  userName: string;
  buildingName: string;
  buildingUrl: string;
  events: { title: string; summary: string | null }[];
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendWatchlistAlertEmail(
  payload: WatchlistAlertEmail
): Promise<void> {
  const apiKey = process.env.ZEPTO_MAIL_API_KEY?.trim();
  const from =
    process.env.CONTACT_EMAIL_FROM?.trim() || "noreply@spilltherent.com";

  if (!apiKey) {
    throw new Error("ZEPTO_MAIL_API_KEY is not configured");
  }

  const items = payload.events
    .map(
      (e) =>
        `<li><strong>${escapeHtml(e.title)}</strong>${e.summary ? `: ${escapeHtml(e.summary)}` : ""}</li>`
    )
    .join("");

  const html = `
    <p>Hi ${escapeHtml(payload.userName)},</p>
    <p>New activity on a building on your spillthe.rent watchlist:</p>
    <p><strong>${escapeHtml(payload.buildingName)}</strong></p>
    <ul>${items}</ul>
    <p><a href="${escapeHtml(payload.buildingUrl)}">View building on spillthe.rent</a></p>
    <p style="color:#737373;font-size:12px">You saved this building to your watchlist. More alert options coming soon.</p>
  `.trim();

  const text = [
    `Hi ${payload.userName},`,
    "",
    `New activity on ${payload.buildingName}:`,
    ...payload.events.map(
      (e) => `- ${e.title}${e.summary ? `: ${e.summary}` : ""}`
    ),
    "",
    payload.buildingUrl,
  ].join("\n");

  const res = await fetch(ZEPTO_API, {
    method: "POST",
    headers: {
      Authorization: `Zoho-enczapikey ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { address: from, name: "spillthe.rent" },
      to: [{ email_address: { address: payload.to, name: payload.userName } }],
      subject: `Watchlist: ${payload.buildingName} · new activity`,
      htmlbody: html,
      textbody: text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      detail
        ? `Email provider error: ${detail.slice(0, 200)}`
        : `Email provider error (${res.status})`
    );
  }
}
