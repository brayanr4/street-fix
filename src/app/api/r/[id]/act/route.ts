import { applyLinkAction, emailHash, newSecret, type LinkAction } from "@/lib/autopilot";
import { reportWithKey, siteUrl } from "@/lib/server";
import { store } from "@/lib/store";

const ACTIONS: LinkAction[] = ["confirm", "fixed", "snooze", "stop"];

// Links in our emails land here, then open the report in the app.
export async function GET(request: Request, ctx: RouteContext<"/api/r/[id]/act">) {
  const { id } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const action = params.get("a") as LinkAction;
  const r = await reportWithKey(id, params.get("k"));
  const home = siteUrl(request);
  if (!r || !ACTIONS.includes(action)) return Response.redirect(`${home}/?missing=1`, 303);

  const wasConfirmed = r.tracking.confirmed;
  let updated;
  try {
    updated = await applyLinkAction(r, action, home);
  } catch (err) {
    console.error("link action failed", err);
    return Response.redirect(`${home}/?report=${r.id}&k=${encodeURIComponent(r.tracking.key)}&done=error`, 303);
  }
  await store.saveReport(updated);

  const target = new URL(`${home}/`);
  target.searchParams.set("report", r.id);
  target.searchParams.set("k", r.tracking.key);
  target.searchParams.set("done", action);
  // The first confirmation also trusts this browser, so later reports send straight away.
  if (action === "confirm" && !wasConfirmed) {
    const hash = emailHash(r.reporter.email);
    let token = await store.getReporterToken(hash);
    if (!token) {
      token = newSecret();
      await store.setReporterToken(hash, token);
    }
    target.searchParams.set("t", token);
    target.searchParams.set("e", r.reporter.email);
  }
  return Response.redirect(target.toString(), 303);
}
