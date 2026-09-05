import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({notFound:vi.fn(),redirect:vi.fn()}));
import { resolveAdmin } from "./auth";
import { isPaymentAnomaly, type AdminPayment } from "./data";

const payment:AdminPayment={id:"payment",userId:"user",customer:"Customer",email:null,productId:"product",product:"Fixture",scope:"match",stage:"prematch",amount:20,currency:"GHS",status:"successful",reference:"reference",grantId:"grant",grantStatus:"Granted",accessStatus:"Active",createdAt:"2026-09-05T08:00:00Z",updatedAt:"2026-09-05T08:00:00Z",paidAt:"2026-09-05T08:00:00Z",matches:[]};
function client(data:unknown){return {from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data,error:null})})})})} as never}

describe("admin control center security",()=>{
  it("authorizes active database roles and denies customers, inactive roles and anonymous users",async()=>{
    await expect(resolveAdmin({id:"user",email:"owner@example.com"},client({role:"owner",is_active:true}))).resolves.toMatchObject({role:"owner"});
    await expect(resolveAdmin({id:"user",email:null},client(null))).resolves.toBeNull();
    await expect(resolveAdmin({id:"user",email:null},client({role:"admin",is_active:false}))).resolves.toBeNull();
    await expect(resolveAdmin(null,client({role:"owner",is_active:true}))).resolves.toBeNull();
  });
  it("keeps role membership server-only and impossible for customers to mutate",()=>{const sql=readFileSync("supabase/migrations/20260905083213_admin_control_center_phase_one.sql","utf8");expect(sql).toContain("references auth.users(id)");expect(sql).toContain("enable row level security");expect(sql).toContain("revoke all on table public.admin_users from public, anon, authenticated");expect(sql).not.toMatch(/grant .*admin_users to (anon|authenticated)/i);expect(readFileSync("lib/admin/auth.ts","utf8")).toContain('import "server-only"');});
  it("never exposes admin routes in customer navigation",()=>expect(readFileSync("app/site-navigation.tsx","utf8")).not.toMatch(/\/admin/));
});

describe("read-only operational anomalies",()=>{
  it("does not flag a successful payment with active grant",()=>expect(isPaymentAnomaly(payment)).toBeNull());
  it("flags successful payment without access",()=>expect(isPaymentAnomaly({...payment,grantId:null,grantStatus:"Missing",accessStatus:"Inactive"})).toBe("PAID — ACCESS ISSUE"));
  it("flags grant failure and stale pending but not ordinary failed payments",()=>{expect(isPaymentAnomaly({...payment,status:"grant_failed"})).toBe("GRANT FAILED");expect(isPaymentAnomaly({...payment,status:"pending",createdAt:"2026-09-05T07:00:00Z"},new Date("2026-09-05T08:00:00Z"))).toBe("STALE PENDING PAYMENT");expect(isPaymentAnomaly({...payment,status:"failed"})).toBeNull()});
  it("contains no financial or access mutation controls",()=>{const files=["app/admin/page.tsx","app/admin/payments/page.tsx","app/admin/access/page.tsx"].map(x=>readFileSync(x,"utf8")).join("\n");expect(files).not.toMatch(/refund|reverse payment|create grant|revoke grant|force success|delete payment/i)});
  it("keeps CSV allowlisted and export server-authorized",()=>{const route=readFileSync("app/admin/payments/export/route.ts","utf8");expect(route).toContain("await requireAdmin()");expect(route).not.toMatch(/secret|cvv|otp|card|authorization/i)});
});
