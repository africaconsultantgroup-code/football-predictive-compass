// @vitest-environment jsdom
import { act } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BasketQuote } from "../../lib/payments/match-pricing";
import type { BasketPayment } from "../../lib/payments/basket-service";
import type { FootballPrediction } from "../../lib/predictive-compass/schema";

const mocks = vi.hoisted(() => ({ user: vi.fn(), admin: undefined as unknown, paystack: undefined as unknown, upcoming: vi.fn(), live: vi.fn(), navigate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../predictions", () => ({ CUSTOMER_COMPETITIONS: ["Premier League", "UEFA Champions League"] }));
vi.mock("../../lib/payments/checkout-link", async importOriginal => ({ ...await importOriginal<typeof import("../../lib/payments/checkout-link")>(), openPaystackCheckout: mocks.navigate }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/auth/access", () => ({ getCustomerAccess: vi.fn() }));
vi.mock("@/lib/auth/match-access", () => ({ commercialStage: vi.fn(), hasPredictionAccess: vi.fn() }));
vi.mock("@/lib/payments/checkout", () => ({ parseCheckoutRequest: vi.fn() }));
vi.mock("@/lib/payments/service", () => ({ initializePredictionPayment: vi.fn() }));
vi.mock("@/lib/payments/basket-service", async () => import("../../lib/payments/basket-service"));
vi.mock("@/lib/payments/pending-checkout", async () => import("../../lib/payments/pending-checkout"));
vi.mock("@/lib/payments/match-pricing", async () => import("../../lib/payments/match-pricing"));
vi.mock("@/lib/payments/pricing-version", async () => import("../../lib/payments/pricing-version"));
vi.mock("@/lib/payments/paystack", async () => ({ ...await import("../../lib/payments/paystack"), createPaystackClient: () => mocks.paystack, getTrustedSiteOrigin: () => "https://customer.example.test" }));
vi.mock("@/lib/predictive-compass/prematch", () => ({ isDeliverablePrematch: vi.fn() }));
vi.mock("@/lib/predictive-compass/server", () => ({ getUpcomingFootballPredictions: mocks.upcoming, getLiveFootballPrediction: mocks.live, getLiveFootballMatches: vi.fn(), requestPrematchFreshness: vi.fn() }));
vi.mock("@/lib/supabase/auth-server", () => ({ createCustomerAuthServerClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabaseClient: () => mocks.admin }));

import { MatchBasket, MatchSelection } from "./match-basket";
import { MatchRow } from "./match-components";
import { toPredictionPreview } from "../../lib/predictive-compass/preview";
import { MATCH_PRICING_POLICY, validateBasket } from "../../lib/payments/match-pricing";
import { verifyBasketPayment } from "../../lib/payments/basket-service";
import { createPaystackClient } from "../../lib/payments/paystack";
import { POST as quoteRoute } from "../api/payments/matches/quote/route";
import { POST as initializeRoute } from "../api/payments/paystack/initialize/route";

const id = `fm_${"a".repeat(32)}`;
const owner = "ordinary-customer";
let prediction: FootballPrediction;
let quotes: BasketQuote[];
let payments: BasketPayment[];
let entitlements: Set<string>;
let reservations: Map<string, string>;
let initialize: ReturnType<typeof vi.fn>;
let verify: ReturnType<typeof vi.fn>;
let requests: ReturnType<typeof vi.fn>;
let transaction: Record<string, unknown>;

function database() {
  function from(table: string) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let update: Record<string, unknown> | undefined;
    function data() {
      const rows: Array<Record<string, unknown>> = table === "match_basket_quotes" ? quotes.map(row => ({ ...row }))
        : table === "match_basket_payments" ? payments.map(row => ({ ...row, match_basket_quotes: quotes.find(quote => quote.id === row.quote_id) }))
        : table === "customer_match_entitlements" ? [...entitlements].map(match_id => ({ user_id: owner, match_id })) : [];
      const found = rows.filter(row => filters.every(test => test(row)));
      if (update) for (const row of found) Object.assign(payments.find(payment => payment.id === row.id)!, update);
      return found;
    }
    const chain = {
      select: () => chain,
      eq: (field: string, value: unknown) => { filters.push(row => row[field] === value); return chain; },
      in: (field: string, values: unknown[]) => { filters.push(row => values.includes(row[field])); return chain; },
      maybeSingle: async () => ({ data: data()[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: data(), error: null }).then(resolve),
      insert: async (quote: BasketQuote) => { quotes.push(quote); return { error: null }; },
      update: (value: Record<string, unknown>) => { update = value; return chain; },
    };
    return chain;
  }
  const rpc = vi.fn(async (name: string, args: Record<string, string>) => {
    if (name === "accept_match_basket") {
      const existing = payments.find(payment => payment.quote_id === args.p_quote);
      if (existing) return { data: existing, error: null };
      const quote = quotes.find(quote => quote.id === args.p_quote)!;
      if (quote.fixtures.some(item => reservations.has(item.match_id))) return { data: null, error: { message: "CHECKOUT_ALREADY_PENDING" } };
      const payment = { id: args.p_payment, user_id: args.p_user, quote_id: args.p_quote, provider_reference: args.p_reference, status: "initialized", authorization_url: null };
      for (const item of quote.fixtures) reservations.set(item.match_id, payment.id);
      payments.push(payment); return { data: payment, error: null };
    }
    const payment = payments.find(payment => payment.id === args.p_payment)!;
    if (payment.status !== "successful") {
      payment.status = args.p_status;
      if (args.p_status === "successful") for (const fixture of quotes.find(quote => quote.id === payment.quote_id)!.fixtures) entitlements.add(fixture.match_id);
      if (["successful", "failed", "abandoned", "reversed"].includes(args.p_status)) for (const [matchId, paymentId] of reservations) if (paymentId === payment.id) reservations.delete(matchId);
    }
    return { data: payment.status, error: null };
  });
  return { from, rpc } as unknown as SupabaseClient;
}

function choice(owned = false) { return { matchId: id, kickoffAt: prediction.kickoff_at!, label: "Premier League: Arsenal vs Chelsea", owned }; }
function card(owned = false) { return <MatchBasket choices={[choice(owned)]}><MatchRow prediction={owned ? prediction : toPredictionPreview(prediction)} /></MatchBasket>; }
function pending() {
  const stored = { ...validateBasket([id], [{ match_id: id, kickoff_at: prediction.kickoff_at!, competition: prediction.competition, home_team: prediction.home_team, away_team: prediction.away_team }], new Set()), id: "11111111-1111-4111-8111-111111111111", user_id: owner, expires_at: new Date(Date.now() + 600_000).toISOString() };
  quotes.push(stored);
  const payment = { id: "existing", user_id: owner, quote_id: stored.id, provider_reference: "fpc-basket-original", status: "pending", authorization_url: "https://checkout.paystack.com/original" };
  payments.push(payment);
  reservations.set(id, payment.id);
  transaction = { reference: payment.provider_reference, amount: stored.total_pesewas, currency: "GHS", status: "pending", metadata: { payment_id: payment.id, user_id: owner, quote_id: stored.id, pricing_policy: stored.policy_version } };
  return { reference: payment.provider_reference, authorizationUrl: payment.authorization_url, matchIds: [id], fixtures: stored.fixtures, totalPesewas: 800, state: "active" as const, usableUntil: new Date(Date.now()+60_000).toISOString() };
}

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION", "v2");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  quotes = []; payments = []; entitlements = new Set(); reservations = new Map(); transaction = {};
  prediction = { match_id: id, prediction_id: "stored-unit-forecast", competition: "Premier League", home_team: "Arsenal", away_team: "Chelsea", kickoff_at: new Date(Date.now() + 3_600_000).toISOString(), stage: "PREMATCH", probabilities: { home_win: 58, draw: 25, away_win: 17 }, predicted_outcome: "home_win", predicted_score: null, reliability: { score: 65, label: "High" }, verification_status: "verified", important_information_pending: false, customer_summary: "Paid intelligence", customer_key_factors: [], generated_at: null, updated_at: null };
  mocks.user.mockResolvedValue({ id: owner, email: "unit@example.invalid" });
  mocks.upcoming.mockImplementation(async () => [prediction]); mocks.live.mockImplementation(async () => prediction);
  mocks.admin = database();
  initialize = vi.fn(async (args: { reference: string; metadata: Record<string, unknown>; amount: string; currency: string }) => {
    transaction = { ...args, status: "success", paid_at: new Date().toISOString() };
    return { reference: args.reference, authorization_url: "https://checkout.paystack.com/unit-only" };
  });
  verify = vi.fn(async () => transaction); mocks.paystack = { initialize, verify };
  requests = vi.fn(async (url: string, init: RequestInit) => {
    const request = new Request(`https://customer.example.test${url}`, init);
    if (url === "/api/payments/matches/quote") return quoteRoute(request);
    if (url === "/api/payments/paystack/initialize") return initializeRoute(request);
    throw new Error("Unexpected external request");
  });
  vi.stubGlobal("fetch", requests);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("ordinary customer Premium purchase journey", () => {
  it.each(["failed", "abandoned", "expired"])("reconciles %s checkout, releases its reservation and starts a new reference only after fresh quote confirmation", async status => {
    const old = pending(); quotes[0].expires_at = new Date(Date.now()-1).toISOString(); transaction.status = status;
    render(card()); fireEvent.click(screen.getByRole("button", { name: /Add to Basket/ }));
    const restart = await screen.findAllByRole("button", { name: "Start Secure Checkout Again" });
    expect(reservations.size).toBe(0); expect(entitlements.size).toBe(0); expect(initialize).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Continue Payment" })).toBeNull();
    fireEvent.click(restart[restart.length-1]);
    const pay = await screen.findByRole("button", { name: "Continue to Payment" });
    expect(quotes).toHaveLength(2); expect(quotes[1].id).not.toBe(quotes[0].id);
    expect(Date.parse(quotes[1].expires_at)).toBeGreaterThan(Date.now()); fireEvent.click(pay);
    await waitFor(() => expect(initialize).toHaveBeenCalledOnce());
    expect(payments).toHaveLength(2); expect(payments[1].provider_reference).not.toBe(old.reference);
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ reference: payments[1].provider_reference, amount: "800" }));
    expect(reservations.get(id)).toBe(payments[1].id); expect(entitlements.size).toBe(0);
  });
  it("retains unresolved stale pending reservations without offering the old URL or creating another charge", async () => {
    pending(); quotes[0].expires_at = new Date(Date.now()-1).toISOString();
    render(card()); fireEvent.click(screen.getByRole("button", { name: /Add to Basket/ }));
    await screen.findAllByText(/Previous checkout needs reconciliation/);
    expect(screen.queryByRole("link", { name: "Continue Payment" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Start Secure Checkout Again" })).toBeNull();
    expect(reservations.size).toBe(1); expect(quotes).toHaveLength(1); expect(initialize).not.toHaveBeenCalled();
  });
  it("fulfills a legitimate old success despite quote expiry, grants once and releases its reservation", async () => {
    const old = pending(); quotes[0].expires_at = new Date(Date.now()-1).toISOString(); transaction.status = "success"; transaction.paid_at = new Date().toISOString();
    render(card()); fireEvent.click(screen.getByRole("button", { name: /Add to Basket/ }));
    await screen.findAllByText("Premium Intelligence Unlocked");
    expect(entitlements).toEqual(new Set([id])); expect(reservations.size).toBe(0); expect(initialize).not.toHaveBeenCalled();
    expect(await verifyBasketPayment({ admin: mocks.admin as SupabaseClient, paystack: mocks.paystack as ReturnType<typeof createPaystackClient>, reference: old.reference })).toEqual({ status: "successful" });
    expect(verify).toHaveBeenCalledOnce(); expect(entitlements.size).toBe(1);
  });
  it("removes Continue Payment when its verified usability window expires", async () => {
    vi.useFakeTimers(); const checkout = pending();
    render(<MatchBasket choices={[{ ...choice(), pendingCheckout: checkout }]}><MatchRow prediction={toPredictionPreview(prediction)} /></MatchBasket>);
    expect(screen.getByRole("link", { name: "Continue Payment" })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_010); });
    expect(screen.queryByRole("link", { name: "Continue Payment" })).toBeNull();
    expect(screen.getByRole("button", { name: "Verify existing payment" })).toBeTruthy(); expect(initialize).not.toHaveBeenCalled();
  });
  it("clicks the real card through server quote and Pricing V2 initialization, then verifies permanent entitlement once", async () => {
    render(card());
    expect(screen.getByRole("link", { name: "Premium Match Intelligence" }).getAttribute("href")).toBe(`/matches/${id}`);
    fireEvent.click(screen.getByRole("button", { name: /Add to Basket/ }));
    expect(screen.getByText("Added ✓")).toBeTruthy();
    const pay = await screen.findByRole("button", { name: "Continue to Payment" });
    const bar = screen.getByLabelText("Selected match basket");
    expect(within(bar).getByText("GH₵8")).toBeTruthy();
    expect(within(bar).getByRole("link", { name: "View Basket" }).getAttribute("href")).toBe(`#${screen.getByRole("complementary", { name: "Match basket" }).id}`);
    expect(within(screen.getByRole("list", { name: "Selected fixtures" })).getByText(/Arsenal vs Chelsea/)).toBeTruthy();
    expect(screen.getByText("Authoritative server quote")).toBeTruthy();
    fireEvent.click(pay);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("https://checkout.paystack.com/unit-only"));
    expect(initialize).toHaveBeenCalledOnce(); expect(payments).toHaveLength(1);
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ amount: "800", metadata: expect.objectContaining({ user_id: owner, quote_id: quotes[0].id }) }));
    const init = requests.mock.calls.find(([url]) => url === "/api/payments/paystack/initialize")!;
    expect(JSON.parse(String(init[1].body))).toEqual({ quote_id: quotes[0].id });
    const args = { admin: mocks.admin as SupabaseClient, paystack: mocks.paystack as ReturnType<typeof createPaystackClient>, reference: payments[0].provider_reference };
    expect(await verifyBasketPayment(args)).toEqual({ status: "successful" });
    expect(entitlements).toEqual(new Set([id]));
    expect(await verifyBasketPayment(args)).toEqual({ status: "successful" });
    expect(verify).toHaveBeenCalledOnce(); expect(initialize).toHaveBeenCalledOnce();
  });

  it("removes an added fixture and hides the mobile basket bar and payment action", async () => {
    render(card()); fireEvent.click(screen.getByRole("button", { name: /Add to Basket/ }));
    await screen.findByRole("button", { name: "Continue to Payment" });
    fireEvent.click(screen.getAllByRole("button", { name: /Remove .*Arsenal/ })[0]);
    expect(screen.getByRole("button", { name: /Add to Basket/ })).toBeTruthy();
    expect(screen.queryByLabelText("Selected match basket")).toBeNull(); expect(screen.queryByRole("button", { name: "Continue to Payment" })).toBeNull();
  });

  it("shows Continue Payment for an existing checkout on the first render without another transaction", () => {
    const checkout = pending();
    render(<MatchBasket choices={[{ ...choice(), pendingCheckout: checkout }]}><MatchRow prediction={toPredictionPreview(prediction)} /></MatchBasket>);
    expect(screen.getByRole("link", { name: "Continue Payment" }).getAttribute("href")).toBe(checkout.authorizationUrl);
    expect(screen.queryByRole("button", { name: /Add to Basket/ })).toBeNull(); expect(requests).not.toHaveBeenCalled(); expect(initialize).not.toHaveBeenCalled();
  });

  it("recovers a checkout discovered after Add to Basket without creating another quote or initializing payment", async () => {
    const checkout = pending(); render(card()); fireEvent.click(screen.getByRole("button", { name: /Add to Basket/ }));
    await screen.findAllByRole("link", { name: "Continue Payment" });
    expect(quotes).toHaveLength(1); expect(payments).toHaveLength(1); expect(initialize).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Continue to Payment" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Continue Payment" })[0].getAttribute("href")).toBe(checkout.authorizationUrl);
  });

  it("keeps an ambiguous provider initialization reserved and routes retries to the original payment status", async () => {
    initialize.mockRejectedValueOnce(new Error("Provider timeout after acceptance"));
    render(card()); fireEvent.click(screen.getByRole("button", { name: /Add to Basket/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Continue to Payment" }));
    const links = await screen.findAllByRole("link", { name: "Check Payment Status" });
    expect(links[0].getAttribute("href")).toContain(encodeURIComponent(payments[0].provider_reference));
    expect(screen.queryByRole("button", { name: "Continue to Payment" })).toBeNull();
    expect(payments).toHaveLength(1); expect(initialize).toHaveBeenCalledOnce(); expect(entitlements.size).toBe(0);
  });

  it.each(["owned", "Full Access"])("never renders a payment CTA for %s access", () => {
    render(card(true));
    expect(screen.getByText("Premium Intelligence Unlocked")).toBeTruthy(); expect(screen.getByRole("link", { name: /View Match Intelligence/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add to Basket|Continue.*Payment/ })).toBeNull(); expect(requests).not.toHaveBeenCalled();
  });

  it("explains closed purchasing and disables purchase after kickoff", () => {
    prediction.kickoff_at = "2020-01-01T12:00:00Z"; render(card());
    expect((screen.getByRole("button", { name: "Purchase closed" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Purchasing has closed for this match.")).toBeTruthy(); expect(requests).not.toHaveBeenCalled();
  });

  it("expires the visible server quote and disables payment without creating a transaction", async () => {
    vi.useFakeTimers();
    render(card());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Add to Basket/ })); });
    expect(screen.getByRole("button", { name: "Continue to Payment" })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(MATCH_PRICING_POLICY.quoteLifetimeMs + 10); });
    expect((screen.getByRole("button", { name: "Continue to Payment" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Review new quote" })).toBeTruthy(); expect(initialize).not.toHaveBeenCalled();
  });

  it("rejects cross-day additions with a visible explanation", async () => {
    const other = { ...choice(), matchId: `fm_${"b".repeat(32)}`, label: "Different day", kickoffAt: new Date(Date.parse(prediction.kickoff_at!) + 86_400_000).toISOString() };
    render(<MatchBasket choices={[choice(), other]}><MatchSelection matchId={id} /><MatchSelection matchId={other.matchId} /></MatchBasket>);
    fireEvent.click(screen.getByRole("button", { name: /Add to Basket: Premier/ }));
    await screen.findByRole("button", { name: "Continue to Payment" });
    fireEvent.click(screen.getByRole("button", { name: "Add to Basket: Different day" }));
    expect(screen.getByRole("alert").textContent).toContain("same Ghana calendar day"); expect(screen.getAllByText("Added ✓")).toHaveLength(1);
  });
  it("ignores a late quote for the previous selection and uses the new server total", async () => {
    let resolveOld!: (response: Response) => void;
    requests.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; }));
    const other = { ...choice(), matchId: `fm_${"b".repeat(32)}`, label: "Second fixture" };
    mocks.upcoming.mockResolvedValue([prediction, { ...prediction, match_id: other.matchId, home_team: "Lens", away_team: "Sporting CP" }]);
    render(<MatchBasket choices={[choice(), other]}><MatchSelection matchId={id} /><MatchSelection matchId={other.matchId} /></MatchBasket>);
    fireEvent.click(screen.getByRole("button", { name: /Add to Basket: Premier/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add to Basket: Second fixture" }));
    await screen.findByRole("button", { name: "Continue to Payment" });
    expect(within(screen.getByLabelText("Selected match basket")).getByText("GH₵15")).toBeTruthy();
    await act(async () => { resolveOld(Response.json({ quote: { ...quotes[0], total_pesewas: 800 } })); });
    expect(within(screen.getByLabelText("Selected match basket")).getByText("GH₵15")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue to Payment" }));
    await waitFor(() => expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ amount: "1500" })));
  });
  it("prevents double-click initialization while the first request is in flight", async () => {
    let release!: () => void;
    const accepted = new Promise<void>(resolve => { release = resolve; });
    initialize.mockImplementationOnce(async (args: { reference: string }) => { await accepted; return { reference: args.reference, authorization_url: "https://checkout.paystack.com/unit-only" }; });
    render(card()); fireEvent.click(screen.getByRole("button", { name: /Add to Basket/ }));
    const pay = await screen.findByRole("button", { name: "Continue to Payment" });
    fireEvent.click(pay); fireEvent.click(pay);
    await waitFor(() => expect(initialize).toHaveBeenCalledOnce());
    await act(async () => { release(); });
    expect(requests.mock.calls.filter(([url]) => url === "/api/payments/paystack/initialize")).toHaveLength(1);
  });
  it("offers sign-in after selection for an anonymous visitor without accessing Paystack", async () => {
    mocks.user.mockResolvedValue(null); render(card());
    fireEvent.click(screen.getByRole("button", { name: /Add to Basket/ }));
    expect((await screen.findByRole("link", { name: "Sign in to review your price and purchase" })).getAttribute("href")).toBe("/login?next=/matches");
    expect(initialize).not.toHaveBeenCalled(); expect(payments).toHaveLength(0);
  });
});
