import { mkdtempSync, readdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COUNCILS, recipientFor } from "@/lib/agencies";
import { applyLinkAction, runDue, sendStep } from "@/lib/autopilot";
import type { Mail } from "@/lib/mail";
import { createReport } from "@/lib/reports";
import { resetStoreForTests, store, type StoredReport } from "@/lib/store";

const BASE = "https://street-fix.example";
const DAY = 86_400_000;
let dir: string;

function outbox(): Mail[] {
  const box = path.join(dir, "outbox");
  return readdirSync(box, { withFileTypes: true })
    .filter((f) => f.isFile())
    .map((f) => f.name)
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(box, f), "utf8")));
}

function makeReport(agency: { issueType?: "pothole" | "streetlight"; councilId?: string } = {}): StoredReport {
  const r = createReport(
    {
      photo: null,
      lat: -34.95,
      lng: 138.6,
      address: "12 Unley Road, Unley",
      issueType: agency.issueType ?? "pothole",
      title: "Deep pothole",
      description: "A deep pothole in the bike lane.",
      severity: "high",
      councilId: agency.councilId ?? "unley",
      onMainRoad: false,
      referenceNumber: "",
    },
    { subject: "Pothole", body: "Hello,\n\nPlease fix it.\n\nKind regards," },
  );
  return {
    ...r,
    history: [],
    tracking: { key: "secret-key", email: "sam@example.com", confirmed: false },
    reporter: { name: "Sam Lee", email: "sam@example.com" },
    photoFull: "data:image/jpeg;base64,AAAA",
    pendingLetter: { subject: "Pothole", body: "Hello,\n\nPlease fix it.\n\nKind regards," },
  };
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sf-"));
  process.env.STREET_FIX_DATA_DIR = path.join(dir, "data");
  process.env.MAIL_OUTBOX_DIR = path.join(dir, "outbox");
  resetStoreForTests();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("recipientFor", () => {
  it("has an email for every council", () => {
    for (const c of COUNCILS) expect(recipientFor(c.id, 0).email, c.id).toMatch(/@/);
  });
  it("sends council step 4 to the mayor and councillors, and the last step to Ombudsman SA", () => {
    expect(recipientFor("unley", 3)).toMatchObject({ email: "pobox1@unley.sa.gov.au", greeting: "Mayor and Councillors" });
    expect(recipientFor("unley", 4).email).toBe("ombudsman@ombudsman.sa.gov.au");
  });
  it("has no email for steps that only take web forms", () => {
    expect(recipientFor("dit", 0).email).toBeUndefined();
    expect(recipientFor("sapn", 4).email).toBeUndefined();
  });
});

describe("autopilot", () => {
  it("confirming the email sends the report to the council, copying the person in", async () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const r = await applyLinkAction(makeReport(), "confirm", BASE, now);
    const [mail] = outbox();
    expect(mail).toMatchObject({ to: "pobox1@unley.sa.gov.au", cc: "sam@example.com", replyTo: "sam@example.com", subject: "Pothole", photo: "attached" });
    expect(mail.text).toContain("Sam Lee");
    expect(mail.text).toContain("maps?q=-34.950000,138.600000");
    expect(r.tracking.confirmed).toBe(true);
    expect(r.history[0].text).toBe("Sent to City of Unley by email");
    expect(new Date(r.nextCheckAt).getTime()).toBe(now.getTime() + 14 * DAY);
  });

  it("does nothing for reports whose email isn't confirmed", async () => {
    await store.saveReport(makeReport());
    expect(await runDue(BASE, new Date("2027-06-01"))).toMatchObject({ checkIns: 0, followUps: 0 });
  });

  it("asks first, waits two days for an answer, then sends the reminder", async () => {
    const start = new Date("2026-11-02T00:00:00Z");
    await store.saveReport(await applyLinkAction(makeReport(), "confirm", BASE, start));
    const at = (days: number) => new Date(start.getTime() + days * DAY);

    expect(await runDue(BASE, at(11))).toMatchObject({ checkIns: 0, followUps: 0 });
    expect(await runDue(BASE, at(12))).toMatchObject({ checkIns: 1 });
    const checkIn = outbox().at(-1)!;
    expect(checkIn.to).toBe("sam@example.com");
    expect(checkIn.text).toContain(`${BASE}/api/r/`);
    expect(checkIn.text).toContain("a=fixed");

    expect(await runDue(BASE, at(13))).toMatchObject({ checkIns: 0, followUps: 0 });
    expect(await runDue(BASE, at(14))).toMatchObject({ followUps: 1 });
    const reminder = outbox().at(-1)!;
    expect(reminder.to).toBe("pobox1@unley.sa.gov.au");
    expect(reminder.subject).toContain("Follow-up");
    const [id] = await store.allReportIds();
    expect((await store.getReport(id))!.escalationLevel).toBe(1);
  });

  it("a late cron run still gives the person two days to answer", async () => {
    const start = new Date("2026-11-02T00:00:00Z");
    await store.saveReport(await applyLinkAction(makeReport(), "confirm", BASE, start));
    const late = new Date(start.getTime() + 20 * DAY);
    expect(await runDue(BASE, late)).toMatchObject({ checkIns: 1, followUps: 0 });
    expect(await runDue(BASE, new Date(late.getTime() + DAY))).toMatchObject({ followUps: 0 });
    expect(await runDue(BASE, new Date(late.getTime() + 2 * DAY))).toMatchObject({ followUps: 1 });
  });

  it("stops when the person says it's fixed", async () => {
    const start = new Date("2026-11-02T00:00:00Z");
    const sent = await applyLinkAction(makeReport(), "confirm", BASE, start);
    await store.saveReport(await applyLinkAction(sent, "fixed", BASE));
    expect(await runDue(BASE, new Date(start.getTime() + 60 * DAY))).toMatchObject({ checkIns: 0, followUps: 0 });
  });

  it("emails the person the letter when the next recipient only takes web forms", async () => {
    const r = { ...makeReport({ issueType: "streetlight" }), tracking: { key: "k", email: "sam@example.com", confirmed: true } };
    const updated = await sendStep(r, 3, { subject: "Help please", body: "Dear Representative," }, BASE);
    const mail = outbox().at(-1)!;
    expect(mail.to).toBe("sam@example.com");
    expect(mail.text).toContain("parliament.sa.gov.au");
    expect(updated.history.at(-1)!.text).toContain("emailed to you");
  });

  it("addresses the councillors when escalating to them", async () => {
    const r = { ...makeReport(), tracking: { key: "k", email: "sam@example.com", confirmed: true } };
    await sendStep(r, 3, { subject: "Help", body: "Dear Representative,\n\nPlease help." }, BASE);
    expect(outbox().at(-1)!.text).toMatch(/^Dear Mayor and Councillors,/);
  });
});
