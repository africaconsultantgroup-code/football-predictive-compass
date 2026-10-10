// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { TeamIdentity, TeamIdentityProvider } from "./team-identity";
import { resolveTeamIdentity } from "../lib/teams/identity";
afterEach(cleanup);
describe("non-blocking crest rendering",()=>{
  it("uses supplied football-data crest, then canonical API logo, then initials on image errors",()=>{
    const team=resolveTeamIdentity("Arsenal",{footballDataId:57,footballDataCrest:"https://crests.football-data.org/57.png",apiFootballId:42});
    const {container}=render(<TeamIdentity name="Arsenal" team={team}/>);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://crests.football-data.org/57.png");
    expect(container.querySelector("img")?.getAttribute("loading")).toBe("lazy");
    expect(container.querySelector("img")?.getAttribute("width")).toBe("32");
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://media.api-sports.io/football/teams/42.png");
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();expect(container.textContent).toBe("AArsenal");
  });
  it("renders cached team identity immediately without fetching any metadata",()=>{
    const fetch=vi.spyOn(globalThis,"fetch");const team=resolveTeamIdentity("Arsenal",{apiFootballId:42});
    const {container}=render(<TeamIdentityProvider teams={[team]}><TeamIdentity name="Arsenal"/></TeamIdentityProvider>);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("/42.png");expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();
  });
  it("keeps the team name and usable layout when no safe crest is known",()=>{
    const {container}=render(<TeamIdentity name="Sabah FA" crest="https://fan.example/logo.png"/>);
    expect(container.querySelector("img")).toBeNull();expect(container.textContent).toBe("SFSabah FA");
  });
});
