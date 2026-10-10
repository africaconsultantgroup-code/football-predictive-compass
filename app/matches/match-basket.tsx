"use client";

import Link from "next/link";
import { TeamIdentity } from "../team-identity";
import type { TeamIdentityRecord } from "../../lib/teams/identity";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatPesewas, formatEffectivePrice, ghanaDate, MATCH_PRICING_POLICY, type BasketQuote } from "../../lib/payments/match-pricing";
import { openPaystackCheckout, paymentStatusHref, safePaystackCheckoutUrl, type PendingMatchCheckout } from "../../lib/payments/checkout-link";

type Choice = { matchId: string; kickoffAt: string; label: string; homeTeam?: string; awayTeam?: string; homeIdentity?: TeamIdentityRecord; awayIdentity?: TeamIdentityRecord; owned: boolean; pendingCheckout?: PendingMatchCheckout };
type CheckoutResult = { key: string; quote?: Omit<BasketQuote, "user_id">; pending?: PendingMatchCheckout; error?: string };
type BasketContext = { choices: Choice[]; selected: string[]; now: number; pending?: PendingMatchCheckout; reviewed: boolean; toggle: (id: string) => void; review: (id: string) => void; basketId: string };
const Selection = createContext<BasketContext | null>(null);
const errors: Record<string, string> = {
  ACCESS_ALREADY_GRANTED: "You already have access to a selected match. Refresh to update your selection.",
  SAME_GHANA_DATE_REQUIRED: "Select matches from one Ghana calendar day.",
  BASKET_CHANGED_CONFIRM_AGAIN: "The fixture details changed. Review a new quote before paying.",
  MATCH_NOT_ELIGIBLE: "Purchasing has closed for a selected match. Remove it from your basket.",
  QUOTE_EXPIRED: "Your quote expired. Review a new quote before paying.",
  CHECKOUT_ALREADY_PENDING: "A checkout is already pending. Check its payment status before starting another.",
  CHECKOUT_VERIFICATION_REQUIRED: "Checkout needs verification. No second payment has been opened.",
  CHECKOUT_STATUS_UNAVAILABLE: "We could not check for an existing checkout. Please try again before paying.",
  CHECKOUT_EXPIRED: "Previous checkout expired. Review a fresh secure quote before paying.",
};

function useDeadlineClock(deadlines: string[]) {
  const [now, setNow] = useState(() => Date.now());
  const next = Math.min(...deadlines.map(Date.parse).filter(value => value > now));
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(Math.max(1, next - Date.now() + 5), 2_147_483_647));
    return () => clearTimeout(timer);
  }, [next]);
  return now;
}

export function PendingCheckoutAction({ checkout, closed = false, onReview }: { checkout: PendingMatchCheckout; closed?: boolean; onReview?: () => void }) {
  const now = useDeadlineClock(checkout.usableUntil ? [checkout.usableUntil] : []);
  if (checkout.state === "successful") return <div><strong>Premium Intelligence Unlocked</strong><Link href={`/matches/${checkout.matchIds[0]}`}>View Match Intelligence</Link></div>;
  if (checkout.state === "expired") return <div className="pending-checkout"><p>Previous checkout expired</p>{onReview && !closed ? <button type="button" onClick={onReview}>Start Secure Checkout Again</button> : <Link href="/matches">Return to Matches</Link>}</div>;
  const url = closed || checkout.state !== "active" || !(Date.parse(checkout.usableUntil ?? "") > now) ? null : safePaystackCheckoutUrl(checkout.authorizationUrl);
  return <div className="pending-checkout"><p>{url ? "Payment pending" : checkout.state === "stale" ? "Previous checkout needs reconciliation. Its saved payment link is no longer offered." : "Payment verification required"}</p>
    {onReview ? <button type="button" onClick={onReview}>Verify existing payment</button> : null}
    <a className="matches-option-link" href={url ?? paymentStatusHref(checkout.reference)}>{url ? "Continue Payment" : "Check Payment Status"}</a>
    {url ? <Link href={paymentStatusHref(checkout.reference)}>Check payment status</Link> : <p>Verify the existing payment before trying again. No second transaction will be created.</p>}
  </div>;
}

