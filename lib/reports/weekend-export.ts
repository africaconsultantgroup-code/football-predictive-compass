import "server-only";
import {validRange} from "./weekend";
import {loadWeekendReport} from "./weekend-server";
export async function loadWeekendExport(request:Request) {
 const query=new URL(request.url).searchParams;
 let range;
 try{range=validRange(query.get("from"),query.get("to"));}catch{return Response.json({error:"Choose an inclusive date range of 1 to 31 days."},{status:400,headers:{"cache-control":"private, no-store"}});}
 try{const report=await loadWeekendReport(range);if(report.incomplete)throw new Error("Incomplete report");return report;}
 catch{return Response.json({error:"The complete report is temporarily unavailable. Retry before downloading."},{status:503,headers:{"cache-control":"private, no-store"}});}
}
