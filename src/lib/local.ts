"use client";

import type { Report } from "./types";

// Reports live in the browser that made them, so nobody else can see your
// photos or locations and the server needs no database.
const KEY = "street-fix-reports-v1";

let cache: Report[] | null = null;
const listeners = new Set<() => void>();

function read(): Report[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Report[];
  } catch {
    return [];
  }
}

export const reportStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get(): Report[] {
    if (cache === null) cache = read();
    return cache;
  },
  getServer(): Report[] | null {
    return null;
  },
  // Returns false when the browser refused to save (private mode or storage full).
  upsert(report: Report): boolean {
    cache = [report, ...reportStore.get().filter((r) => r.id !== report.id)];
    listeners.forEach((l) => l());
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
      return true;
    } catch {
      return false;
    }
  },
};
