"use client";

import { useState } from "react";
import { ESCALATION_STEPS, getAgency } from "@/lib/agencies";
import { applyAction, applyFollowUpSent, type ReportAction } from "@/lib/reports";
import { ISSUE_LABELS, type Letter, type Report } from "@/lib/types";
import { ArrowLeft, Check, Mail } from "lucide-react";
import { IssueIcon } from "./icons";
import { api, Button, Card, friendly, daysBetween, niceDate, SendLetter, Spinner } from "./ui";

// Reports on autopilot follow up by themselves, so they never need a manual check-in.
export const onAutopilot = (r: Report) => Boolean(r.tracking && !r.tracking.stopped && r.status !== "fixed");

export function isDue(r: Report) {
  return !onAutopilot(r) && r.status !== "fixed" && new Date(r.nextCheckAt) <= new Date();
}

export function StatusPill({ r }: { r: Report }) {
  if (r.status === "fixed") return <span className="whitespace-nowrap rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">Fixed</span>;
  if (r.tracking && !r.tracking.confirmed && !r.tracking.stopped)
    return <span className="whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">Confirm email</span>;
  if (isDue(r)) return <span className="whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">Check in</span>;
  if (r.status === "acknowledged") return <span className="whitespace-nowrap rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-800">Agency replied</span>;
  return <span className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">Waiting</span>;
}

