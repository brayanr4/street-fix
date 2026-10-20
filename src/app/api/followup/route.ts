import { draftLetter } from "@/lib/ai";
import { ESCALATION_STEPS, getAgency } from "@/lib/agencies";
import { rateLimited } from "@/lib/rateLimit";
import { nextLevel } from "@/lib/reports";
import type { Report } from "@/lib/types";

// Writes the next letter on the escalation ladder for a report kept in the browser.
export async function POST(request: Request) {
  const limited = rateLimited(request);
  if (limited) return limited;

  const { report } = (await request.json()) as { report: Report };
  const level = nextLevel(report);
  const sentAt = report.history.find((h) => h.kind === "sent")?.at;
  const letter = await draftLetter({ ...report, sentAt }, getAgency(report.agencyId), level);
  return Response.json({ level, step: ESCALATION_STEPS[level].title, letter });
}
