import { createHash, randomBytes } from "crypto";
import { draftLetter } from "./ai";
import { ESCALATION_STEPS, getAgency, recipientFor } from "./agencies";
import { sendMail } from "./mail";
import { addDays, applyAction } from "./reports";
import { store, type StoredReport } from "./store";
import type { Letter, Report } from "./types";

// Autopilot: Street Fix emails the report to the agency, copies the person in so the
// agency's reply goes straight to them, and sends each follow-up on schedule. Two days
// before a follow-up is due, the person gets a "Is it fixed?" email with one-tap answers.

export const CHECK_IN_DAYS_BEFORE = 2;
const DAY = 86_400_000;

export type LinkAction = "confirm" | "fixed" | "snooze" | "stop";

export const newSecret = () => randomBytes(18).toString("base64url");
export const emailHash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);

export function actionLink(base: string, r: StoredReport, action: LinkAction) {
  return `${base}/api/r/${r.id}/act?k=${encodeURIComponent(r.tracking.key)}&a=${action}`;
}

// What the person's browser is allowed to see: everything but the full photo.
export function publicReport(r: StoredReport): Report {
  const rest: Partial<StoredReport> = { ...r };
  for (const k of ["photoFull", "reporter", "checkInSentFor", "checkInSentAt", "pendingLetter"] as const) delete rest[k];
  return rest as Report;
}

function signature(r: StoredReport) {
  const { name, email, phone } = r.reporter;
  return [name, email, phone].filter(Boolean).join("\n");
}

function mapLink(r: Report) {
  return r.lat != null && r.lng != null ? `\nMap: https://www.google.com/maps?q=${r.lat.toFixed(6)},${r.lng.toFixed(6)}` : "";
}

function letterFor(r: StoredReport, letter: Letter, greeting?: string) {
  const body = greeting ? letter.body.replace(/^(Hello|Dear [^,\n]+),/, `Dear ${greeting},`) : letter.body;
  return (
    `${body}\n${signature(r)}\n${mapLink(r)}\n\n` +
    `--\nSent with Street Fix on behalf of ${r.reporter.name}. Replying to this email goes straight to them.`
  );
}

// Sends one step of the ladder. Steps whose recipient only takes web forms are emailed
// to the person instead, with the letter ready to paste.
export async function sendStep(r: StoredReport, level: number, letter: Letter, base: string, now = new Date()): Promise<StoredReport> {
  const at = now.toISOString();
  const to = recipientFor(r.agencyId, level);
  const step = ESCALATION_STEPS[level].title;
  let text: string;
  if (to.email) {
    await sendMail({ to: to.email, cc: r.reporter.email, replyTo: r.reporter.email, subject: letter.subject, text: letterFor(r, letter, to.greeting), photo: r.photoFull });
    text = level === 0 ? `Sent to ${to.name} by email` : `${step}: sent to ${to.name} by email`;
  } else {
    await sendMail({
      to: r.reporter.email,
      subject: `Your next step for "${r.title}": ${step}`,
      text:
        `Hi ${r.reporter.name},\n\n${to.name} only takes complaints through their website, so this step needs you. ` +
        `It takes about a minute: copy the letter below and paste it into their form.\n\n${to.url}\n\n` +
        `----\n${letter.subject}\n\n${letter.body}\n${signature(r)}\n----\n\n` +
        `Already fixed? ${actionLink(base, r, "fixed")}\nStop follow-ups: ${actionLink(base, r, "stop")}`,
      photo: r.photoFull,
    });
    text = `${step}: emailed to you to send to ${to.name}`;
  }
  return {
    ...r,
    escalationLevel: level,
    nextCheckAt: addDays(at, ESCALATION_STEPS[level].waitDays),
    checkInSentFor: undefined,
    checkInSentAt: undefined,
    pendingLetter: undefined,
    history: [...r.history, { at, kind: level === 0 ? "sent" : "follow-up", text, letter }],
  };
}

export async function sendConfirmation(r: StoredReport, base: string) {
  const agency = getAgency(r.agencyId);
  await sendMail({
    to: r.reporter.email,
    subject: `Tap to send your report to ${agency.name}`,
    text:
      `Hi ${r.reporter.name},\n\nPlease confirm this is your email address, and your report "${r.title}" goes to ${agency.name} straight away:\n\n` +
      `${actionLink(base, r, "confirm")}\n\nYou only need to do this once. If you didn't ask for this, ignore this email and nothing will be sent.`,
  });
}

