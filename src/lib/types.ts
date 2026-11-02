export const ISSUE_TYPES = [
  "pothole",
  "streetlight",
  "footpath",
  "graffiti",
  "dumping",
  "tree",
  "drainage",
  "signage",
  "other",
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_LABELS: Record<IssueType, string> = {
  pothole: "Pothole or road damage",
  streetlight: "Broken streetlight",
  footpath: "Footpath, kerb or ramp",
  graffiti: "Graffiti or vandalism",
  dumping: "Rubbish or dumped items",
  tree: "Fallen tree or branches",
  drainage: "Blocked drain or flooding",
  signage: "Damaged sign or traffic signal",
  other: "Something else",
};

export type Severity = "low" | "medium" | "high";

export type Analysis = {
  isPublicIssue: boolean;
  issueType: IssueType;
  title: string;
  description: string;
  severity: Severity;
  safetyRisk: string;
};

export type Letter = { subject: string; body: string };

export type ReportStatus = "sent" | "acknowledged" | "fixed";

export type HistoryEntry = {
  at: string;
  kind: "sent" | "follow-up" | "acknowledged" | "fixed" | "note";
  text: string;
  letter?: Letter;
};

export type Report = {
  id: string;
  createdAt: string;
  photo: string | null;
  lat: number | null;
  lng: number | null;
  address: string;
  issueType: IssueType;
  title: string;
  description: string;
  severity: Severity;
  councilId: string;
  onMainRoad: boolean;
  agencyId: string;
  status: ReportStatus;
  referenceNumber: string;
  escalationLevel: number;
  nextCheckAt: string;
  history: HistoryEntry[];
  // Present when Street Fix sends the emails itself. `key` is the secret that lets
  // this browser (and the links in the person's emails) read and update the report.
  tracking?: Tracking;
};

export type Tracking = {
  key: string;
  email: string;
  // False until the person taps the link in the confirmation email.
  confirmed: boolean;
  // The person has asked Street Fix to stop sending follow-ups.
  stopped?: boolean;
};

export type Reporter = { name: string; email: string; phone?: string };
