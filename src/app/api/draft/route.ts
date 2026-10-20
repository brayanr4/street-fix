import { draftLetter } from "@/lib/ai";
import { routeIssue } from "@/lib/agencies";
import type { Report } from "@/lib/types";

export async function POST(request: Request) {
  const r = (await request.json()) as Pick<
    Report,
    "title" | "description" | "address" | "lat" | "lng" | "issueType" | "severity" | "councilId" | "onMainRoad"
  >;
  const agency = routeIssue(r.issueType, r.councilId, r.onMainRoad);
  const letter = await draftLetter({ ...r, referenceNumber: "" }, agency, 0);
  return Response.json({ agency, letter });
}
