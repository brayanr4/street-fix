import { addDays, updateReport } from "@/lib/store";

export async function PATCH(request: Request, ctx: RouteContext<"/api/reports/[id]">) {
  const { id } = await ctx.params;
  const { action, referenceNumber } = (await request.json()) as {
    action: "acknowledged" | "fixed" | "not-fixed" | "reference";
    referenceNumber?: string;
  };
  const now = new Date().toISOString();

  const updated = await updateReport(id, (r) => {
    switch (action) {
      case "reference":
        return { ...r, referenceNumber: referenceNumber?.trim() ?? "" };
      case "acknowledged":
        return {
          ...r,
          status: "acknowledged",
          referenceNumber: referenceNumber?.trim() || r.referenceNumber,
          history: [...r.history, { at: now, kind: "acknowledged", text: "The agency replied" }],
        };
      case "fixed":
        return { ...r, status: "fixed", history: [...r.history, { at: now, kind: "fixed", text: "Marked as fixed 🎉" }] };
      case "not-fixed":
        // Snooze the check by a week when the person says it's been seen to but not finished.
        return { ...r, nextCheckAt: addDays(now, 7), history: [...r.history, { at: now, kind: "note", text: "Checked: not fixed yet" }] };
    }
  });

  if (!updated) return Response.json({ error: "Report not found" }, { status: 404 });
  return Response.json(updated);
}
