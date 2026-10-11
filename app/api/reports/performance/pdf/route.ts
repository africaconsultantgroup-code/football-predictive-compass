import {performancePeriod} from "@/lib/reports/performance";
import {loadPerformanceReport} from "@/lib/reports/performance-server";
import {renderPerformancePdf} from "@/lib/reports/performance-pdf";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const period=performancePeriod(new URL(request.url).searchParams.get("period"));
 try{const report=await loadPerformanceReport(period);const pdf=await renderPerformancePdf(report);
  return new Response(new Uint8Array(pdf),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="predictive-compass-performance-${report.window.from}-${report.window.to}.pdf"`,"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch{return Response.json({error:"Official performance report is temporarily unavailable."},{status:503,headers:{"cache-control":"no-store"}});}
}
