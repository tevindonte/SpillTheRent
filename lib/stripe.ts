import Stripe from "stripe";
import { getSiteOrigin } from "@/lib/seo";

export const FREE_WATCHLIST_LIMIT = 3;
export const PREMIUM_PRICE_CENTS = 999;
export const PREMIUM_DAYS = 90;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export function isPremiumActive(until: string | null | undefined): boolean {
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

export async function createLeaseShieldCheckout(
  stripe: Stripe,
  userId: string,
  email: string | null
): Promise<string> {
  const origin = getSiteOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: PREMIUM_PRICE_CENTS,
          product_data: {
            name: "spillthe.rent Lease Shield",
            description:
              "90 days: unlimited watchlist + email alerts on HPD, reviews, and rent reports.",
          },
        },
        quantity: 1,
      },
    ],
    metadata: { user_id: userId },
    success_url: `${origin}/profile?lease_shield=success`,
    cancel_url: `${origin}/profile?lease_shield=cancel`,
  });
  if (!session.url) throw new Error("Stripe session missing URL");
  return session.url;
}