async function sendCheckIn(r: StoredReport, base: string, now: Date): Promise<StoredReport> {
  const next = Math.min(r.escalationLevel + 1, ESCALATION_STEPS.length - 1);
  const when = new Date(Math.max(new Date(r.nextCheckAt).getTime(), now.getTime() + CHECK_IN_DAYS_BEFORE * DAY));
  const date = when.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "Australia/Adelaide" });
  await sendMail({
    to: r.reporter.email,
    subject: `Is it fixed yet? ${r.title}`,
    text:
      `Hi ${r.reporter.name},\n\nYou reported "${r.title}" at ${r.address}. Has it been fixed?\n\n` +
      `Yes, it's fixed: ${actionLink(base, r, "fixed")}\n\n` +
      `They're working on it, wait another week: ${actionLink(base, r, "snooze")}\n\n` +
      `If we don't hear from you, Street Fix will send the next step (${ESCALATION_STEPS[next].title.toLowerCase()}) on ${date}.\n\n` +
      `Stop all follow-ups: ${actionLink(base, r, "stop")}`,
  });
  return { ...r, checkInSentFor: r.escalationLevel, checkInSentAt: now.toISOString() };
}

// Runs every hour. Sends check-ins and follow-ups that have come due.
export async function runDue(base: string, now = new Date()) {
  const summary = { checkIns: 0, followUps: 0, finished: 0, failed: 0 };
  const lastLevel = ESCALATION_STEPS.length - 1;
  for (const id of await store.allReportIds()) {
    const r = await store.getReport(id);
    if (!r || !r.tracking.confirmed || r.tracking.stopped || r.status === "fixed") continue;
    const due = new Date(r.nextCheckAt).getTime();
    try {
      if (r.checkInSentFor !== r.escalationLevel) {
        if (now.getTime() >= due - CHECK_IN_DAYS_BEFORE * DAY) {
          await store.saveReport(await sendCheckIn(r, base, now));
          summary.checkIns++;
        }
        continue;
      }
      // Give the person at least two days to answer the check-in.
      const answerBy = new Date(r.checkInSentAt ?? 0).getTime() + CHECK_IN_DAYS_BEFORE * DAY;
      if (now.getTime() < Math.max(due, answerBy)) continue;
      if (r.escalationLevel >= lastLevel) {
        await sendMail({
          to: r.reporter.email,
          subject: `We've taken every step for "${r.title}"`,
          text: `Hi ${r.reporter.name},\n\nStreet Fix has sent every step on the list, including the ombudsman. If it's still not fixed, a local journalist or community group can help keep up the pressure.\n\nIt's fixed: ${actionLink(base, r, "fixed")}`,
        });
        await store.saveReport({ ...r, tracking: { ...r.tracking, stopped: true } });
        summary.finished++;
        continue;
      }
      const level = r.escalationLevel + 1;
      const sentAt = r.history.find((h) => h.kind === "sent")?.at;
      const letter = await draftLetter({ ...r, sentAt }, getAgency(r.agencyId), level);
      await store.saveReport(await sendStep(r, level, letter, base, now));
      summary.followUps++;
    } catch (err) {
      console.error(`autopilot failed for report ${id}`, err);
      summary.failed++;
    }
  }
  return summary;
}

// Handles a tap on a link in one of our emails, or a button in the app.
export async function applyLinkAction(r: StoredReport, action: LinkAction, base: string, now = new Date()): Promise<StoredReport> {
  switch (action) {
    case "confirm":
      if (r.tracking.confirmed) return r;
      return sendStep({ ...r, tracking: { ...r.tracking, confirmed: true } }, 0, r.pendingLetter!, base, now);
    case "fixed":
      return r.status === "fixed" ? r : { ...r, ...applyAction(r, "fixed") };
    case "snooze":
      return { ...r, ...applyAction(r, "not-fixed"), checkInSentFor: undefined, checkInSentAt: undefined };
    case "stop":
      return {
        ...r,
        tracking: { ...r.tracking, stopped: true },
        history: [...r.history, { at: now.toISOString(), kind: "note", text: "Follow-ups stopped" }],
      };
  }
}
