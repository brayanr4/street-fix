"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { NewReport } from "@/components/NewReport";
import { isDue, ReportDetail, StatusPill } from "@/components/ReportDetail";
import { api, Button, Card, niceDate, Spinner } from "@/components/ui";
import { saveMe } from "@/lib/me";
import { getAgency } from "@/lib/agencies";
import { reportStore } from "@/lib/local";
import { Camera } from "lucide-react";
import { IssueIcon, Logo } from "@/components/icons";
import { type Report } from "@/lib/types";

type View = { name: "home" } | { name: "new" } | { name: "report"; id: string };

export default function Home() {
  const [view, setView] = useState<View>({ name: "home" });
  const reports = useSyncExternalStore(reportStore.subscribe, reportStore.get, reportStore.getServer);
  const [saveFailed, setSaveFailed] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => window.scrollTo({ top: 0 }), [view]);

  // Opens a report from a link in one of our emails, and keeps autopilot reports in step
  // with what has happened on the server (follow-ups sent, "it's fixed" taps in email).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("report");
    const key = params.get("k");
    const done = params.get("done");
    if (params.get("t") && params.get("e")) saveMe({ token: params.get("t")!, tokenEmail: params.get("e")! });
    if (params.size) window.history.replaceState(null, "", "/");
    if (params.get("missing")) setTimeout(() => setNotice("That link has expired or the report was removed."));

    const refresh = async (rid: string, k: string) => {
      try {
        const { report } = await api<{ report: Report }>(`/api/r/${rid}?k=${encodeURIComponent(k)}`);
        const local = reportStore.get().find((x) => x.id === rid);
        reportStore.upsert({ ...report, photo: local?.photo ?? report.photo });
        return true;
      } catch {
        return false;
      }
    };

    if (id && key) {
      refresh(id, key).then((ok) => {
        if (!ok) return setNotice("We couldn't open that report. Check your connection and try again.");
        setView({ name: "report", id });
        const messages: Record<string, string> = {
          confirm: "Thanks. Your report has been sent.",
          fixed: "Great news. We've marked it as fixed and stopped the follow-ups.",
          snooze: "Got it. We'll check again in a week.",
          stop: "Follow-ups are stopped for this report.",
          error: "Something went wrong sending your report. Please try the link again in a minute.",
        };
        if (done && messages[done]) setNotice(messages[done]);
      });
    }
    for (const r of reportStore.get()) if (r.tracking && r.id !== id && r.status !== "fixed") refresh(r.id, r.tracking.key);
  }, []);

  const upsert = (r: Report) => setSaveFailed(!reportStore.upsert(r));

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
          <Logo /> Street Fix
        </button>
        <span className="ml-auto rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">Adelaide</span>
      </header>
      {saveFailed && (
        <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-amber-900">
          Your browser didn&apos;t let us save this report (private browsing or full storage), so it will disappear when you close this tab.
        </div>
      )}
      {notice && (
        <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-green-50 p-4 text-green-900">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-sm font-semibold underline">
            Close
          </button>
        </div>
      )}
      {body}
      <p className="mt-10 text-center text-xs text-slate-600">
        Your reports are saved on this device. Reports that Street Fix sends for you are also kept on our server so we can follow them up.
      </p>
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
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight">Pothole? Broken light? Report it once.</h1>
        <p className="mt-2 text-lg text-slate-600">Take a photo and Street Fix sends it to the right council or agency, then keeps chasing it until it&apos;s fixed.</p>
      </div>

      <Button onClick={onNew}>
        <Camera className="h-5 w-5" aria-hidden /> Report a problem
      </Button>

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
            {fixed > 0 && <span className="text-sm font-medium text-green-800">{fixed} fixed</span>}
          </div>
          <ul className="flex flex-col gap-3">
            {reports.map((r) => (
              <li key={r.id}>
                <button onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3 text-left hover:border-slate-400">
                  {r.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <IssueIcon type={r.issueType} className="h-7 w-7" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.title}</span>
                    <span className="block truncate text-sm text-slate-600">{getAgency(r.agencyId).name}</span>
                    <span className="block text-xs text-slate-600">Reported {niceDate(r.createdAt)}</span>
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
