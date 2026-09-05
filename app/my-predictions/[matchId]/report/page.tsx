import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerShell } from "@/app/customer-shell";
import { requireUser } from "@/lib/auth/session";
import { footballMatchIdSchema } from "@/lib/predictive-compass/schema";
import { loadPostMatchReport, ReportAccessError, type PostMatchReport } from "@/lib/reports/post-match";
import { ReportView } from "./report-view";

export const dynamic="force-dynamic";
async function resolve(userId:string,matchId:string):Promise<{report:PostMatchReport|null;pending:boolean}>{try{return {report:await loadPostMatchReport(userId,matchId),pending:false}}catch(e){if(e instanceof ReportAccessError&&e.code==="unauthorized")notFound();if(e instanceof ReportAccessError&&e.code==="not_final")return {report:null,pending:true};throw e}}
export default async function ReportPage({params}:{params:Promise<{matchId:string}>}){const user=await requireUser(),parsed=footballMatchIdSchema.safeParse((await params).matchId);if(!parsed.success)notFound();const state=await resolve(user.id,parsed.data);if(state.pending)return <CustomerShell authenticated><div className="customer-empty"><h1>Post-match report is being finalized.</h1><p>The report becomes available only after Core confirms the official FINAL result.</p><Link href="/my-predictions">Return to My Predictions</Link></div></CustomerShell>;return <CustomerShell authenticated><div className="report-actions"><Link href="/my-predictions">← My Predictions</Link><a className="hero-primary" href={`/api/reports/matches/${parsed.data}/pdf`}>Download PDF</a></div><ReportView report={state.report!}/></CustomerShell>}
