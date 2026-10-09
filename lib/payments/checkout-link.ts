import type { BasketFixture } from "./match-pricing";

export type PendingMatchCheckout = {
  reference: string;
  authorizationUrl: string | null;
  matchIds: string[];
  fixtures: BasketFixture[];
  totalPesewas: number | null;
};

export function safePaystackCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.paystack.com" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function paymentStatusHref(reference: string) {
  return `/payments/paystack/callback?reference=${encodeURIComponent(reference)}`;
}

export function openPaystackCheckout(url: string) {
  const safe = safePaystackCheckoutUrl(url);
  if (!safe) throw new Error("Invalid checkout destination");
  window.location.assign(safe);
}
