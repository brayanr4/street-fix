import { ESCALATION_STEPS, routeIssue } from "./agencies";
import type { Letter, Report } from "./types";

export function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

type NewReportFields = Omit<Report, "id" | "createdAt" | "agencyId" | "status" | "escalationLevel" | "nextCheckAt" | "history">;

export function createReport(fields: NewReportFields, letter: Letter): Report {
  const now = new Date().toISOString();
  const agency = routeIssue(fields.issueType, fields.councilId, fields.onMainRoad);
  return {
    ...fields,
    id: crypto.randomUUID(),
    createdAt: now,
    agencyId: agency.id,
    status: "sent",
    escalationLevel: 0,
    nextCheckAt: addDays(now, ESCALATION_STEPS[0].waitDays),
    history: [{ at: now, kind: "sent", text: `Reported to ${agency.name}`, letter }],
  };
}

export type ReportAction = "acknowledged" | "fixed" | "not-fixed" | "reference";

export function applyAction(r: Report, action: ReportAction, referenceNumber = ""): Report {
  const now = new Date().toISOString();
  switch (action) {
    case "reference":
      return { ...r, referenceNumber: referenceNumber.trim() };
    case "acknowledged":
      return {
        ...r,
        status: "acknowledged",
        referenceNumber: referenceNumber.trim() || r.referenceNumber,
        history: [...r.history, { at: now, kind: "acknowledged", text: "The agency replied" }],
      };
    case "fixed":
      return { ...r, status: "fixed", history: [...r.history, { at: now, kind: "fixed", text: "Marked as fixed" }] };
    case "not-fixed":
      // Snooze the check by a week when it's being worked on but isn't finished.
      return { ...r, nextCheckAt: addDays(now, 7), history: [...r.history, { at: now, kind: "note", text: "Checked: not fixed yet" }] };
  }
}

export function nextLevel(r: Report) {
  return Math.min(r.escalationLevel + 1, ESCALATION_STEPS.length - 1);
}

export function applyFollowUpSent(r: Report, letter: Letter): Report {
  const now = new Date().toISOString();
  const level = nextLevel(r);
  return {
    ...r,
    escalationLevel: level,
    nextCheckAt: addDays(now, ESCALATION_STEPS[level].waitDays),
    history: [...r.history, { at: now, kind: "follow-up", text: ESCALATION_STEPS[level].title, letter }],
  };
}
