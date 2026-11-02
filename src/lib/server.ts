import { timingSafeEqual } from "crypto";
import { store, type StoredReport } from "./store";

// The address used in links inside emails. Netlify sets URL to the site's main address.
export function siteUrl(request?: Request) {
  return (process.env.URL ?? (request ? new URL(request.url).origin : "http://localhost:3000")).replace(/\/$/, "");
}

export function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Loads a report only when the caller knows its secret key.
export async function reportWithKey(id: string, key: string | null): Promise<StoredReport | null> {
  if (!key || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const r = await store.getReport(id);
  return r && sameSecret(r.tracking.key, key) ? r : null;
}
