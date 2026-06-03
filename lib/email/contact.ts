import { ZEPTO_API } from "@/lib/email/zeptomail";

export type ContactPayload = {
  name: string;
  email: string;
  message: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactEmail(payload: ContactPayload): Promise<void> {
  const apiKey = process.env.ZEPTO_MAIL_API_KEY?.trim();
  const to = process.env.CONTACT_EMAIL_TO?.trim() || "jmcanboy@gmail.com";
  const from =
    process.env.CONTACT_EMAIL_FROM?.trim() || "noreply@spilltherent.com";

  if (!apiKey) {
    throw new Error(
      "Contact email is not configured. Set ZEPTO_MAIL_API_KEY on the server."
    );
  }

  const safeName = escapeHtml(payload.name);
  const safeEmail = escapeHtml(payload.email);
  const safeMessage = escapeHtml(payload.message).replace(/\n/g, "<br />");

  const res = await fetch(ZEPTO_API, {
    method: "POST",
    headers: {
      Authorization: `Zoho-enczapikey ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { address: from, name: "spillthe.rent" },
      to: [{ email_address: { address: to, name: "spillthe.rent" } }],
      reply_to: [{ address: payload.email, name: payload.name }],
      subject: `spillthe.rent contact — ${payload.name}`,
      htmlbody: `
        <p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `.trim(),
      textbody: `From: ${payload.name} <${payload.email}>\n\n${payload.message}`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      detail ? `Email provider error: ${detail.slice(0, 200)}` : `Email provider error (${res.status})`
    );
  }
}
