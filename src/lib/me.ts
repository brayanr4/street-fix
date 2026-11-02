"use client";

// The person's own details, remembered on this device so they only type them once.
// `token` comes from the link in the first confirmation email and lets later reports
// from this browser send without another confirmation.
export type Me = { name: string; email: string; phone: string; token?: string; tokenEmail?: string };

const KEY = "street-fix-me-v1";

export function loadMe(): Me {
  try {
    return { name: "", email: "", phone: "", ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { name: "", email: "", phone: "" };
  }
}

export function saveMe(patch: Partial<Me>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadMe(), ...patch }));
  } catch {
    // Private browsing: they'll just type their details again next time.
  }
}
