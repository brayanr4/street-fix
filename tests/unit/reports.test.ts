import { describe, expect, it } from "vitest";
import { getAgency } from "@/lib/agencies";
import { addDays, applyAction, applyFollowUpSent, createReport, nextLevel } from "@/lib/reports";
import { draftLetter } from "@/lib/ai";
import type { Report } from "@/lib/types";

const letter = { subject: "Pothole", body: "Please fix it." };

function sample(overrides: Partial<Report> = {}): Report {
  return {
    ...createReport(
      {
        photo: null,
        lat: -34.9285,
        lng: 138.6007,
        address: "King William St, Adelaide 5000",
        issueType: "pothole",
        title: "Deep pothole",
        description: "40cm wide in the bike lane.",
        severity: "high",
        councilId: "adelaide",
        onMainRoad: false,
        referenceNumber: "",
      },
      letter,
    ),
    ...overrides,
  };
}

describe("createReport", () => {
  it("starts as sent, at level 0, with a check-in 14 days out", () => {
    const r = sample();
    expect(r.status).toBe("sent");
    expect(r.escalationLevel).toBe(0);
    expect(r.agencyId).toBe("adelaide");
    expect(r.history).toHaveLength(1);
    expect(r.history[0].letter).toEqual(letter);
    const days = (new Date(r.nextCheckAt).getTime() - new Date(r.createdAt).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(14);
  });

  it("gives every report a unique id", () => {
    expect(sample().id).not.toBe(sample().id);
  });
});

describe("applyAction", () => {
  it("records a reply with the reference number", () => {
    const r = applyAction(sample(), "acknowledged", "  CRM-1  ");
    expect(r.status).toBe("acknowledged");
    expect(r.referenceNumber).toBe("CRM-1");
    expect(r.history.at(-1)?.kind).toBe("acknowledged");
  });

  it("marks a report fixed", () => {
    expect(applyAction(sample(), "fixed").status).toBe("fixed");
  });

  it("snoozes the check-in by a week when it isn't fixed yet", () => {
    const before = Date.now();
    const r = applyAction(sample({ nextCheckAt: "2026-01-01T00:00:00Z" }), "not-fixed");
    const days = (new Date(r.nextCheckAt).getTime() - before) / 86_400_000;
    expect(Math.round(days)).toBe(7);
  });

  it("does not mutate the original report", () => {
    const original = sample();
    applyAction(original, "fixed");
    expect(original.status).toBe("sent");
  });
});

describe("follow-ups", () => {
  it("climbs one step per follow-up and stops at the ombudsman", () => {
    let r = sample();
    for (let i = 1; i <= 6; i++) r = applyFollowUpSent(r, letter);
    expect(r.escalationLevel).toBe(4);
    expect(nextLevel(r)).toBe(4);
    expect(r.history.filter((h) => h.kind === "follow-up")).toHaveLength(6);
  });
});

describe("addDays", () => {
  it("adds calendar days", () => {
    expect(addDays("2026-01-30T00:00:00.000Z", 3).slice(0, 10)).toBe("2026-02-02");
  });
});

describe("letter templates (no API key)", () => {
  it("writes every escalation level with the facts filled in and no placeholders", async () => {
    const r = { ...sample({ referenceNumber: "CRM-77" }), sentAt: "2026-10-01T00:00:00Z" };
    for (let level = 0; level <= 4; level++) {
      const l = await draftLetter(r, getAgency("adelaide"), level);
      expect(l.subject.length).toBeGreaterThan(5);
      expect(l.body).toContain("King William St");
      expect(l.body).not.toMatch(/undefined|null|NaN/);
      if (level > 0) expect(l.body).toContain("CRM-77");
    }
  });

  it("addresses the energy ombudsman for streetlight complaints", async () => {
    const r = { ...sample({ issueType: "streetlight", agencyId: "sapn" }), sentAt: "2026-10-01T00:00:00Z" };
    const l = await draftLetter(r, getAgency("sapn"), 4);
    expect(l.body).toContain("Energy and Water Ombudsman SA");
  });
});
