"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth/otp-errors";

type Step = "email" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
      },
    });
    setLoading(false);
    if (otpError) {
      setError(
        formatAuthError(otpError.message, (otpError as { status?: number }).status)
      );
      return;
    }
    setMessage("Check your email for a 6-digit code.");
    setStep("otp");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });
    setLoading(false);
    if (verifyError) {
      setError(
        formatAuthError(
          verifyError.message,
          (verifyError as { status?: number }).status
        )
      );
      return;
    }
    if (data.user) {
      await fetch("/api/auth/ensure-profile", { method: "POST" });
    }
    router.push("/profile");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4 pt-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center text-lg font-semibold text-orange-500">
          SpillTheRent
        </Link>
        <h1 className="mt-8 text-center font-serif text-2xl text-neutral-50">
          {step === "email" ? "Sign in" : "Enter your code"}
        </h1>
        <p className="mt-2 text-center text-sm text-neutral-500">
          {step === "email"
            ? "We'll email you a one-time passcode."
            : `Code sent to ${email}`}
        </p>

        {step === "email" ? (
          <form onSubmit={sendCode} className="mt-8 space-y-4">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 outline-none focus:border-orange-500/50"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-8 space-y-4">
            {message && (
              <p className="text-center text-sm text-emerald-400">{message}</p>
            )}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-center text-lg tracking-[0.4em] text-neutral-100 outline-none focus:border-orange-500/50"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400 disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full text-sm text-neutral-500 hover:text-neutral-300"
            >
              ← Use a different email
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-neutral-600">
          <Link href="/" className="text-orange-500 hover:underline">
            Back to map
          </Link>
        </p>
      </div>
    </div>
  );
}
