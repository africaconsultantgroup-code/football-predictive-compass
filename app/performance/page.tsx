import {connection} from "next/server";
import {getCurrentUser} from "../../lib/auth/session";
import {CustomerShell} from "../customer-shell";
import {performancePeriod,performanceWindow,summarizePerformance,type PerformanceReport} from "../../lib/reports/performance";
import {loadPerformanceReport} from "../../lib/reports/performance-server";
import {PerformanceView} from "./performance-view";
import "./performance.css";
export default async function PerformancePage({searchParams}:{searchParams:Promise<{period?:string}>}){
 await connection();const period=performancePeriod((await searchParams).period);
 const user=await getCurrentUser();let report:PerformanceReport,unavailable=false;
 try{report=await loadPerformanceReport(period);}catch{unavailable=true;report={window:performanceWindow(period),matches:[],summary:summarizePerformance([])};}
 return <CustomerShell authenticated={Boolean(user)}><PerformanceView report={report} unavailable={unavailable}/></CustomerShell>;
}
