import { promises as fs } from "fs";
import path from "path";
import type { Report } from "./types";

// v1 keeps reports in a JSON file so the app runs with zero setup.
// Swap for a real database before more than one person uses it.
const DATA_DIR = process.env.STREET_FIX_DATA_DIR ?? path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "reports.json");

export async function listReports(): Promise<Report[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Report[];
  } catch {
    return [];
  }
}

async function saveAll(reports: Report[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(reports, null, 2));
}

export async function getReport(id: string) {
  return (await listReports()).find((r) => r.id === id) ?? null;
}

export async function addReport(report: Report) {
  const all = await listReports();
  all.unshift(report);
  await saveAll(all);
  return report;
}

export async function updateReport(id: string, change: (r: Report) => Report) {
  const all = await listReports();
  const i = all.findIndex((r) => r.id === id);
  if (i === -1) return null;
  all[i] = change(all[i]);
  await saveAll(all);
  return all[i];
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
