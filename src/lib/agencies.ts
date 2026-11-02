import type { IssueType } from "./types";

// Adelaide routing data, checked against official sites on 2026-11-02. Where a council
// has a dedicated "report an issue" page we link straight to it; otherwise to its
// contact or home page. Council sites move pages often, so re-check every few months.

export type Agency = {
  id: string;
  name: string;
  howToReport: string;
  url: string;
  phone?: string;
  email?: string;
  // Who a complaint escalates to when the agency itself doesn't act.
  ombudsman: { name: string; url: string };
};

const SA_OMBUDSMAN = { name: "Ombudsman SA", url: "https://www.ombudsman.sa.gov.au/make-a-complaint/how-to-make-a-complaint" };
const ENERGY_OMBUDSMAN = {
  name: "Energy and Water Ombudsman SA",
  url: "https://ewosa.com.au/submit-a-complaint",
};

export const COUNCILS = [
  { id: "adelaide", name: "City of Adelaide", site: "https://customer.cityofadelaide.com.au/", match: ["city of adelaide", "adelaide city council"] },
  { id: "adelaide-hills", name: "Adelaide Hills Council", site: "https://www.ahc.sa.gov.au/contact-us", match: ["adelaide hills"] },
  { id: "burnside", name: "City of Burnside", site: "https://burnside.sa.gov.au/Online-Services/Action-Burnside", match: ["burnside"] },
  { id: "campbelltown", name: "Campbelltown City Council", site: "https://www.campbelltown.sa.gov.au", match: ["campbelltown"] },
  { id: "charles-sturt", name: "City of Charles Sturt", site: "https://www.charlessturt.sa.gov.au", match: ["charles sturt"] },
  { id: "gawler", name: "Town of Gawler", site: "https://www.gawler.sa.gov.au/services/customer-service", match: ["gawler"] },
  { id: "holdfast-bay", name: "City of Holdfast Bay", site: "https://www.holdfast.sa.gov.au/report-an-issue", match: ["holdfast"] },
  { id: "marion", name: "City of Marion", site: "https://www.marion.sa.gov.au/about-council/contact-and-connect-with-us", match: ["marion"] },
  { id: "mitcham", name: "City of Mitcham", site: "https://www.mitchamcouncil.sa.gov.au/services/click-and-connect", match: ["mitcham"] },
  { id: "npsp", name: "City of Norwood Payneham & St Peters", site: "https://www.npsp.sa.gov.au/our_services/online_services_listing", match: ["norwood", "payneham"] },
  { id: "onkaparinga", name: "City of Onkaparinga", site: "https://www.onkaparingacity.com/Council", match: ["onkaparinga"] },
  { id: "playford", name: "City of Playford", site: "https://www.playford.sa.gov.au/council/contact-us/playford-online-services", match: ["playford"] },
  { id: "pae", name: "City of Port Adelaide Enfield", site: "https://www.cityofpae.sa.gov.au/connect/contact-us", match: ["port adelaide enfield", "port adelaide"] },
  { id: "prospect", name: "City of Prospect", site: "https://www.prospect.sa.gov.au", match: ["prospect"] },
  { id: "salisbury", name: "City of Salisbury", site: "https://www.salisbury.sa.gov.au", match: ["salisbury"] },
  { id: "tea-tree-gully", name: "City of Tea Tree Gully", site: "https://www.teatreegully.sa.gov.au/council/my.teatreegully-report-an-issue-or-lodge-a-work-request", match: ["tea tree gully"] },
  { id: "unley", name: "City of Unley", site: "https://www.unley.sa.gov.au/Report-an-issue", match: ["unley"] },
  { id: "walkerville", name: "Town of Walkerville", site: "https://www.walkerville.sa.gov.au", match: ["walkerville"] },
  { id: "west-torrens", name: "City of West Torrens", site: "https://www.westtorrens.sa.gov.au/Services/Report-it-report-an-issue", match: ["west torrens"] },
];

export const SAPN: Agency = {
  id: "sapn",
  name: "SA Power Networks",
  howToReport: "Streetlight faults go to SA Power Networks through their online form.",
  url: "https://slo.apps.sapowernetworks.com.au/",
  ombudsman: ENERGY_OMBUDSMAN,
};

export const DIT: Agency = {
  id: "dit",
  name: "Department for Infrastructure and Transport",
  howToReport:
    "Main (state) roads are looked after by the state government. Call the hazard line for anything dangerous, or use their contact form.",
  url: "https://dit.sa.gov.au/contact-us",
  phone: "1800 018 313",
  ombudsman: SA_OMBUDSMAN,
};

export function councilAgency(councilId: string): Agency {
  const c = COUNCILS.find((x) => x.id === councilId) ?? COUNCILS[0];
  return {
    id: c.id,
    name: c.name,
    howToReport: `Use the "report an issue" or "request a service" page on the ${c.name} website.`,
    url: c.site,
    ombudsman: SA_OMBUDSMAN,
  };
}

export function getAgency(id: string): Agency {
  if (id === "sapn") return SAPN;
  if (id === "dit") return DIT;
  return councilAgency(id);
}

// Picks who is responsible. Streetlights belong to SA Power Networks,
// road and signal problems on main roads to DIT, everything else to the council.
export function routeIssue(issueType: IssueType, councilId: string, onMainRoad: boolean): Agency {
  if (issueType === "streetlight") return SAPN;
  if (onMainRoad && (issueType === "pothole" || issueType === "signage" || issueType === "drainage")) return DIT;
  return councilAgency(councilId);
}

export function guessCouncil(addressParts: string[]): string | null {
  const haystack = addressParts.join(" | ").toLowerCase();
  for (const c of COUNCILS) {
    if (c.match.some((m) => haystack.includes(m))) return c.id;
  }
  return null;
}

// Escalation ladder: what happens each time a deadline passes without a fix.
export const ESCALATION_STEPS = [
  { title: "Report sent", waitDays: 14 },
  { title: "Friendly reminder", waitDays: 10 },
  { title: "Formal complaint to a manager", waitDays: 14 },
  { title: "Letter to your local representative", waitDays: 21 },
  { title: "Complaint to the ombudsman", waitDays: 30 },
];
