import type {SupabaseClient} from "@supabase/supabase-js";
import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {getCustomerAccessWith,capabilities} from "./access";
import {hasPredictionAccess} from "./match-access";
const customer={id:"customer-owner",email:null};
function client(data:unknown,error:unknown=null){
 const chain={select:vi.fn(),eq:vi.fn(),in:vi.fn(),lte:vi.fn(),or:vi.fn(),order:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data,error})};
 for(const method of ["select","eq","in","lte","or","order","limit"] as const)chain[method].mockReturnValue(chain);
 return {chain,supabase:{from:vi.fn().mockReturnValue(chain)} as unknown as SupabaseClient};
}
describe("active database owners have full lifecycle Premium access",()=>{
 it("grants all capabilities from the protected role without subscription or purchase",async()=>{
  const admin=client({role:"owner",is_active:true}),normal=client(null);
  const access=await getCustomerAccessWith(customer,normal.supabase,new Date(),admin.supabase);
  expect(access.owner).toBe(true);expect([...access.capabilities]).toEqual(Object.values(capabilities));
  expect(admin.supabase.from).toHaveBeenCalledWith("admin_users");expect(admin.chain.eq).toHaveBeenCalledWith("user_id",customer.id);
  expect(normal.supabase.from).not.toHaveBeenCalled();
  for(const stage of ["prematch","live","halftime"] as const){
   expect(await hasPredictionAccess({access,supabase:normal.supabase,matchId:`fm_${"a".repeat(32)}`,stage})).toBe(true);
  }
  expect(normal.supabase.from).not.toHaveBeenCalled();
 });
 it.each([{role:"owner",is_active:false},{role:"admin",is_active:true},{role:"support",is_active:true},null])("does not grant owners' capabilities for %j",async row=>{
  const access=await getCustomerAccessWith(customer,client(null).supabase,new Date(),client(row).supabase);
  expect(access.owner).not.toBe(true);expect(access.capabilities.size).toBe(0);
 });
 it("fails closed on admin lookup error and never queries an anonymous role",async()=>{
  const admin=client(null,{message:"unavailable"});
  expect((await getCustomerAccessWith(customer,client(null).supabase,new Date(),admin.supabase)).capabilities.size).toBe(0);
  admin.supabase.from=vi.fn();
  expect((await getCustomerAccessWith(null,client(null).supabase,new Date(),admin.supabase)).owner).not.toBe(true);
  expect(admin.supabase.from).not.toHaveBeenCalled();
 });
});
