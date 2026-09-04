"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { PredictionAccessOffer } from "../lib/auth/match-access";
import { formatProductPrice } from "../lib/payments/format";

export function CheckoutButton({ offer, matchLabel, stage }: { offer: PredictionAccessOffer; matchLabel: string; stage: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const isSlot = offer.scopeType === "kickoff_slot";
  const checkout = async () => {
    setLoading(true); setMessage(null);
    try {
      const response = await fetch("/api/payments/paystack/initialize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: offer.productId }) });
      const result = await response.json();
      if (response.status === 401) { router.push("/login"); return; }
      if (response.ok && typeof result.authorization_url === "string") { window.location.assign(result.authorization_url); return; }
      setMessage(result.error === "PAYSTACK_CONFIGURATION_REQUIRED" ? "Checkout is coming soon." : "This prediction cannot be purchased right now.");
    } catch { setMessage("Checkout is temporarily unavailable."); }
    finally { setLoading(false); }
  };
  return <>
    <button className="unlock-button" onClick={() => setOpen(true)} type="button">{isSlot ? "Unlock Slot" : stage === "Prematch" ? "Unlock Prematch Prediction" : "Unlock Match"}<span aria-hidden="true">→</span></button>
    {open ? <div className="purchase-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="purchase-dialog" role="dialog" aria-modal="true" aria-labelledby={`purchase-${offer.productId}`}>
        <button className="dialog-close" type="button" aria-label="Close purchase summary" onClick={() => setOpen(false)}>×</button>
        <p className="section-kicker">Purchase summary</p><h2 id={`purchase-${offer.productId}`}>Unlock Prediction</h2>
        <div className="purchase-product"><span>{isSlot ? `${offer.matchCount} Matches · Kickoff Slot` : matchLabel}</span><strong>{stage} Prediction</strong><b>{offer.priceAmount === null ? "Price unavailable" : formatProductPrice(offer.priceAmount, offer.currency)}</b></div>
        <p>{isSlot ? `This unlocks ${stage} intelligence for all ${offer.matchCount} matches included in this kickoff slot.` : `You are purchasing ${stage} intelligence for this match only.`}</p>
        <div className="purchase-boundary"><strong>This purchase does not include:</strong><span>Other prediction stages or matches outside this product.</span></div>
        <button className="checkout-button" disabled={loading} onClick={checkout} type="button">{loading ? "Opening secure checkout…" : "Continue to Secure Payment"}</button>
        {message ? <p className="checkout-message" role="status">{message}</p> : null}
        <small className="secure-caption">Secure checkout powered by Paystack · Card & Mobile Money</small>
      </section>
    </div> : null}
  </>;
}
