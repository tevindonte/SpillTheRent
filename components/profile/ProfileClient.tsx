"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/profile";
import { RED_FLAG_OPTIONS } from "@/lib/submissions/constants";
import { DhcrSubmissionsCard } from "./DhcrSubmissionsCard";
import { LeaseShieldCard } from "./LeaseShieldCard";
import { WatchedBuildingsSection } from "./WatchedBuildingsSection";

type Tab = "overview" | "watched" | "reviews" | "rentals" | "settings";

type ReviewRow = {
  id: string;
  rating: number | null;
  review_text: string | null;
  review_date: string | null;
  red_flags: string[];
  complexes: { name: string; address: string | null } | null;
};

type RentalRow = {
  id: string;
  move_in_year: number;
  move_out_year: number | null;
  monthly_rent: number | null;
  bedrooms: string;
  is_public: boolean;
  complexes: { name: string } | null;
};

export function ProfileClient({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [newHandle, setNewHandle] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const shield = searchParams.get("lease_shield");
    if (shield === "success") {
      setMessage("Lease Shield activated. Unlimited watchlist and alerts for 90 days.");
    } else if (shield === "cancel") {
      setMessage("Checkout canceled. You can upgrade anytime from this page.");
    }
  }, [searchParams]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (p) setProfile(p as Profile);

      const { data: rev } = await supabase
        .from("reviews")
        .select(
          "id, rating, review_text, review_date, red_flags, complexes(name, address)"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setReviews((rev ?? []) as unknown as ReviewRow[]);

      const { data: rent } = await supabase
        .from("rental_history")
        .select(
          "id, move_in_year, move_out_year, monthly_rent, bedrooms, is_public, complexes(name)"
        )
        .eq("user_id", userId)
        .order("move_in_year", { ascending: false });
      setRentals((rent ?? []) as unknown as RentalRow[]);
    })();
  }, [userId]);

  async function saveHandle() {
    if (!profile || !newHandle.trim()) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ handle: newHandle.trim(), handle_changed: true })
      .eq("id", userId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setProfile({ ...profile, handle: newHandle.trim(), handle_changed: true });
    setMessage("Handle updated.");
  }

  async function toggleRentalPublic(id: string, isPublic: boolean) {
    const supabase = createClient();
    await supabase
      .from("rental_history")
      .update({ is_public: !isPublic })
      .eq("id", id);
    setRentals((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_public: !isPublic } : r))
    );
  }

  const flagLabel = Object.fromEntries(
    RED_FLAG_OPTIONS.map((f) => [f.value, f.label])
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "watched", label: "Watched Buildings" },
    { id: "reviews", label: "Reviews" },
    { id: "rentals", label: "Rental History" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl gap-8 px-4 pb-12 pt-16">
      <nav className="hidden w-44 shrink-0 flex-col gap-1 sm:flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-left text-sm ${
              tab === t.id
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <select
          className="mb-4 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm sm:hidden"
          value={tab}
          onChange={(e) => setTab(e.target.value as Tab)}
        >
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        {profile && tab === "overview" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-50">
                @{profile.handle}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Member since{" "}
                {new Date(profile.member_since).toLocaleDateString()}
              </p>
            </div>
            <LeaseShieldCard
              premium={
                !!profile.watchlist_premium_until &&
                new Date(profile.watchlist_premium_until) > new Date()
              }
            />
            <DhcrSubmissionsCard />
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-center">
                <p className="text-2xl font-semibold text-orange-500">
                  {reviews.length}
                </p>
                <p className="text-xs text-neutral-500">reviews</p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-center">
                <p className="text-2xl font-semibold text-orange-500">
                  {new Set(reviews.map((r) => r.complexes?.name)).size}
                </p>
                <p className="text-xs text-neutral-500">buildings rated</p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-center">
                <p className="text-2xl font-semibold text-orange-500">
                  {rentals.length}
                </p>
                <p className="text-xs text-neutral-500">rentals logged</p>
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-medium text-neutral-400">
                Your rental story
              </h2>
              {rentals.length === 0 ? (
                <p className="text-sm text-neutral-500">No rentals logged yet.</p>
              ) : (
                <ul className="space-y-3 border-l border-neutral-800 pl-4">
                  {rentals.slice(0, 5).map((r) => (
                    <li key={r.id} className="text-sm">
                      <p className="font-medium text-neutral-200">
                        {r.complexes?.name ?? "Building"}
                      </p>
                      <p className="text-neutral-500">
                        {r.move_in_year}–
                        {r.move_out_year ?? "present"} · {r.bedrooms}
                        {r.monthly_rent ? ` · $${r.monthly_rent}/mo` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/"
                className="mt-4 inline-block text-sm text-orange-500 hover:underline"
              >
                Add a place on the map →
              </Link>
            </div>
          </div>
        )}

        {tab === "watched" && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-neutral-50">
              Watched Buildings
            </h1>
            <WatchedBuildingsSection />
          </div>
        )}

        {tab === "reviews" && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">Your reviews</h1>
            {reviews.length === 0 ? (
              <p className="text-sm text-neutral-500">No reviews yet.</p>
            ) : (
              reviews.map((r) => (
                <article
                  key={r.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"
                >
                  <p className="font-medium text-neutral-100">
                    {r.complexes?.name ?? "Building"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {r.review_date &&
                      new Date(r.review_date).toLocaleDateString()}{" "}
                    {r.rating != null && `· ${r.rating} ★`}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm text-neutral-300">
                    {r.review_text}
                  </p>
                  {r.red_flags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.red_flags.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-orange-950/50 px-2 py-0.5 text-xs text-orange-300"
                        >
                          {flagLabel[f] ?? f}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        )}

        {tab === "rentals" && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">Rental history</h1>
            {rentals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 p-4"
              >
                <div>
                  <p className="font-medium text-neutral-100">
                    {r.complexes?.name}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {r.move_in_year}–{r.move_out_year ?? "present"} · {r.bedrooms}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-neutral-500">
                  <input
                    type="checkbox"
                    checked={r.is_public}
                    onChange={() => toggleRentalPublic(r.id, r.is_public)}
                  />
                  Public
                </label>
              </div>
            ))}
          </div>
        )}

        {tab === "settings" && profile && (
          <div className="space-y-6">
            <h1 className="text-xl font-semibold">Settings</h1>
            <div>
              <p className="text-sm text-neutral-500">Email</p>
              <p className="text-neutral-200">{email}</p>
            </div>
            <div>
              <p className="mb-2 text-sm text-neutral-500">Handle</p>
              {profile.handle_changed ? (
                <p className="text-sm text-neutral-400">
                  Handle can only be changed once (@{profile.handle})
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    placeholder={profile.handle}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={saveHandle}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-neutral-950"
                  >
                    Save
                  </button>
                </div>
              )}
              {message && (
                <p className="mt-2 text-sm text-emerald-400">{message}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