export function ReportDetail({ report, onChange, onBack }: { report: Report; onChange: (r: Report) => void; onBack: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<{ step: string; letter: Letter; level: number } | null>(null);
  const [refInput, setRefInput] = useState(report.referenceNumber);
  const [openLetter, setOpenLetter] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agency = getAgency(report.agencyId);
  const sentAt = report.history.find((h) => h.kind === "sent")?.at ?? report.createdAt;
  const age = daysBetween(new Date(sentAt), new Date());
  const lastLevel = ESCALATION_STEPS.length - 1;

  async function act(action: ReportAction | "stop") {
    if (!report.tracking) {
      if (action !== "stop") onChange(applyAction(report, action, refInput));
      return;
    }
    // Autopilot reports live on the server, which sends the follow-ups.
    setBusy("Saving…");
    setError(null);
    try {
      const serverAction = action === "not-fixed" ? "snooze" : action;
      const res = await api<{ report: Report }>(`/api/r/${report.id}`, { k: report.tracking.key, action: serverAction, referenceNumber: refInput });
      onChange({ ...res.report, photo: report.photo ?? res.report.photo });
    } catch (e) {
      setError(friendly(e, "Couldn't save that. Check your connection and try again."));
    } finally {
      setBusy(null);
    }
  }

  async function startFollowUp() {
    setBusy("Writing your follow-up…");
    setError(null);
    try {
      setFollowUp(await api("/api/followup", { report: { ...report, photo: null } }));
    } catch (e) {
      setError(friendly(e, "Couldn't write the follow-up. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  function followUpSent() {
    if (!followUp) return;
    onChange(applyFollowUpSent(report, followUp.letter));
    setFollowUp(null);
  }

  if (busy) return <Spinner label={busy} />;

  if (followUp) {
    const recipient =
      followUp.level === 3
        ? report.agencyId === "sapn" || report.agencyId === "dit"
          ? { name: "your local MP (Parliament of SA)", url: "https://www.parliament.sa.gov.au" }
          : { name: `${agency.name} councillors`, url: agency.url }
        : followUp.level >= lastLevel
          ? agency.ombudsman
          : undefined;
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Step {followUp.level + 1} of {ESCALATION_STEPS.length}
        </p>
        <h1 className="text-2xl font-bold">{followUp.step}</h1>
        <Card tone="info">
          <p>
            {followUp.level === 1 && `A short, polite nudge to ${agency.name}. Most reports get moving at this point.`}
            {followUp.level === 2 && `A formal complaint asks ${agency.name} to respond under their complaints process.`}
            {followUp.level === 3 && "Your local councillor or state MP can push the agency on your behalf. You can find their contact details on your council's website."}
            {followUp.level >= lastLevel && `${agency.ombudsman.name} independently reviews complaints when an agency hasn't dealt with an issue properly.`}
          </p>
        </Card>
        <SendLetter letter={followUp.letter} onChange={(l) => setFollowUp({ ...followUp, letter: l })} agency={agency} photo={report.photo} recipient={recipient} />
        <Button onClick={followUpSent}>I&apos;ve sent it</Button>
        <Button variant="ghost" onClick={() => setFollowUp(null)}>
          Not now
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button onClick={onBack} className="flex items-center gap-1 self-start text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All reports
      </button>

      {report.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={report.photo} alt="" className="max-h-72 w-full rounded-2xl object-cover" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">
            <IssueIcon type={report.issueType} className="mr-1 inline h-4 w-4 align-[-2px]" /> {ISSUE_LABELS[report.issueType]}
          </p>
          <h1 className="text-2xl font-bold">{report.title}</h1>
          <p className="text-slate-600">{report.address}</p>
        </div>
        <StatusPill r={report} />
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {report.status === "fixed" ? null : report.tracking && !report.tracking.confirmed && !report.tracking.stopped ? (
        <Card tone="warn">
          <p className="flex items-start gap-2 text-xl font-bold">
            <Mail className="mt-1 h-5 w-5 shrink-0" aria-hidden /> Check your email
          </p>
          <p className="mt-2 text-slate-700">
            Tap the link we sent to <b>{report.tracking.email}</b> and your report goes to {agency.name} straight away. You only need to do this once.
          </p>
        </Card>
      ) : onAutopilot(report) ? (
        <Card>
          <p className="text-lg font-semibold">Street Fix is following this up for you</p>
          <p className="mt-1 text-slate-600">
            {report.escalationLevel < lastLevel
              ? `If it isn't fixed, we'll send the ${ESCALATION_STEPS[report.escalationLevel + 1].title.toLowerCase()} after ${niceDate(report.nextCheckAt)}. We'll email you two days before, so you can tell us if it's fixed.`
              : "We've sent every step on the list. We'll email you if anything changes."}
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <Button variant="secondary" onClick={() => act("fixed")}>
              It&apos;s fixed
            </Button>
            <Button variant="ghost" onClick={() => act("stop")}>
              Stop the follow-ups
            </Button>
          </div>
        </Card>
      ) : null}

      {report.status === "fixed" ? (
        <Card tone="good">
          <p className="text-xl font-bold">Fixed. Thanks for making your street better.</p>
          <p className="mt-1 text-slate-700">It took {age} {age === 1 ? "day" : "days"} from your first report.</p>
        </Card>
      ) : isDue(report) ? (
        <Card tone="warn">
          <p className="text-xl font-bold">It&apos;s been {age} days. Is it fixed?</p>
          <div className="mt-4 flex flex-col gap-3">
            <Button onClick={() => act("fixed")}>Yes, it&apos;s fixed</Button>
            {report.escalationLevel < lastLevel ? (
              <Button variant="secondary" onClick={startFollowUp}>
                No, write the next follow-up for me
              </Button>
            ) : (
              <p className="text-slate-700">You&apos;ve taken every step on the list. Keep checking in, or contact a local journalist or community group.</p>
            )}
            <Button variant="ghost" onClick={() => act("not-fixed")}>
              They&apos;re working on it, check again in a week
            </Button>
          </div>
        </Card>
      ) : report.tracking && !report.tracking.stopped ? null : (
        <Card>
          <p className="text-lg font-semibold">Next check-in: {niceDate(report.nextCheckAt)}</p>
          <p className="mt-1 text-slate-600">We&apos;ll flag this report then, and write the follow-up if it isn&apos;t fixed.</p>
          <div className="mt-4 flex flex-col gap-3">
            <Button variant="secondary" onClick={() => act("fixed")}>
              It&apos;s already fixed
            </Button>
          </div>
        </Card>
      )}

      {report.status !== "fixed" && (
        <Card>
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Did they give you a reference number?</span>
            <span className="text-sm text-slate-600">Adding it makes your follow-ups much harder to ignore.</span>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 p-3 text-base"
                placeholder="e.g. CRM-123456"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
              />
              <button
                onClick={() => act(report.status === "sent" ? "acknowledged" : "reference")}
                disabled={!refInput.trim() || refInput === report.referenceNumber}
                className="rounded-xl bg-slate-900 px-5 font-semibold text-white disabled:bg-slate-300"
              >
                Save
              </button>
            </div>
          </label>
        </Card>
      )}

      <section aria-label="Escalation steps">
        <h2 className="mb-3 text-lg font-bold">How we keep it moving</h2>
        <ol className="flex flex-col gap-2">
          {ESCALATION_STEPS.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  i <= report.escalationLevel ? "bg-ink text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {i <= report.escalationLevel ? <Check className="h-4 w-4" aria-label="Done" /> : i + 1}
              </span>
              <span className={i <= report.escalationLevel ? "font-semibold" : "text-slate-600"}>{s.title}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="History">
        <h2 className="mb-3 text-lg font-bold">History</h2>
        <ul className="flex flex-col gap-3">
          {[...report.history].reverse().map((h, i) => (
            <li key={i} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">{niceDate(h.at)}</p>
              <p className="font-semibold">{h.text}</p>
              {h.letter && (
                <>
                  <button className="mt-1 text-sm font-medium text-ink underline" onClick={() => setOpenLetter(openLetter === i ? null : i)}>
                    {openLetter === i ? "Hide message" : "Show message"}
                  </button>
                  {openLetter === i && (
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-700">
                      {h.letter.subject}
                      {"\n\n"}
                      {h.letter.body}
                    </pre>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
