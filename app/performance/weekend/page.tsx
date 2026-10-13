import {connection} from "next/server";
import {CustomerShell} from "../../customer-shell";
import {getCurrentUser} from "../../../lib/auth/session";
import {loadWeekendReport} from "../../../lib/reports/weekend-server";
import {validRange,type WeekendReport} from "../../../lib/reports/weekend";
import {WeekendView} from "./weekend-view";
import "./weekend.css";
export const maxDuration=300;
export default async function WeekendPage({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}) {
 await connection();const userPromise=getCurrentUser();const params=await searchParams;
 let report:WeekendReport|null=null,error:string|undefined;
 try{const range=validRange(params.from,params.to);report=await loadWeekendReport(range);}catch(e){error=e instanceof Error&&e.message.startsWith("Choose an inclusive")?e.message:"Weekend reports are temporarily unavailable. Please try again shortly.";}
 return <CustomerShell authenticated={Boolean(await userPromise)}><WeekendView report={report} error={error}/></CustomerShell>;
}
