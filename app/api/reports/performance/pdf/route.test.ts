import {describe,it,expect,vi,beforeEach} from "vitest";
const mocks=vi.hoisted(()=>({load:vi.fn(),render:vi.fn()}));
vi.mock("@/lib/reports/performance-server",()=>({loadPerformanceReport:mocks.load}));
vi.mock("@/lib/reports/performance-pdf",()=>({renderPerformancePdf:mocks.render}));
import {GET} from "./route";
import {performanceWindow,summarizePerformance} from "@/lib/reports/performance";
const report={window:performanceWindow("30d",new Date("2026-10-11Z")),matches:[],summary:summarizePerformance([])};
beforeEach(()=>{vi.clearAllMocks();mocks.load.mockResolvedValue(report);mocks.render.mockResolvedValue(Buffer.from("%PDF-test"));});
describe("official performance PDF download",()=>{
 it("uses the shared official loader and exactly its filtered data",async()=>{const response=await GET(new Request("https://customer.example/api/reports/performance/pdf?period=30d&source=free&from=2000-01-01"));expect(mocks.load).toHaveBeenCalledWith("30d");expect(mocks.render).toHaveBeenCalledWith(report);expect(response.status).toBe(200);expect(response.headers.get("content-type")).toBe("application/pdf");expect(response.headers.get("content-disposition")).toContain("2026-09-12-2026-10-11.pdf");expect(response.headers.get("cache-control")).toBe("no-store");});
 it("uses the same default period as the page",async()=>{await GET(new Request("https://customer.example/api/reports/performance/pdf?period=invalid"));expect(mocks.load).toHaveBeenCalledWith("7d");});
 it("does not generate a fabricated empty PDF when Core is unavailable",async()=>{mocks.load.mockRejectedValue(Error("private Core error"));const response=await GET(new Request("https://customer.example/api/reports/performance/pdf"));expect(response.status).toBe(503);expect(mocks.render).not.toHaveBeenCalled();expect(await response.text()).not.toContain("private Core error");});
});
