// Best-effort limit on AI calls per visitor so a public deployment can't run up
// the API bill. It is per server instance; use a shared store (e.g. Upstash) at scale.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = Number(process.env.STREET_FIX_RATE_LIMIT ?? 30);
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(request: Request): Response | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  entry.count += 1;
  if (entry.count <= MAX_REQUESTS) return null;
  return Response.json({ error: "Too many requests. Please wait a few minutes and try again." }, { status: 429 });
}
