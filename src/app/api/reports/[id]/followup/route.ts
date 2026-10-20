import { draftLetter } from "@/lib/ai";
import { ESCALATION_STEPS, getAgency } from "@/lib/agencies";
import { addDays, getReport, updateReport } from "@/lib/store";
import type { Letter } from "@/lib/types";

const LAST_LEVEL = ESCALATION_STEPS.length - 1;

// mode "draft" writes the next letter; mode "sent" records that the person sent it.
export async function POST(request: Request, ctx: RouteContext<"/api/reports/[id]/followup">) {
  const { id } = await ctx.params;
  const { mode, letter } = (await request.json()) as { mode: "draft" | "sent"; letter?: Letter };
  const report = await getReport(id);
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

  const level = Math.min(report.escalationLevel + 1, LAST_LEVEL);
  const agency = getAgency(report.agencyId);

  if (mode === "draft") {
    const sentAt = report.history.find((h) => h.kind === "sent")?.at;
    const draft = await draftLetter({ ...report, sentAt }, agency, level);
    return Response.json({ level, step: ESCALATION_STEPS[level].title, letter: draft });
  }

  const now = new Date().toISOString();
  const updated = await updateReport(id, (r) => ({
    ...r,
    escalationLevel: level,
    nextCheckAt: addDays(now, ESCALATION_STEPS[level].waitDays),
    history: [...r.history, { at: now, kind: "follow-up", text: ESCALATION_STEPS[level].title, letter }],
  }));
  return Response.json(updated);
}
