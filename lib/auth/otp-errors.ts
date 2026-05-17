/** Map Supabase Auth errors to user-facing copy. */
export function formatAuthError(message: string, status?: number): string {
  const lower = message.toLowerCase();

  if (
    status === 500 ||
    lower.includes("error sending") ||
    lower.includes("smtp") ||
    lower.includes("mail")
  ) {
    return (
      "Could not send the login code. In Supabase Dashboard → Authentication → SMTP, " +
      "configure ZeptoMail (smtp.zeptomail.com, port 587, user: emailapikey) and enable Email OTP."
    );
  }

  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }

  if (lower.includes("invalid") && lower.includes("otp")) {
    return "Invalid or expired code. Request a new one.";
  }

  return message;
}
