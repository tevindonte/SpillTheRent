"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

export function Navbar() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setHandle(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("handle")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setHandle(data?.handle ?? null));
  }, [user]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-[2000] flex h-12 items-center justify-between border-b border-neutral-800/80 bg-[#0a0a0a]/90 px-4 backdrop-blur-md">
      <Link href="/" className="text-sm font-semibold tracking-tight text-orange-500">
        spillthe.rent
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        <Link
          href="/leaderboard"
          className="hidden text-neutral-400 hover:text-neutral-200 sm:inline"
        >
          Leaderboard
        </Link>
        <Link
          href="/faq"
          className="hidden text-neutral-400 hover:text-neutral-200 md:inline"
        >
          FAQ
        </Link>
        <Link
          href="/about"
          className="text-neutral-400 hover:text-neutral-200"
        >
          About
        </Link>
        <Link
          href="/calculator"
          className="hidden text-neutral-400 hover:text-neutral-200 lg:inline"
        >
          The Receipt
        </Link>
        {loading ? (
          <span className="text-neutral-600">…</span>
        ) : user ? (
          <>
            {handle && (
              <span className="hidden text-neutral-500 sm:inline">@{handle}</span>
            )}
            <Link
              href="/profile"
              className="text-neutral-300 hover:text-neutral-100"
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="text-neutral-500 hover:text-neutral-300"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-neutral-200 hover:border-orange-500/50 hover:text-orange-400"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
