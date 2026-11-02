import { promises as fs } from "fs";
import path from "path";
import type { Letter, Report, Reporter } from "./types";

// Reports that Street Fix sends and follows up itself are kept on the server, because
// the follow-ups run on a schedule when the person's phone is closed. On Netlify they
// live in Netlify Blobs; elsewhere (local dev, tests) in JSON files under .data/.

export type StoredReport = Report & {
  tracking: NonNullable<Report["tracking"]>;
  reporter: Reporter;
  // The full-size photo, attached to every email.
  photoFull: string | null;
  // Level whose "is it fixed?" check-in email has already gone to the person.
  checkInSentFor?: number;
  checkInSentAt?: string;
  // The first letter, held until the person confirms their email.
  pendingLetter?: Letter;
};

type Backend = {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  list(prefix: string): Promise<string[]>;
};

function fileBackend(dir: string): Backend {
  const file = (key: string) => path.join(dir, `${key.replace(/[^a-z0-9-]/gi, "_")}.json`);
  return {
    async get(key) {
      try {
        return JSON.parse(await fs.readFile(file(key), "utf8"));
      } catch {
        return null;
      }
    },
    async set(key, value) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file(key), JSON.stringify(value));
    },
    async list(prefix) {
      const names = await fs.readdir(dir).catch(() => [] as string[]);
      return names.filter((n) => n.startsWith(prefix.replace(/[^a-z0-9-]/gi, "_"))).map((n) => n.replace(/\.json$/, ""));
    },
  };
}

async function blobBackend(): Promise<Backend> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "street-fix", consistency: "strong" });
  return {
    get: (key) => store.get(key, { type: "json" }),
    set: async (key, value) => {
      await store.setJSON(key, value);
    },
    list: async (prefix) => (await store.list({ prefix })).blobs.map((b) => b.key),
  };
}

let backend: Promise<Backend> | null = null;
function db(): Promise<Backend> {
  // Netlify sets NETLIFY during builds and SITE_ID/DEPLOY_ID when the site runs.
  const onNetlify = Boolean(process.env.NETLIFY || process.env.SITE_ID || process.env.DEPLOY_ID);
  if (!backend) backend = onNetlify ? blobBackend() : Promise.resolve(fileBackend(process.env.STREET_FIX_DATA_DIR ?? ".data"));
  return backend;
}

export const store = {
  async getReport(id: string) {
    return (await (await db()).get(`report-${id}`)) as StoredReport | null;
  },
  async saveReport(r: StoredReport) {
    await (await db()).set(`report-${r.id}`, r);
  },
  async allReportIds() {
    return (await (await db()).list("report-")).map((k) => k.replace(/^report[-_]/, ""));
  },
  // A person who has confirmed their email once can send later reports straight away
  // from the same browser, using the token handed to that browser.
  async getReporterToken(emailHash: string) {
    return ((await (await db()).get(`reporter-${emailHash}`)) as { token: string } | null)?.token ?? null;
  },
  async setReporterToken(emailHash: string, token: string) {
    await (await db()).set(`reporter-${emailHash}`, { token });
  },
};

// Only for tests: forget the cached backend so a new data directory takes effect.
export function resetStoreForTests() {
  backend = null;
}
