import { runDue } from "@/lib/autopilot";
import { sameSecret, siteUrl } from "@/lib/server";

// Called every hour by the scheduled function in netlify/functions/autopilot.mts.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !sameSecret(secret, given)) return Response.json({ error: "Not allowed." }, { status: 401 });
  return Response.json(await runDue(siteUrl(request)));
}
