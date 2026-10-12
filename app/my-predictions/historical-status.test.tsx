import {beforeEach,describe,it,expect,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({matches:vi.fn()}));
vi.mock("../customer-shell",()=>({CustomerShell:({children}:{children:React.ReactNode})=>children,PageHeader:()=>null,EmptyState:({title}:{title:string})=><p>{title}</p>}));
vi.mock("../../lib/auth/session",()=>({requireUser:async()=>({id:"customer"})}));
vi.mock("../../lib/auth/access",()=>({getCustomerAccess:async()=>({customer:{id:"customer"}})}));
vi.mock("../../lib/reports/post-match",()=>({listCustomerMatches:mocks.matches}));
import Page from "./page";
const match={matchId:`fm_${"a".repeat(32)}`,homeTeam:"Arsenal",awayTeam:"Leeds",competition:"Premier League",kickoffAt:"2026-10-10T11:30:00Z",purchased:true,purchasedStages:["prematch"],isFinal:true,finalScore:{home:2,away:1},amount:null,currency:null,historicalPremiumAvailable:true,historicalPremiumClassification:"LEGACY PRE-MATCH INTELLIGENCE"};
beforeEach(()=>vi.clearAllMocks());
describe("completed historical Premium discoverability",()=>{
 it("shows Legacy status and View Match Intelligence on the actual owned card",async()=>{mocks.matches.mockResolvedValue([match]);const html=renderToStaticMarkup(await Page());expect(html).toContain('class="historical-premium-badge"');expect(html).toContain("LEGACY PRE-MATCH INTELLIGENCE");expect(html).toContain("View Match Intelligence");expect(html).not.toContain("View Match Report");expect(html).not.toContain("55.95");});
 it("shows the Official badge with a check mark",async()=>{mocks.matches.mockResolvedValue([{...match,historicalPremiumClassification:"OFFICIAL PREMIUM"}]);const html=renderToStaticMarkup(await Page());expect(html).toContain("OFFICIAL PREMIUM ✓");expect(html).toContain("View Match Intelligence");});
 it("keeps the ordinary report action when no frozen Premium exists",async()=>{mocks.matches.mockResolvedValue([{...match,historicalPremiumAvailable:false,historicalPremiumClassification:null}]);const html=renderToStaticMarkup(await Page());expect(html).toContain("View Match Report");expect(html).not.toContain('class="historical-premium-badge"');});
});
