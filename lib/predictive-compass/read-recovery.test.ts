import {describe,it,expect,vi} from "vitest";
import {recoverRead,boundedReadMap} from "./read-recovery";
describe("read-only recovery",()=>{
 it("recovers once from 5xx and preserves the second response",async()=>{const call=vi.fn().mockResolvedValueOnce(new Response("down",{status:503})).mockResolvedValueOnce(Response.json({ok:true}));expect((await recoverRead(call)).status).toBe(200);expect(call).toHaveBeenCalledTimes(2);});
 it.each(["TypeError","AbortError","TimeoutError"])("recovers transient %s once",async name=>{const error=new Error("sanitized");error.name=name;const call=vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(Response.json({}));expect((await recoverRead(call)).status).toBe(200);expect(call).toHaveBeenCalledTimes(2);});
 it.each([400,401,403,404])("never retries HTTP %i",async status=>{const call=vi.fn().mockResolvedValue(new Response(null,{status}));expect((await recoverRead(call)).status).toBe(status);expect(call).toHaveBeenCalledTimes(1);});
 it("does not retry parsing errors or arbitrary exceptions",async()=>{const call=vi.fn().mockRejectedValue(new SyntaxError("invalid JSON"));await expect(recoverRead(call)).rejects.toThrow();expect(call).toHaveBeenCalledTimes(1);});
 it("bounds repeated failures to two requests",async()=>{const call=vi.fn().mockRejectedValue(new TypeError("offline"));await expect(recoverRead(call)).rejects.toThrow();expect(call).toHaveBeenCalledTimes(2);});
 it("bounds concurrent owned reads without duplicating or reordering matches",async()=>{let active=0,peak=0;const values=Array.from({length:15},(_,i)=>i);const output=await boundedReadMap(values,async value=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,1));active--;return value;});expect(peak).toBeLessThanOrEqual(4);expect(output).toEqual(values);});
});
