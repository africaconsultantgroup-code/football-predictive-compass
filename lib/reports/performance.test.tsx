import {describe,it,expect,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
vi.mock("server-only",()=>({}));
import {performanceWindow,performancePeriod,summarizePerformance,PERFORMANCE_EMPTY,type PerformanceMatch} from "./performance";
import {PerformanceView} from "../../app/performance/performance-view";
import {renderPerformancePdf} from "./performance-pdf";
const now=new Date("2026-10-11T12:00:00Z");
const match:PerformanceMatch={competition:"Premier League",homeTeam:"Arsenal",awayTeam:"Leeds",kickoffAt:"2026-10-10T11:30:00Z",compassPick:"Arsenal Win",probability:55.95,strength:"Cautious",scoreForecast:{home:2,away:0},actualScore:{home:2,away:0},pickCorrect:true,exactCorrect:true};
const report=(matches:PerformanceMatch[])=>({window:performanceWindow("7d",now),matches,summary:summarizePerformance(matches)});
describe("official performance presentation",()=>{
 it.each([[[],0,0,null,0,null],[[match],1,1,100,1,100],[[{...match,pickCorrect:false,exactCorrect:false}],1,0,0,0,0],[[match,{...match,pickCorrect:false,exactCorrect:false}],2,1,50,1,50]] as const)("uses settled official rows for summary metrics",(rows,settled,correct,accuracy,exact,exactAccuracy)=>{
  expect(summarizePerformance([...rows])).toEqual({settled,correct,accuracy,exact,exactAccuracy});
 });
 it("shows an honest zero-record state",()=>{const html=renderToStaticMarkup(<PerformanceView report={report([])}/>);expect(html).toContain(PERFORMANCE_EMPTY);expect(html).not.toContain("100%");expect(html).toContain("Unavailable");});
 it("renders every required safe match field and the same period PDF link",()=>{const html=renderToStaticMarkup(<PerformanceView report={report([match])}/>);for(const text of ["Arsenal vs Leeds","55.95%","Cautious","2–0","Correct","Official Premium Compass Pick","/api/reports/performance/pdf?period=7d"])expect(html).toContain(text);mkdirSync("output",{recursive:true});writeFileSync("output/performance-layout.html",`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#f8fbff;font-family:Arial,sans-serif}a{text-decoration:none}${readFileSync("app/performance/performance.css","utf8")}</style></head><body><p>Illustrative test fixture - not production results</p>${html}</body></html>`);});
 it("shows service failure without false accuracy metrics or PDF link",()=>{const html=renderToStaticMarkup(<PerformanceView report={report([])} unavailable/>);expect(html).toContain("temporarily unavailable");expect(html).not.toContain("Compass Pick Accuracy");expect(html).not.toContain("Download PDF");});
 it("applies inclusive Ghana calendar-day windows",()=>{expect(performanceWindow("today",now).from).toBe("2026-10-11");expect(performanceWindow("7d",now).from).toBe("2026-10-05");expect(performanceWindow("30d",now).from).toBe("2026-09-12");expect(performanceWindow("season",now).from).toBe("2026-07-01");expect(performanceWindow("season",new Date("2026-01-01Z")).from).toBe("2025-07-01");expect(performancePeriod("untrusted")).toBe("7d");});
 it("uses mobile cards with bounded columns and wrapping",()=>{const css=readFileSync("app/performance/performance.css","utf8");expect(css).toContain("minmax(0,1fr)");expect(css).toContain("overflow-wrap:anywhere");expect(css).toContain("max-width:600px");expect(css).toContain("grid-template-columns:1fr");});
 it("generates branded empty and populated PDFs from the same report",async()=>{mkdirSync("output/pdf",{recursive:true});for(const [name,rows] of [["empty",[]],["populated",[match,{...match,homeTeam:"A deliberately long club name to verify wrapping in the report",pickCorrect:false,exactCorrect:false}]]] as const){const pdf=await renderPerformancePdf(report([...rows]));expect(pdf.subarray(0,5).toString()).toBe("%PDF-");expect(pdf.length).toBeGreaterThan(1000);writeFileSync(`output/pdf/performance-${name}.pdf`,pdf);}},15000);
});
