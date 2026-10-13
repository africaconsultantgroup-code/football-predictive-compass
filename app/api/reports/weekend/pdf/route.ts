import {loadWeekendExport} from "@/lib/reports/weekend-export";
import {renderWeekendPdf} from "@/lib/reports/weekend-pdf";
export const runtime="nodejs";
export const maxDuration=300;
export async function GET(request:Request) {
 const report=await loadWeekendExport(request);if(report instanceof Response)return report;
 try{const pdf=await renderWeekendPdf(report);return new Response(new Uint8Array(pdf),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="predictive-compass-weekend-${report.range.from}-${report.range.to}.pdf"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});}catch{return Response.json({error:"PDF generation is temporarily unavailable."},{status:503,headers:{"cache-control":"private, no-store"}});}
}
