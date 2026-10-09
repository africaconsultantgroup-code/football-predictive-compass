"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { formatPesewas, formatEffectivePrice, ghanaDate, MATCH_PRICING_POLICY, type BasketQuote } from "../../lib/payments/match-pricing";

type Choice = { matchId: string; kickoffAt: string; label: string; owned: boolean };
type BasketContext = { choices: Choice[]; selected: string[]; toggle: (id: string) => void };
const Selection = createContext<BasketContext | null>(null);
const errors: Record<string, string> = {
  ACCESS_ALREADY_GRANTED: "You already own a selected match. Refresh to update your selection.",
  SAME_GHANA_DATE_REQUIRED: "Select matches from one Ghana calendar day.",
  BASKET_CHANGED_CONFIRM_AGAIN: "The fixture details changed. Review a new quote before paying.",
  MATCH_NOT_ELIGIBLE: "A selected match is no longer available to purchase. Update your selection.",
  QUOTE_EXPIRED: "Your quote expired. Review a new quote before paying.",
  CHECKOUT_ALREADY_PENDING: "A checkout is already pending for a selected match. Verify that payment before starting another.",
  CHECKOUT_VERIFICATION_REQUIRED: "Checkout needs verification. No second payment has been opened. Check your payment status before retrying.",
};
export function BasketCheckout({ matchIds }: { matchIds: string[] }) {
  const key = [...matchIds].sort().join(",");
  const [result, setResult] = useState<{ key: string; quote?: Omit<BasketQuote, "user_id">; error?: string }>({ key: "" });
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch("/api/payments/matches/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ match_ids: key.split(",") }), signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!controller.signal.aborted) setResult({ key, ...(response.ok ? { quote: body.quote } : { error: response.status === 401 ? "AUTHENTICATION_REQUIRED" : body.error }) });
    }).catch(() => { if (!controller.signal.aborted) setResult({ key, error: "QUOTE_UNAVAILABLE" }); });
    return () => controller.abort();
  }, [key, revision]);
  const quote = result.key === key ? result.quote : undefined;
  const error = result.key === key ? result.error : undefined;
  async function checkout() {
    if (!quote) return;
    setBusy(true);
    try {
      const response = await fetch("/api/payments/paystack/initialize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quote_id: quote.id }) });
      const body = await response.json();
      if (response.ok && typeof body.authorization_url === "string") { window.location.assign(body.authorization_url); return; }
      setResult({ key, error: response.status === 401 ? "AUTHENTICATION_REQUIRED" : body.error });
    } catch { setResult({ key, error: "CHECKOUT_UNAVAILABLE" }); }
    finally { setBusy(false); }
  }
  return <section className="match-basket-summary" aria-label="Your Match Selection" aria-live="polite">
    <h2>Your Match Selection</h2>
    <p>{matchIds.length} {matchIds.length === 1 ? "match" : "matches"} selected · One Ghana calendar day, across competitions.</p>
    {quote ? <><dl><div><dt>Regular price</dt><dd>{formatPesewas(quote.regular_pesewas)}</dd></div><div><dt>Multi-match discount</dt><dd>{formatPesewas(quote.discount_pesewas)}</dd></div><div><dt>Effective price per match</dt><dd>{formatEffectivePrice(quote)}</dd></div><div><dt>Total</dt><dd><strong>{formatPesewas(quote.total_pesewas)}</strong></dd></div></dl><small>Quote valid until {new Date(quote.expires_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Accra" })} GMT.</small><button className="checkout-button" disabled={busy} onClick={checkout}>{busy ? "Opening secure checkout…" : `Unlock ${quote.match_count} ${quote.match_count === 1 ? "Match" : "Matches"} — ${formatPesewas(quote.total_pesewas)}`}</button></> : key && !error ? <p role="status">Calculating your secure quote…</p> : null}
    {error === "AUTHENTICATION_REQUIRED" ? <Link href="/login?next=/matches">Sign in to review your price and purchase</Link> : error ? <><p role="alert">{errors[error] ?? "Checkout is temporarily unavailable."}</p><button type="button" disabled={busy} onClick={() => { setResult({ key: "" }); setRevision(value => value + 1); }}>Review new quote</button></> : null}
    <p>One payment unlocks every available Premium stage for each selected match, including historical review. Free Early Forecast stays separate.</p>
  </section>;
}
export function MatchBasket({ choices, children }: { choices: Choice[]; children: ReactNode }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  function toggle(id: string) {
    const item = choices.find(item => item.matchId === id);
    if (!item || item.owned) return;
    const first = choices.find(item => item.matchId === selected[0]);
    if (!selected.includes(id) && selected.length && (!first || ghanaDate(item.kickoffAt) !== ghanaDate(first.kickoffAt))) { setMessage("Choose matches from the same Ghana calendar day, or clear your selection first."); return; }
    setMessage("");
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }
  return <Selection.Provider value={{ choices, selected, toggle }}><div className="match-basket-layout">{children}<aside className="match-basket-panel">
    {message ? <p role="alert">{message}</p> : null}
    {selected.length ? <><ul>{selected.map(id => <li key={id}>{choices.find(item => item.matchId === id)?.label ?? id}<button type="button" onClick={() => setSelected(items => items.filter(item => item !== id))} aria-label={`Remove ${choices.find(item => item.matchId === id)?.label ?? id}`}>Remove</button></li>)}</ul><button type="button" onClick={() => setSelected([])}>Clear selection</button></> : null}
    <BasketCheckout matchIds={selected} />
  </aside></div></Selection.Provider>;
}
export function MatchSelection({ matchId }: { matchId: string }) {
  const basket = useContext(Selection), item = basket?.choices.find(item => item.matchId === matchId);
  return item ? <div className="match-selection">{item.owned ? <strong>Premium Unlocked</strong> : <label><input type="checkbox" checked={basket!.selected.includes(matchId)} onChange={() => basket!.toggle(matchId)} />Select {item.label} · {formatPesewas(MATCH_PRICING_POLICY.standardUnit)}</label>}</div> : <small>Premium purchase currently unavailable</small>;
}
export function SingleMatchCheckout({ matchId, label }: { matchId: string; label: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="unlock-button" onClick={() => setOpen(value => !value)}>Unlock Premium Match — {formatPesewas(MATCH_PRICING_POLICY.standardUnit)}</button>{open ? <div><h3>{label}</h3><BasketCheckout matchIds={[matchId]} /><Link href="/matches?competition=all">Select more matches for a daily discount</Link></div> : null}</>;
}