export function BasketCheckout({ matchIds, onResult, refreshKey = 0 }: { matchIds: string[]; onResult?: (result: CheckoutResult) => void; refreshKey?: number }) {
  const key = [...matchIds].sort().join(",");
  const [result, setResult] = useState<CheckoutResult>({ key: "" });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch("/api/payments/matches/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ match_ids: key.split(",") }), signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!controller.signal.aborted) {
        const next: CheckoutResult = { key, ...(response.ok ? body.pending_checkout ? { pending: body.pending_checkout } : body.quote ? { quote: body.quote } : { error: "QUOTE_UNAVAILABLE" } : { error: response.status === 401 ? "AUTHENTICATION_REQUIRED" : body.error ?? "QUOTE_UNAVAILABLE" }) };
        setResult(next); onResult?.(next);
      }
    }).catch(() => { if (!controller.signal.aborted) { const next = { key, error: "QUOTE_UNAVAILABLE" }; setResult(next); onResult?.(next); } });
    return () => controller.abort();
  }, [key, revision, onResult, refreshKey]);
  const current = result.key === key ? result : undefined;
  const quote = current?.quote;
  const error = current?.error;
  const now = useDeadlineClock(quote ? [quote.expires_at, ...quote.fixtures.map(item => item.kickoff_at)] : []);
  const closed = quote?.fixtures.some(item => Date.parse(item.kickoff_at) <= now);
  const expired = quote && Date.parse(quote.expires_at) <= now;
  async function checkout() {
    if (!quote || inFlight.current || expired || closed) return;
    inFlight.current = true; setBusy(true);
    try {
      const response = await fetch("/api/payments/paystack/initialize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quote_id: quote.id }) });
      const body = await response.json();
      const url = safePaystackCheckoutUrl(body.authorization_url);
      if (response.ok && url) { openPaystackCheckout(url); return; }
      const pending = body.pending_checkouts?.find((item: PendingMatchCheckout) => item.matchIds.some(id => matchIds.includes(id)));
      const next = { key, ...(pending ? { pending } : { error: response.status === 401 ? "AUTHENTICATION_REQUIRED" : body.error ?? "CHECKOUT_UNAVAILABLE" }) };
      setResult(next); onResult?.(next);
    } catch {
      // Initialization may have been accepted before the connection failed.
      // Re-read existing checkout status before allowing another attempt.
      const next = { key, error: "CHECKOUT_VERIFICATION_REQUIRED" }; setResult(next); onResult?.(next);
    } finally { inFlight.current = false; setBusy(false); }
  }
  function refreshQuote() { setResult({ key: "" }); onResult?.({ key: "" }); setRevision(value => value + 1); }
  return <section className="match-basket-summary" aria-label="Your Match Selection" aria-live="polite">
    <h2>Your Match Selection</h2>
    <p>{matchIds.length} {matchIds.length === 1 ? "match" : "matches"} selected · One Ghana calendar day, across competitions.</p>
    {current?.pending ? <><h3>Existing checkout</h3>{current.pending.fixtures.length ? <ul>{current.pending.fixtures.map(item => <li key={item.match_id}><TeamIdentity inline name={item.home_team} team={item.home_team_identity} /><span> vs </span><TeamIdentity inline name={item.away_team} team={item.away_team_identity} /></li>)}</ul> : null}{current.pending.totalPesewas !== null ? <p>Existing checkout total: <strong>{formatPesewas(current.pending.totalPesewas)}</strong></p> : null}<PendingCheckoutAction checkout={current.pending} onReview={refreshQuote} /></> : quote ? <>
      <p>Authoritative server quote</p><ul aria-label="Quoted fixtures">{quote.fixtures.map(item => <li key={item.match_id}><TeamIdentity inline name={item.home_team} team={item.home_team_identity} /><span> vs </span><TeamIdentity inline name={item.away_team} team={item.away_team_identity} /><small>{item.competition} · {new Date(item.kickoff_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })} GMT</small></li>)}</ul><dl><div><dt>Regular price</dt><dd>{formatPesewas(quote.regular_pesewas)}</dd></div><div><dt>Multi-match discount</dt><dd>{formatPesewas(quote.discount_pesewas)}</dd></div><div><dt>Effective price per match</dt><dd>{formatEffectivePrice(quote)}</dd></div><div><dt>Total</dt><dd><strong>{formatPesewas(quote.total_pesewas)}</strong></dd></div></dl>
      <small>Quote valid until {new Date(quote.expires_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Accra" })} GMT.</small>
      <button className="checkout-button" type="button" disabled={busy || Boolean(expired || closed)} onClick={checkout}>{busy ? "Opening secure checkout…" : "Continue to Payment"}</button>
      {closed ? <p role="alert">Purchasing has closed for this match. Remove it from your basket.</p> : expired ? <><p role="alert">Your quote expired. Review a new quote before paying.</p><button type="button" onClick={refreshQuote}>Review new quote</button></> : null}
    </> : key && !error ? <p role="status">Verifying your payment… Reviewing your secure quote.</p> : !key ? <p>Add a match to review your server quote.</p> : null}
    {error === "AUTHENTICATION_REQUIRED" ? <Link href="/login?next=/matches">Sign in to review your price and purchase</Link> : error ? <><p role="alert">{errors[error] ?? "Checkout is temporarily unavailable."}</p><button type="button" disabled={busy} onClick={refreshQuote}>{error === "CHECKOUT_EXPIRED" ? "Start Secure Checkout Again" : ["CHECKOUT_VERIFICATION_REQUIRED", "CHECKOUT_ALREADY_PENDING"].includes(error) ? "Check existing checkout" : "Review new quote"}</button><Link href="/account">View payment activity</Link></> : null}
    <p>One payment unlocks every available Premium stage for each selected match, including historical review. Free Early Forecast stays separate.</p>
  </section>;
}

export function MatchBasket({ choices, children }: { choices: Choice[]; children: ReactNode }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CheckoutResult>({ key: "" });
  const [reviewRevision, setReviewRevision] = useState(0);
  const basketId = useId();
  const now = useDeadlineClock([...choices.map(item => item.kickoffAt), ...(result.quote ? [result.quote.expires_at] : [])]);
  const active = selected.filter(id => { const item = choices.find(item => item.matchId === id); return item && !item.owned && Date.parse(item.kickoffAt) > now; });
  const key = [...active].sort().join(",");
  const current = result.key === key ? result : undefined;
  function toggle(id: string) {
    if (selected.includes(id)) { setSelected(items => items.filter(item => item !== id)); setMessage(""); return; }
    const item = choices.find(item => item.matchId === id);
    if (!item || item.owned || item.pendingCheckout || Date.parse(item.kickoffAt) <= now) return;
    const first = choices.find(item => item.matchId === selected[0]);
    if (selected.length && (!first || ghanaDate(item.kickoffAt) !== ghanaDate(first.kickoffAt))) { setMessage("Choose matches from the same Ghana calendar day, or clear your selection first."); return; }
    if (selected.length >= MATCH_PRICING_POLICY.totals.length) { setMessage("You can select up to 10 matches per basket."); return; }
    setMessage(""); setSelected(items => [...items, id]);
  }
  function review(id: string) { setSelected(items => items.includes(id) ? items : [...items, id]); setReviewRevision(value => value + 1); }
  return <Selection.Provider value={{ choices, selected, toggle, review, now, pending: current?.pending, reviewed: Boolean(current?.quote), basketId }}><div className="match-basket-layout">{children}
    <aside id={basketId} tabIndex={-1} className="match-basket-panel" aria-label="Match basket">
      {message ? <p role="alert">{message}</p> : null}
      {selected.length ? <><ul aria-label="Selected fixtures">{selected.map(id => <li key={id}>{choices.find(item => item.matchId === id)?.homeTeam && choices.find(item => item.matchId === id)?.awayTeam ? <><TeamIdentity inline name={choices.find(item => item.matchId === id)!.homeTeam!} team={choices.find(item => item.matchId === id)?.homeIdentity} /><span> vs </span><TeamIdentity inline name={choices.find(item => item.matchId === id)!.awayTeam!} team={choices.find(item => item.matchId === id)?.awayIdentity} /></> : choices.find(item => item.matchId === id)?.label ?? "Match details being prepared"}<button type="button" onClick={() => toggle(id)} aria-label={`Remove ${choices.find(item => item.matchId === id)?.label ?? "match"}`}>Remove</button></li>)}</ul><button type="button" onClick={() => setSelected([])}>Clear selection</button></> : null}
      {selected.length !== active.length ? <p role="alert">Purchasing has closed for a selected match. Remove it from your basket.</p> : null}
      <BasketCheckout matchIds={active} onResult={setResult} refreshKey={reviewRevision} />
    </aside>
  </div>{selected.length ? <div className="mobile-basket-bar" aria-label="Selected match basket"><div><strong>{selected.length} {selected.length === 1 ? "match" : "matches"} selected</strong><span>{current?.pending ? "Existing checkout" : current?.quote && Date.parse(current.quote.expires_at) > now ? formatPesewas(current.quote.total_pesewas) : "Review total in basket"}</span></div><a href={`#${basketId}`}>View Basket</a></div> : null}</Selection.Provider>;
}

export function MatchSelection({ matchId, kickoffAt, label }: { matchId: string; kickoffAt?: string | null; label?: string }) {
  const basket = useContext(Selection);
  if (!basket) return kickoffAt ? <SingleMatchCheckout matchId={matchId} kickoffAt={kickoffAt} label={label ?? "Match"} /> : <small>Premium purchase currently unavailable</small>;
  const item = basket.choices.find(item => item.matchId === matchId);
  if (!item) return kickoffAt && Date.parse(kickoffAt) <= basket.now ? <><button type="button" disabled>Purchase closed</button><p>Purchasing has closed for this match.</p></> : <small>Premium purchase currently unavailable</small>;
  if (item.owned) return <><strong>Premium Intelligence Unlocked</strong><Link href={`/matches/${matchId}`}>View Match Intelligence</Link></>;
  const closed = Date.parse(item.kickoffAt) <= basket.now;
  const pending = (basket.pending?.matchIds.includes(matchId) ? basket.pending : undefined) ?? (basket.reviewed ? undefined : item.pendingCheckout);
  if (pending) return <PendingCheckoutAction checkout={pending} closed={closed} onReview={() => basket.review(matchId)} />;
  const added = basket.selected.includes(matchId);
  return <div className="match-selection">{closed ? <><button type="button" disabled>Purchase closed</button><p>Purchasing has closed for this match.</p>{added ? <button type="button" onClick={() => basket.toggle(matchId)}>Remove</button> : null}</> : added ? <><strong role="status">Added ✓</strong><button type="button" onClick={() => basket.toggle(matchId)} aria-label={`Remove ${item.label}`}>Remove</button><a href={`#${basket.basketId}`}>View Basket</a></> : <button className="add-to-basket" type="button" onClick={() => basket.toggle(matchId)} aria-label={`Add to Basket: ${item.label}`}>Add to Basket</button>}</div>;
}

export function SingleMatchCheckout({ matchId, label, kickoffAt }: { matchId: string; label: string; kickoffAt?: string | null }) {
  const now = useDeadlineClock(kickoffAt ? [kickoffAt] : []);
  if (!kickoffAt || Date.parse(kickoffAt) <= now) return <><button type="button" disabled>Purchase closed</button><p>Purchasing has closed for this match.</p></>;
  return <div className="single-match-basket"><p>{formatPesewas(MATCH_PRICING_POLICY.standardUnit)} single-match starting price</p><MatchBasket choices={[{ matchId, kickoffAt, label, owned: false }]}><MatchSelection matchId={matchId} /></MatchBasket></div>;
}
