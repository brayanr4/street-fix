"use client";

import { useEffect, useState } from "react";
import { NewReport } from "@/components/NewReport";
import { isDue, ReportDetail, StatusPill } from "@/components/ReportDetail";
import { api, Button, Card, niceDate, Spinner } from "@/components/ui";
import { getAgency } from "@/lib/agencies";
import { ISSUE_ICONS, type Report } from "@/lib/types";

type View = { name: "home" } | { name: "new" } | { name: "report"; id: string };

export default function Home() {
  const [view, setView] = useState<View>({ name: "home" });
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    api<Report[]>("/api/reports").then(setReports, () => setReports([]));
  }, []);

  useEffect(() => window.scrollTo({ top: 0 }), [view]);

  const upsert = (r: Report) => setReports((all) => [r, ...(all ?? []).filter((x) => x.id !== r.id)]);

  let body;
  if (view.name === "new") {
    body = (
      <NewReport
        onCancel={() => setView({ name: "home" })}
        onDone={(r) => {
          upsert(r);
          setView({ name: "report", id: r.id });
        }}
      />
    );
  } else if (view.name === "report") {
    const r = reports?.find((x) => x.id === view.id);
    body = r ? <ReportDetail report={r} onChange={upsert} onBack={() => setView({ name: "home" })} /> : <Spinner label="Loading…" />;
  } else {
    body = <HomeList reports={reports} onNew={() => setView({ name: "new" })} onOpen={(id) => setView({ name: "report", id })} />;
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <button onClick={() => setView({ name: "home" })} className="flex items-center gap-2 text-xl font-extrabold">
          <span aria-hidden>🛠️</span> Street Fix
        </button>
        <span className="ml-auto rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">Adelaide</span>
      </header>
      {body}
    </main>
  );
}

function HomeList({ reports, onNew, onOpen }: { reports: Report[] | null; onNew: () => void; onOpen: (id: string) => void }) {
  if (!reports) return <Spinner label="Loading your reports…" />;

  const due = reports.filter(isDue);
  const fixed = reports.filter((r) => r.status === "fixed").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold leading-tight">See something broken? Get it fixed.</h1>
        <p className="mt-2 text-lg text-slate-600">Snap a photo. We find who&apos;s responsible, write the report, and keep following up until it&apos;s done.</p>
      </div>

      <Button onClick={onNew}>📷 Report a problem</Button>

      {due.length > 0 && (
        <Card tone="warn">
          <p className="font-bold">
            {due.length === 1 ? "1 report needs a check-in" : `${due.length} reports need a check-in`}
          </p>
          <p className="text-sm text-slate-700">Tap it to tell us if it&apos;s fixed. If not, we&apos;ll write the follow-up.</p>
        </Card>
      )}

      {reports.length === 0 ? (
        <Card>
          <p className="mb-3 font-bold">How it works</p>
          <ol className="flex flex-col gap-3 text-slate-700">
            <li>
              <b>1. Snap.</b> Take a photo of a pothole, broken streetlight, blocked ramp or dumped rubbish.
            </li>
            <li>
              <b>2. Send.</b> We work out whether it&apos;s your council, SA Power Networks or the state, and write the report for you.
            </li>
            <li>
              <b>3. Track.</b> If nothing happens, we write a reminder, then a formal complaint, and so on until it&apos;s fixed.
            </li>
          </ol>
        </Card>
      ) : (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">Your reports</h2>
            {fixed > 0 && <span className="text-sm text-emerald-700">{fixed} fixed 🎉</span>}
          </div>
          <ul className="flex flex-col gap-3">
            {reports.map((r) => (
              <li key={r.id}>
                <button onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3 text-left hover:border-slate-400">
                  {r.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-3xl" aria-hidden>
                      {ISSUE_ICONS[r.issueType]}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.title}</span>
                    <span className="block truncate text-sm text-slate-600">{getAgency(r.agencyId).name}</span>
                    <span className="block text-xs text-slate-500">Reported {niceDate(r.createdAt)}</span>
                  </span>
                  <StatusPill r={r} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
