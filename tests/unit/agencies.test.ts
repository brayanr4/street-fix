import { describe, expect, it } from "vitest";
import { COUNCILS, DIT, ESCALATION_STEPS, getAgency, guessCouncil, routeIssue, SAPN } from "@/lib/agencies";
import { ISSUE_TYPES } from "@/lib/types";

describe("routeIssue", () => {
  it("sends streetlights to SA Power Networks wherever they are", () => {
    expect(routeIssue("streetlight", "unley", false).id).toBe("sapn");
    expect(routeIssue("streetlight", "unley", true).id).toBe("sapn");
  });

  it("sends main-road potholes, signs and drains to DIT", () => {
    for (const t of ["pothole", "signage", "drainage"] as const) {
      expect(routeIssue(t, "marion", true)).toBe(DIT);
    }
  });

  it("keeps everything else with the council, even on main roads", () => {
    for (const t of ["graffiti", "dumping", "tree", "footpath", "other"] as const) {
      expect(routeIssue(t, "marion", true).id).toBe("marion");
    }
    expect(routeIssue("pothole", "marion", false).id).toBe("marion");
  });

  it("routes every issue type for every council to a real https link", () => {
    for (const c of COUNCILS) {
      for (const t of ISSUE_TYPES) {
        for (const main of [true, false]) {
          const a = routeIssue(t, c.id, main);
          expect(a.url).toMatch(/^https:\/\//);
          expect(a.ombudsman.url).toMatch(/^https:\/\//);
        }
      }
    }
  });
});

describe("getAgency", () => {
  it("resolves the state agencies and councils by id", () => {
    expect(getAgency("sapn")).toBe(SAPN);
    expect(getAgency("dit")).toBe(DIT);
    expect(getAgency("unley").name).toBe("City of Unley");
  });

  it("falls back to the City of Adelaide for an unknown council id", () => {
    expect(getAgency("nowhere").name).toBe("City of Adelaide");
  });
});

describe("guessCouncil", () => {
  it("matches council names in reverse-geocoding results", () => {
    expect(guessCouncil(["Unley Road", "Unley", "City of Unley", "5061"])).toBe("unley");
    expect(guessCouncil(["Adelaide", "City of Adelaide"])).toBe("adelaide");
    expect(guessCouncil(["Port Adelaide", "City of Port Adelaide Enfield"])).toBe("pae");
  });

  it("does not confuse Adelaide Hills or Port Adelaide with the City of Adelaide", () => {
    expect(guessCouncil(["Stirling", "Adelaide Hills Council"])).toBe("adelaide-hills");
    expect(guessCouncil(["Port Adelaide"])).toBe("pae");
  });

  it("returns null when nothing matches", () => {
    expect(guessCouncil(["Sydney", "New South Wales"])).toBeNull();
  });

  it("has unique council ids", () => {
    expect(new Set(COUNCILS.map((c) => c.id)).size).toBe(COUNCILS.length);
  });
});

describe("escalation ladder", () => {
  it("has five steps with positive waits", () => {
    expect(ESCALATION_STEPS).toHaveLength(5);
    for (const s of ESCALATION_STEPS) expect(s.waitDays).toBeGreaterThan(0);
  });
});
