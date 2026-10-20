"use client";

import { useEffect, useRef, useState } from "react";
import { COUNCILS, routeIssue, type Agency } from "@/lib/agencies";
import { ISSUE_ICONS, ISSUE_LABELS, ISSUE_TYPES, type Analysis, type IssueType, type Letter, type Report, type Severity } from "@/lib/types";
import { api, Button, Card, SendLetter, Spinner, Steps } from "./ui";

type Draft = {
  photo: string | null;
  lat: number | null;
  lng: number | null;
  note: string;
  address: string;
  issueType: IssueType;
  title: string;
  description: string;
  severity: Severity;
  councilId: string;
  onMainRoad: boolean;
};

const EMPTY: Draft = {
  photo: null,
  lat: null,
  lng: null,
  note: "",
  address: "",
  issueType: "pothole",
  title: "",
  description: "",
  severity: "medium",
  councilId: "adelaide",
  onMainRoad: false,
};

const ROAD_ISSUES: IssueType[] = ["pothole", "signage", "drainage"];

// Shrinks the photo on the phone before upload so it sends fast on mobile data.
async function shrinkPhoto(file: File, max = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function NewReport({ onDone, onCancel }: { onDone: (r: Report) => void; onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locStatus, setLocStatus] = useState<"finding" | "found" | "off">(() =>
    typeof navigator !== "undefined" && !("geolocation" in navigator) ? "off" : "finding",
  );
  const [aiOn, setAiOn] = useState(true);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [letter, setLetter] = useState<Letter | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("found");
      },
      () => setLocStatus("off"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      set({ photo: await shrinkPhoto(file) });
    } catch {
      setError("That photo couldn't be opened. Try another one.");
    }
  }

  async function analyze() {
    setBusy("Looking at your photo and finding the address…");
    setError(null);
    try {
      const res = await api<{ analysis: Analysis | null; address: string; councilId: string | null; aiEnabled: boolean }>(
        "/api/analyze",
        { image: d.photo, lat: d.lat, lng: d.lng, note: d.note },
      );
      setAiOn(res.aiEnabled);
      const a = res.analysis;
      set({
        address: res.address || d.address,
        councilId: res.councilId ?? d.councilId,
        ...(a && {
          issueType: a.issueType,
          title: a.title,
          description: a.description + (a.safetyRisk ? ` ${a.safetyRisk}` : ""),
          severity: a.severity,
        }),
        ...(!a && d.note && !d.description && { description: d.note }),
      });
      if (a && !a.isPublicIssue) setError("This photo doesn't look like a problem on public land. You can still continue if it is.");
      setStep(1);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function draft() {
    setBusy("Working out who's responsible and writing your report…");
    setError(null);
    try {
      const res = await api<{ agency: Agency; letter: Letter }>("/api/draft", d);
      setAgency(res.agency);
      setLetter(res.letter);
      setStep(2);
    } catch {
      setError("Something went wrong writing the report. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function markSent() {
    if (!letter) return;
    setBusy("Saving your report…");
    try {
      const { note: _note, ...fields } = d;
      void _note;
      const saved = await api<Report>("/api/reports", { ...fields, referenceNumber: "", letter });
      onDone(saved);
    } catch {
      setError("Couldn't save. Please try again.");
      setBusy(null);
    }
  }

  const routed = routeIssue(d.issueType, d.councilId, d.onMainRoad);
  const canCheck = d.title.trim() && d.description.trim() && d.address.trim();

  if (busy) return <Spinner label={busy} />;

  return (
    <div className="flex flex-col gap-5">
      <Steps current={step} />
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {step === 0 && (
        <>
          <h1 className="text-2xl font-bold">Take a photo of the problem</h1>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          {d.photo ? (
            <button onClick={() => fileInput.current?.click()} className="overflow-hidden rounded-2xl" aria-label="Retake photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.photo} alt="Your photo of the problem" className="max-h-80 w-full object-cover" />
              <span className="block bg-slate-100 py-2 text-sm text-slate-600">Tap to retake</span>
            </button>
          ) : (
            <button
              onClick={() => fileInput.current?.click()}
              className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border-4 border-dashed border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            >
              <span className="text-6xl" aria-hidden>
                📷
              </span>
              <span className="text-xl font-semibold">Tap to take a photo</span>
              <span className="text-sm">or choose one from your phone</span>
            </button>
          )}

          <p className="text-sm text-slate-600" aria-live="polite">
            {locStatus === "finding" && "📍 Finding your location…"}
            {locStatus === "found" && "📍 Location found. We'll use it to find the right council."}
            {locStatus === "off" && "📍 Location is off, so you'll type the address on the next screen."}
          </p>

          <label className="flex flex-col gap-1">
            <span className="font-semibold">Anything to add? (optional)</span>
            <input
              className="rounded-xl border-2 border-slate-200 p-3 text-base"
              placeholder="e.g. it's been like this for a month"
              value={d.note}
              onChange={(e) => set({ note: e.target.value })}
            />
          </label>

          <Button onClick={analyze} disabled={!d.photo && locStatus === "finding"}>
            {d.photo ? "Next" : "Skip the photo"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="text-2xl font-bold">Check the details</h1>
          <p className="text-slate-600">
            {aiOn && d.title ? "We filled this in from your photo. Fix anything that's wrong." : "Tell us what the problem is."}
          </p>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-semibold">What kind of problem?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ISSUE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => set({ issueType: t })}
                  aria-pressed={d.issueType === t}
                  className={`flex min-h-16 items-center gap-2 rounded-xl border-2 p-3 text-left text-sm font-medium ${
                    d.issueType === t ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="text-2xl" aria-hidden>
                    {ISSUE_ICONS[t]}
                  </span>
                  {ISSUE_LABELS[t]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1">
            <span className="font-semibold">Short title</span>
            <input
              className="rounded-xl border-2 border-slate-200 p-3 text-base"
              placeholder="e.g. Deep pothole in bike lane"
              value={d.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Description</span>
            <textarea
              className="min-h-28 rounded-xl border-2 border-slate-200 p-3 text-base"
              placeholder="What's wrong, how big is it, and is it dangerous?"
              value={d.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Where is it?</span>
            <input
              className="rounded-xl border-2 border-slate-200 p-3 text-base"
              placeholder="Street address or nearest corner"
              value={d.address}
              onChange={(e) => set({ address: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Council area</span>
            <select
              className="rounded-xl border-2 border-slate-200 bg-white p-3 text-base"
              value={d.councilId}
              onChange={(e) => set({ councilId: e.target.value })}
            >
              {COUNCILS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {ROAD_ISSUES.includes(d.issueType) && (
            <fieldset>
              <legend className="mb-2 font-semibold">Is it on a main road?</legend>
              <p className="mb-2 text-sm text-slate-600">Main roads like South Road or Anzac Highway are looked after by the state, not the council.</p>
              <div className="grid grid-cols-2 gap-2">
                {[false, true].map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => set({ onMainRoad: v })}
                    aria-pressed={d.onMainRoad === v}
                    className={`min-h-14 rounded-xl border-2 font-semibold ${d.onMainRoad === v ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white"}`}
                  >
                    {v ? "Yes, main road" : "No, local street"}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <Card tone="info">
            <p className="text-sm text-slate-600">This will go to</p>
            <p className="text-lg font-bold">{routed.name}</p>
          </Card>

          <Button onClick={draft} disabled={!canCheck}>
            Write my report
          </Button>
          {!canCheck && <p className="-mt-3 text-center text-sm text-slate-500">Add a title, description and address to continue.</p>}
          <Button variant="ghost" onClick={() => setStep(0)}>
            Back
          </Button>
        </>
      )}

      {step === 2 && agency && letter && (
        <>
          <h1 className="text-2xl font-bold">Send it to {agency.name}</h1>
          <Card tone="info">
            <p>{agency.howToReport}</p>
            <p className="mt-2 text-sm text-slate-600">
              Copy the message, open their page, paste it in, and attach your photo. It takes about a minute.
            </p>
          </Card>
          <SendLetter letter={letter} onChange={setLetter} agency={agency} photo={d.photo} />
          <div className="mt-2 border-t-2 border-slate-100 pt-5">
            <Button onClick={markSent}>✓ I&apos;ve sent it, start tracking</Button>
            <p className="mt-2 text-center text-sm text-slate-500">We&apos;ll remind you to check in, and write the follow-up for you if nothing happens.</p>
          </div>
          <Button variant="ghost" onClick={() => setStep(1)}>
            Back
          </Button>
        </>
      )}
    </div>
  );
}
