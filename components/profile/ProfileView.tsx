"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ProfileViewProps = {
  onGoToMap: () => void;
};

type AuthMode = "signin" | "signup";

export function ProfileView({ onGoToMap }: ProfileViewProps) {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: displayName.trim() || email.split("@")[0],
            },
          },
        });
        if (signUpError) throw signUpError;
        setMessage("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        setMessage(null);
        onGoToMap();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setEmail("");
    setPassword("");
    setDisplayName("");
    setMessage(null);
    setError(null);
  }

  const displayNameFromMeta =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Tenant";

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950">
      <header className="shrink-0 border-b border-neutral-800 px-5 pb-4 pt-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-50">
          Profile
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Save your ratings and rent reports across devices.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {loading && (
          <p className="text-center text-sm text-neutral-500">Loading…</p>
        )}

        {!loading && user && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-lg font-semibold text-neutral-100">
                {displayNameFromMeta.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-100">
                  {displayNameFromMeta}
                </p>
                <p className="truncate text-sm text-neutral-500">{user.email}</p>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Your contributions
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                Reviews and rent reports you submit are tied to this account.
                Rate buildings from the map to help other renters.
              </p>
              <button
                type="button"
                onClick={onGoToMap}
                className="mt-4 w-full rounded-lg bg-neutral-100 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-white"
              >
                Open map →
              </button>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-lg border border-neutral-700 py-2.5 text-sm font-medium text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
            >
              Sign out
            </button>
          </div>
        )}

        {!loading && !user && (
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-6 flex rounded-lg bg-neutral-900 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setMessage(null);
                }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  mode === "signin"
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setMessage(null);
                }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  mode === "signup"
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}
              {message && (
                <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-neutral-100 py-3 text-sm font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
              >
                {submitting
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-neutral-600">
              Browse the map without an account. Sign up to track your submissions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
