import { requireAdmin } from "@/lib/admin/auth";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { matchPricingV2Enabled } from "@/lib/payments/pricing-version";
import { formatPesewas, formatEffectivePrice, type BasketFixture } from "@/lib/payments/match-pricing";
import { AdminShell, AdminEmpty } from "../admin-shell";

export default async function BasketPaymentsPage() {
  const admin = await requireAdmin();
  if (!matchPricingV2Enabled()) return <AdminShell admin={admin}><AdminEmpty>Pricing V2 is not activated.</AdminEmpty></AdminShell>;
  const result = await getServerSupabaseClient().from("match_basket_payments").select("id,user_id,provider_reference,status,created_at,paid_at,match_basket_quotes!inner(fixtures,ghana_date,match_count,unit_pesewas,total_pesewas,policy_version),customer_match_entitlements(match_id)").order("created_at",{ascending:false}).limit(100);
  if (result.error) throw new Error("Basket payment records unavailable");
  const rows = result.data as unknown as { id:string;user_id:string;provider_reference:string;status:string;created_at:string;paid_at:string|null;match_basket_quotes:{fixtures:BasketFixture[];ghana_date:string;match_count:number;unit_pesewas:number|null;total_pesewas:number;policy_version:string};customer_match_entitlements:{match_id:string}[] }[];
  return <AdminShell admin={admin}><header className="admin-heading"><h1>Pricing V2 Basket Payments</h1><p>Latest 100 transactions. Read-only verification and permanent ownership evidence. Legacy payment records remain in Payments.</p></header>{rows.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{["Reference","Customer","Fixtures / Ghana day","Price","Status","Permanent grants"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(item=><tr key={item.id}><td>{item.provider_reference}</td><td>…{item.user_id.slice(-8)}</td><td>{item.match_basket_quotes.ghana_date}<ul>{item.match_basket_quotes.fixtures.map(fixture=><li key={fixture.match_id}>{fixture.competition}: {fixture.home_team} vs {fixture.away_team}<small> {fixture.match_id}</small></li>)}</ul></td><td>{formatPesewas(item.match_basket_quotes.total_pesewas)}<small> {item.match_basket_quotes.match_count} matches; {formatEffectivePrice(item.match_basket_quotes)} effective per match</small></td><td>{item.status}</td><td>{item.customer_match_entitlements.length} / {item.match_basket_quotes.match_count}</td></tr>)}</tbody></table></div> : <AdminEmpty>No basket payments.</AdminEmpty>}</AdminShell>;
}
