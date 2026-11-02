import { emailHash, newSecret, publicReport, sendConfirmation, sendStep } from "@/lib/autopilot";
import { mailEnabled } from "@/lib/mail";
import { rateLimited } from "@/lib/rateLimit";
import { createReport } from "@/lib/reports";
import { sameSecret, siteUrl } from "@/lib/server";
import { store, type StoredReport } from "@/lib/store";
import { ISSUE_TYPES, type IssueType, type Letter, type Report, type Reporter } from "@/lib/types";

type Body = Pick<Report, "lat" | "lng" | "address" | "issueType" | "title" | "description" | "severity" | "councilId" | "onMainRoad"> & {
  photo: string | null;
  thumb: string | null;
  letter: Letter;
  reporter: Reporter;
  reporterToken?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const photo = (v: unknown, max: number) => (typeof v === "string" && v.startsWith("data:image/") && v.length <= max ? v : null);

// Starts autopilot for a new report: Street Fix sends it and every follow-up by email.
export async function POST(request: Request) {
  const limited = rateLimited(request);
  if (limited) return limited;
  if (!mailEnabled()) return Response.json({ error: "Automatic sending isn't set up yet." }, { status: 503 });

  const b = (await request.json()) as Body;
  const reporter: Reporter = { name: text(b.reporter?.name, 80), email: text(b.reporter?.email, 120), phone: text(b.reporter?.phone, 30) || undefined };
  const letter: Letter = { subject: text(b.letter?.subject, 200), body: text(b.letter?.body, 5000) };
  if (!reporter.name || !EMAIL.test(reporter.email)) return Response.json({ error: "Please add your name and a valid email address." }, { status: 400 });
  if (!letter.subject || !letter.body || !text(b.title, 120) || !text(b.address, 200))
    return Response.json({ error: "The report is missing a title, address or message." }, { status: 400 });

  const issueType: IssueType = ISSUE_TYPES.includes(b.issueType) ? b.issueType : "other";
  const base = createReport(
    {
      photo: photo(b.thumb, 300_000),
      lat: Number.isFinite(b.lat) ? b.lat : null,
      lng: Number.isFinite(b.lng) ? b.lng : null,
      address: text(b.address, 200),
      issueType,
      title: text(b.title, 120),
      description: text(b.description, 2000),
      severity: ["low", "medium", "high"].includes(b.severity) ? b.severity : "medium",
      councilId: text(b.councilId, 40),
      onMainRoad: Boolean(b.onMainRoad),
      referenceNumber: "",
    },
    letter,
  );
  if (base.agencyId === "dit") return Response.json({ error: "This agency only takes reports by phone or web form." }, { status: 400 });

  const hash = emailHash(reporter.email);
  const known = await store.getReporterToken(hash);
  const confirmed = Boolean(known && b.reporterToken && sameSecret(known, b.reporterToken));
  let r: StoredReport = {
    ...base,
    history: [],
    tracking: { key: newSecret(), email: reporter.email, confirmed },
    reporter,
    photoFull: photo(b.photo, 2_000_000),
    pendingLetter: letter,
  };

  try {
    if (confirmed) r = await sendStep(r, 0, letter, siteUrl(request));
    else await sendConfirmation(r, siteUrl(request));
  } catch (err) {
    console.error("sending failed", err);
    return Response.json({ error: "We couldn't send the email just now. Please try again in a minute." }, { status: 502 });
  }
  await store.saveReport(r);
  return Response.json({ report: publicReport(r) });
}
