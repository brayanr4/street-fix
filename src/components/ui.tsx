"use client";

import { useState, type ReactNode } from "react";
import type { Agency } from "@/lib/agencies";
import type { Letter } from "@/lib/types";

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  href,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  href?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-slate-300",
    secondary: "bg-white text-slate-900 border-2 border-slate-200 hover:border-slate-400",
    ghost: "text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline",
  }[variant];
  const cls = `flex w-full min-h-14 items-center justify-center gap-2 rounded-2xl px-5 text-lg font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 ${styles}`;
  if (href)
    return (
      <a
        className={cls}
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel="noreferrer"
        download={href.startsWith("data:") ? "street-fix-photo.jpg" : undefined}
      >
        {children}
      </a>
    );
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Card({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "info" | "warn" | "good" }) {
  const t = {
    plain: "bg-white border-slate-200",
    info: "bg-sky-50 border-sky-200",
    warn: "bg-amber-50 border-amber-300",
    good: "bg-emerald-50 border-emerald-300",
  }[tone];
  return <div className={`rounded-2xl border-2 p-5 ${t}`}>{children}</div>;
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center" role="status" aria-live="polite">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      <p className="text-lg text-slate-700">{label}</p>
    </div>
  );
}

export function Steps({ current }: { current: number }) {
  const labels = ["Photo", "Check", "Send"];
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 flex-col items-center gap-1">
          <div className={`h-2 w-full rounded-full ${i <= current ? "bg-emerald-600" : "bg-slate-200"}`} />
          <span className={`text-sm ${i === current ? "font-semibold text-slate-900" : "text-slate-500"}`}>
            {i + 1}. {l}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Shows a letter plus the one-tap actions to send it: copy, then open the agency's channel.
export function SendLetter({ letter, onChange, agency, photo, recipient }: {
  letter: Letter;
  onChange: (l: Letter) => void;
  agency: Agency;
  photo?: string | null;
  recipient?: { name: string; url: string };
}) {
  const [copied, setCopied] = useState(false);
  const target = recipient ?? { name: agency.name, url: agency.url };

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${letter.subject}\n\n${letter.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-slate-600">Subject</span>
        <input
          className="rounded-xl border-2 border-slate-200 p-3 text-base"
          value={letter.subject}
          onChange={(e) => onChange({ ...letter, subject: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-slate-600">Message (you can edit it)</span>
        <textarea
          className="min-h-72 rounded-xl border-2 border-slate-200 p-3 text-base leading-relaxed"
          value={letter.body}
          onChange={(e) => onChange({ ...letter, body: e.target.value })}
        />
      </label>
      <div className="flex flex-col gap-3">
        <Button onClick={copy}>{copied ? "✓ Copied" : "1. Copy the message"}</Button>
        <Button variant="secondary" href={target.url}>
          2. Open {target.name} ↗
        </Button>
        {agency.phone && !recipient && (
          <Button variant="secondary" href={`tel:${agency.phone.replace(/\s/g, "")}`}>
            📞 Dangerous? Call {agency.phone}
          </Button>
        )}
        {photo && (
          <Button variant="ghost" href={photo}>
            <span>⬇ Save the photo to attach it</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export async function api<T>(url: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// Shows the server's message for rate limits, and a plain fallback for everything else.
export function friendly(e: unknown, fallback: string) {
  return e instanceof Error && e.message.startsWith("Too many") ? e.message : fallback;
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function niceDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}
