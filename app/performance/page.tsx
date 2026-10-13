import {connection} from "next/server";
import {getCurrentUser} from "../../lib/auth/session";
import {CustomerShell} from "../customer-shell";
import {performancePeriod,performanceWindow,summarizePerformance,type PerformanceReport} from "../../lib/reports/performance";
import {loadPerformanceReport} from "../../lib/reports/performance-server";
import {PerformanceView} from "./performance-view";
import "./performance.css";
import "./weekend/weekend.css";
import {loadWeekendReport} from "../../lib/reports/weekend-server";
import {WeekendView} from "./weekend/weekend-view";
import {ReportNavigation} from "./report-navigation";
import {AutomaticRefresh} from "../automatic-refresh";
export const maxDuration=300;
export default async function PerformancePage({searchParams}:{searchParams:Promise<{period?:string;report?:string}>}){
 await connection();const params=await searchParams,period=performancePeriod(params.period);
 if(params.report!=="official"&&!params.period){
  const [user,weekend]=await Promise.all([getCurrentUser(),loadWeekendReport(null).catch(()=>null)]);
  return <CustomerShell authenticated={Boolean(user)}><AutomaticRefresh interval={60000}/><ReportNavigation/><WeekendView report={weekend} integrated/></CustomerShell>;
 }
 const user=await getCurrentUser();let report:PerformanceReport,unavailable=false;
 try{report=await loadPerformanceReport(period);}catch{unavailable=true;report={window:performanceWindow(period),matches:[],summary:summarizePerformance([])};}
 return <CustomerShell authenticated={Boolean(user)}><AutomaticRefresh interval={60000}/><ReportNavigation official/><PerformanceView report={report} unavailable={unavailable}/></CustomerShell>;
}
