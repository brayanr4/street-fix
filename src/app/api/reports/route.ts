import { randomUUID } from "crypto";
import { ESCALATION_STEPS, routeIssue } from "@/lib/agencies";
import { addDays, addReport, listReports } from "@/lib/store";
import type { Letter, Report } from "@/lib/types";

export async function GET() {
  return Response.json(await listReports());
}

export async function POST(request: Request) {
  const body = (await request.json()) as Omit<
    Report,
    "id" | "createdAt" | "agencyId" | "status" | "escalationLevel" | "nextCheckAt" | "history"
  > & { letter: Letter };

  const now = new Date().toISOString();
  const agency = routeIssue(body.issueType, body.councilId, body.onMainRoad);
  const { letter, ...fields } = body;
  const report: Report = {
    ...fields,
    id: randomUUID(),
    createdAt: now,
    agencyId: agency.id,
    status: "sent",
    escalationLevel: 0,
    nextCheckAt: addDays(now, ESCALATION_STEPS[0].waitDays),
    history: [{ at: now, kind: "sent", text: `Reported to ${agency.name}`, letter }],
  };
  return Response.json(await addReport(report));
}
