import { applyLinkAction, publicReport } from "@/lib/autopilot";
import { rateLimited } from "@/lib/rateLimit";
import { applyAction } from "@/lib/reports";
import { reportWithKey, siteUrl } from "@/lib/server";
import { store } from "@/lib/store";

const notFound = () => Response.json({ error: "We couldn't find that report." }, { status: 404 });

// The latest state of a report that Street Fix is following up.
export async function GET(request: Request, ctx: RouteContext<"/api/r/[id]">) {
  const { id } = await ctx.params;
  const r = await reportWithKey(id, new URL(request.url).searchParams.get("k"));
  return r ? Response.json({ report: publicReport(r) }) : notFound();
}

// Buttons in the app: it's fixed, wait a week, stop, or save a reference number.
export async function POST(request: Request, ctx: RouteContext<"/api/r/[id]">) {
  const limited = rateLimited(request);
  if (limited) return limited;
  const { id } = await ctx.params;
  const { k, action, referenceNumber } = (await request.json()) as { k: string; action: string; referenceNumber?: string };
  let r = await reportWithKey(id, k);
  if (!r) return notFound();
  if (action === "fixed" || action === "snooze" || action === "stop") r = await applyLinkAction(r, action, siteUrl(request));
  else if (action === "reference" || action === "acknowledged") r = { ...r, ...applyAction(r, action, String(referenceNumber ?? "").slice(0, 60)) };
  else return Response.json({ error: "Unknown action." }, { status: 400 });
  await store.saveReport(r);
  return Response.json({ report: publicReport(r) });
}
