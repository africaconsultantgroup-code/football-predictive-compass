"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CheckoutButton({ productId }: { productId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const checkout = async () => {
    setLoading(true); setMessage(null);
    try {
      const response = await fetch("/api/payments/paystack/initialize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: productId }) });
      const result = await response.json();
      if (response.status === 401) { router.push("/login"); return; }
      if (response.ok && typeof result.authorization_url === "string") { window.location.assign(result.authorization_url); return; }
      setMessage(result.error === "PAYSTACK_CONFIGURATION_REQUIRED" ? "Checkout is coming soon." : "This prediction cannot be purchased right now.");
    } catch { setMessage("Checkout is temporarily unavailable."); }
    finally { setLoading(false); }
  };
  return <div className="mt-2"><button className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-60" disabled={loading} onClick={checkout} type="button">{loading ? "Opening checkout…" : "Unlock Prediction"}</button>{message ? <p className="mt-2 text-xs text-amber-200" role="status">{message}</p> : null}</div>;
}
