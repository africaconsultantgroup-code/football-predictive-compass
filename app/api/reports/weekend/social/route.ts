import {loadWeekendExport} from "@/lib/reports/weekend-export";
import {renderWeekendSocial,SOCIAL_PAGE_SIZE} from "@/lib/reports/weekend-social";
export const runtime="nodejs";
export const maxDuration=300;
export async function GET(request:Request) {
 const report=await loadWeekendExport(request);if(report instanceof Response)return report;
 const raw=new URL(request.url).searchParams.get("page"),page=raw===null?1:Number(raw);
 if(!Number.isInteger(page)||page<1||page>Math.max(1,Math.ceil(report.matches.length/SOCIAL_PAGE_SIZE)))return Response.json({error:"Invalid social report page."},{status:400});
 try{return renderWeekendSocial(report,page);}catch{return Response.json({error:"Social report generation is temporarily unavailable."},{status:503,headers:{"cache-control":"private, no-store"}});}
}
