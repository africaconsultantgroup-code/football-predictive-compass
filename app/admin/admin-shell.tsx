import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminIdentity } from "@/lib/admin/auth";
import { logoutAction } from "@/app/auth-actions";

const links=[["Overview","/admin"],["Payments","/admin/payments"],["Access","/admin/access"]] as const;
export function AdminShell({admin,children}:{admin:AdminIdentity;children:ReactNode}){return <div className="admin-app"><aside className="admin-sidebar"><Link className="admin-brand" href="/admin">Predictive Compass<small>Internal operations</small></Link><nav>{links.map(([label,href])=><Link href={href} key={href}>{label}</Link>)}{["Customers","Products","Predictions","System"].map(x=><span aria-disabled="true" key={x}>{x}<small>Later</small></span>)}</nav></aside><div className="admin-workspace"><header className="admin-topbar"><div><b>Admin Control Center</b><span>{admin.email||`User …${admin.id.slice(-8)}`} · {admin.role}</span></div><div><Link href="/">Customer site</Link><form action={logoutAction}><button>Log out</button></form></div></header><main>{children}</main></div></div>}
export function AdminEmpty({children}:{children:ReactNode}){return <div className="admin-empty">{children}</div>}
