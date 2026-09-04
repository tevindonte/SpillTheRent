"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authConfirmUrl } from "@/lib/auth/site-url";
import { formatAuthError } from "@/lib/auth/otp-errors";

type Step = "email" | "otp";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error");

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: authConfirmUrl("/profile"),
      },
    });
    setLoading(false);
    if (otpError) {
      setError(
        formatAuthError(otpError.message, (otpError as { status?: number }).status)
      );
      return;
    }
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
          spillthe.rent
        </Link>
        <h1 className="mt-8 text-center font-serif text-2xl text-neutral-50">
          {step === "email" ? "Sign in with email" : "Choose how to sign in"}
        </h1>
        <p className="mt-2 text-center text-sm text-neutral-500">
          {step === "email"
            ? "We'll email you a magic link and a 6-digit code. Use whichever you prefer."
            : `We sent both to ${email}`}
        </p>

        {(linkError || error) && step === "email" && (
          <p className="mt-4 text-center text-sm text-red-400">{linkError ?? error}</p>
        )}

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
              {loading ? "Sending…" : "Send sign-in email"}
            </button>
          </form>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-orange-400">
                Option 1 · Magic link
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                Open the email on this device and tap{" "}
                <span className="font-medium text-neutral-100">Sign in</span>. You&apos;ll
                be logged in automatically, no code needed.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-neutral-800" />
              <span className="text-xs text-neutral-600">or</span>
              <div className="h-px flex-1 bg-neutral-800" />
            </div>

            <form onSubmit={verifyCode} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-orange-400">
                Option 2 · 6-digit code
              </p>
              <p className="mt-2 text-sm text-neutral-400">
                Type the code from the same email.
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="mt-3 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-center text-lg tracking-[0.4em] text-neutral-100 outline-none focus:border-orange-500/50"
              />
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="mt-3 w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400 disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Continue with code"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError(null);
              }}
              className="w-full text-sm text-neutral-500 hover:text-neutral-300"
            >
              ← Use a different email
            </button>
          </div>
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-sm text-neutral-500">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
