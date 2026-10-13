import Link from "next/link";
export function ReportNavigation({official = false}: {official?: boolean}) {
  return <nav className="report-navigation" aria-label="Performance reports"><Link href="/performance" aria-current={!official ? "page" : undefined}>Weekend Report</Link><Link href="/performance?report=official" aria-current={official ? "page" : undefined}>Official Performance</Link></nav>;
}
