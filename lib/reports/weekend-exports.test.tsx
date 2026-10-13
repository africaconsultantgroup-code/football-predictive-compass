import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {renderWeekendPdf} from "./weekend-pdf";
import {renderWeekendSocial} from "./weekend-social";
import {completedFixturesSchema} from "./weekend-contract";
import completed from "./weekend-completed.fixture.json";
import {makeWeekendReport,projectWeekendMatch} from "./weekend";
const source=completedFixturesSchema.parse(completed),report=makeWeekendReport({from:source.from,to:source.to},source.matches.map(f=>projectWeekendMatch(f,{free:null,premium:null,allowed:false,official:[]})));
vi.mock("./weekend-server",()=>({loadWeekendReport:vi.fn()}));
import {loadWeekendReport} from "./weekend-server";
import {GET as pdfGET} from "../../app/api/reports/weekend/pdf/route";
import {GET as socialGET} from "../../app/api/reports/weekend/social/route";
describe("weekend exports",()=>{
 it("generates a real PDF from all ten report rows",async()=>{const pdf=await renderWeekendPdf(report);expect(pdf.subarray(0,4).toString()).toBe("%PDF");expect(pdf.length).toBeGreaterThan(2000);},20000);
 it("generates a 1080x1350 PNG from the same projection",async()=>{const response=renderWeekendSocial(report),bytes=Buffer.from(await response.arrayBuffer());expect(bytes.subarray(1,4).toString()).toBe("PNG");expect(bytes.readUInt32BE(16)).toBe(1080);expect(bytes.readUInt32BE(20)).toBe(1350);},20000);
 it("validates social pagination without dropping later fixtures",async()=>{expect(()=>renderWeekendSocial(report,2)).toThrow();const larger={...report,matches:[...report.matches,...report.matches]};expect((await renderWeekendSocial(larger,2).arrayBuffer()).byteLength).toBeGreaterThan(1000);},20000);
 it("both routes load the same server-enforced projection and prevent shared caching",async()=>{vi.mocked(loadWeekendReport).mockResolvedValue(report);for(const handler of [pdfGET,socialGET]){const response=await handler(new Request("https://customer.example/api?from=2026-10-10&to=2026-10-12"));expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("private");await response.arrayBuffer();}expect(loadWeekendReport).toHaveBeenCalledWith({from:source.from,to:source.to});},20000);
 it("rejects invalid dates, invalid social pages and incomplete source downloads",async()=>{expect((await pdfGET(new Request("https://customer.example/api?from=bad"))).status).toBe(400);vi.mocked(loadWeekendReport).mockResolvedValue({...report,incomplete:true});expect((await pdfGET(new Request("https://customer.example/api"))).status).toBe(503);vi.mocked(loadWeekendReport).mockResolvedValue(report);expect((await socialGET(new Request("https://customer.example/api?page=2"))).status).toBe(400);});
});
