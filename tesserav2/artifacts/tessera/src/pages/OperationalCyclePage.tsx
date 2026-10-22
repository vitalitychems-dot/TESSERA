import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Circle, RefreshCw, ShieldAlert } from "lucide-react";
import { appendCycleEvent, CYCLE_STAGES, isCycleJournal, type CycleEvent, type CycleJournal, type CycleStageId } from "@/lib/operational-cycle";

const JOURNAL_STORAGE_SLOT = "tessera.operational-cycle.v1";
type ServiceState = "available" | "unavailable" | "not-configured" | "unverified";
type OperationalStatus = {
  checkedAt: string;
  api: { state: ServiceState; source: string };
  database: { state: ServiceState; source: string };
  model: { state: ServiceState; source: string };
  worker: { state: ServiceState; source: string };
};
function readJournal(): CycleJournal {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(JOURNAL_STORAGE_SLOT) ?? "null");
    return isCycleJournal(value) ? value : { version: 1, events: [] };
  } catch { return { version: 1, events: [] }; }
}
function StatePill({ state }: { state: ServiceState }) {
  const style = state === "available" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : state === "unavailable" ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
      : "border-amber-300/30 bg-amber-300/10 text-amber-100";
  const label = state === "available" ? "Available" : state === "unavailable" ? "Unavailable"
    : state === "not-configured" ? "Not configured" : "Not verified";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}>{label}</span>;
}
function formatTime(value: string): string {
  const time = new Date(value);
  return Number.isFinite(time.getTime()) ? time.toLocaleString() : "Invalid timestamp";
}

export default function OperationalCyclePage() {
  const [journal, setJournal] = useState<CycleJournal>({ version: 1, events: [] });
  const [journalLoaded, setJournalLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [proposal, setProposal] = useState({ diff: "", tests: "", provenance: "", rollback: "" });
  const [status, setStatus] = useState<OperationalStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [checking, setChecking] = useState(false);
  const nextStage = CYCLE_STAGES[journal.events.length];
  const currentEvent = useMemo<CycleEvent | undefined>(() => journal.events[journal.events.length - 1], [journal.events]);

  useEffect(() => {
    setJournal(readJournal());
    setJournalLoaded(true);
  }, []);
  useEffect(() => {
    if (!journalLoaded) return;
    try {
      window.localStorage.setItem(JOURNAL_STORAGE_SLOT, JSON.stringify(journal));
      setStorageError("");
    } catch {
      setStorageError("This browser could not save the local cycle journal. Copy any evidence you need before leaving this page.");
    }
  }, [journal, journalLoaded]);

  async function checkStatus() {
    setChecking(true); setStatusError("");
    try {
      const response = await fetch("/api/operational-status", { method: "GET", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error(`Status endpoint returned HTTP ${response.status}.`);
      setStatus(await response.json() as OperationalStatus);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Status check failed.");
      setStatus(null);
    } finally { setChecking(false); }
  }

  function recordStage() {
    if (!nextStage) return;
    const evidence = nextStage.id === "proposed_upgrade"
      ? [`Proposed diff:\n${proposal.diff.trim()}`, `Tests:\n${proposal.tests.trim()}`, `Provenance:\n${proposal.provenance.trim()}`, `Rollback:\n${proposal.rollback.trim()}`].join("\n\n")
      : draft;
    if (nextStage.id === "proposed_upgrade" && Object.values(proposal).some((field) => !field.trim())) return;
    try {
      const events = appendCycleEvent(journal.events, nextStage.id as CycleStageId, evidence);
      setJournal({ version: 1, events }); setDraft("");
      setProposal({ diff: "", tests: "", provenance: "", rollback: "" }); setStatusError("");
    } catch (error) { setStatusError(error instanceof Error ? error.message : "Stage could not be recorded."); }
  }
  function clearJournal() {
    setJournal({ version: 1, events: [] }); setDraft("");
    setProposal({ diff: "", tests: "", provenance: "", rollback: "" });
    try { window.localStorage.removeItem(JOURNAL_STORAGE_SLOT); setStorageError(""); }
    catch { setStorageError("Could not clear this browser's local journal."); }
  }
  const serviceRows = status ? [["API", status.api], ["Database", status.database], ["Model", status.model], ["Background worker", status.worker]] as const : [];

  return <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-slate-100 sm:px-6">
    <header className="space-y-3">
      <div className="flex items-center gap-3"><Activity aria-hidden="true" className="h-6 w-6 text-cyan-300" /><h1 className="text-2xl font-semibold tracking-tight">Operational cycle</h1></div>
      <p className="max-w-3xl text-sm leading-6 text-slate-300">A human-entered, evidence-first journal. Recording a stage does not generate code, run tests, update durable server memory, or perform an external action.</p>
      <div className="rounded-lg border border-amber-300/25 bg-amber-300/5 p-3 text-sm text-amber-100"><strong>REAL NOW / STILL A GOAL:</strong> Cycle entries are saved only in this browser on this device. Database availability is probed live below; model reachability and an independent worker heartbeat are not currently verified.</div>
    </header>

    <section aria-labelledby="status-heading" className="rounded-xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="status-heading" className="text-lg font-medium">Service status</h2><p className="mt-1 text-xs text-slate-400">Database status comes from a live `SELECT 1`; model and worker status are intentionally not guessed.</p></div>
        <button type="button" onClick={checkStatus} disabled={checking} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/25 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-300/10 disabled:opacity-50"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />{checking ? "Checking…" : "Check now"}</button>
      </div>
      {statusError && <p role="alert" className="mt-3 text-sm text-rose-200">{statusError}</p>}
      {status && <><dl className="mt-4 grid gap-3 sm:grid-cols-2">{serviceRows.map(([name, item]) => <div key={name} className="rounded-lg border border-white/10 bg-black/10 p-3"><div className="flex items-center justify-between gap-2"><dt className="text-sm font-medium">{name}</dt><StatePill state={item.state} /></div><dd className="mt-2 text-xs leading-5 text-slate-400">{item.source}</dd></div>)}</dl><p className="mt-3 text-xs text-slate-400">Checked {formatTime(status.checkedAt)} · source: `/api/operational-status`</p></>}
    </section>

    <section aria-labelledby="cycle-heading" className="rounded-xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="cycle-heading" className="text-lg font-medium">Five-stage journal</h2><p className="mt-1 text-xs text-slate-400">Sequential, plain text, local browser storage only.</p></div><button type="button" onClick={clearJournal} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">Clear local journal</button></div>
      {storageError && <p role="alert" className="mt-3 text-sm text-rose-200">{storageError}</p>}
      <ol className="mt-5 space-y-3">{CYCLE_STAGES.map((stage, index) => {
        const event = journal.events[index]; const active = !event && nextStage?.id === stage.id;
        return <li key={stage.id} className={`rounded-lg border p-4 ${active ? "border-cyan-300/40 bg-cyan-300/5" : "border-white/10 bg-black/10"}`}>
          <div className="flex items-center gap-2">{event ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-300" /> : <Circle aria-hidden="true" className="h-4 w-4 text-slate-500" />}<h3 className="text-sm font-medium">{index + 1}. {stage.title}</h3>{active && <span className="ml-auto text-[11px] uppercase tracking-wide text-cyan-200">Next</span>}</div>
          {event && <><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{event.evidence}</p><p className="mt-2 text-xs text-slate-500">Recorded {formatTime(event.recordedAt)} · entered by user</p></>}
        </li>;
      })}</ol>
      {nextStage && <div className="mt-5 space-y-3">
        {nextStage.id === "proposed_upgrade" ? <><p className="text-sm text-slate-300">A proposal is a review packet only. Every field is required; nothing here can be applied, merged, deployed, or sent.</p>
          {([["diff", "Proposed diff"], ["tests", "Tests and results"], ["provenance", "Provenance"], ["rollback", "Rollback path"]] as const).map(([key, label]) => <label key={key} className="block space-y-1 text-sm text-slate-300"><span>{label}</span><textarea value={proposal[key]} onChange={(event) => setProposal((previous) => ({ ...previous, [key]: event.target.value }))} maxLength={2500} rows={3} className="w-full rounded-lg border border-white/15 bg-black/20 p-3 text-sm text-slate-100 outline-none focus:border-cyan-300/50" /></label>)}
        </> : <label className="block space-y-1 text-sm text-slate-300"><span>{nextStage.title} evidence</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={12000} rows={4} className="w-full rounded-lg border border-white/15 bg-black/20 p-3 text-sm text-slate-100 outline-none focus:border-cyan-300/50" placeholder="Enter the source, observation, or evidence. Do not include passwords or credentials." /><span className="block text-xs text-slate-500">{draft.length}/12,000 characters</span></label>}
        <button type="button" onClick={recordStage} disabled={nextStage.id === "proposed_upgrade" ? Object.values(proposal).some((field) => !field.trim()) : !draft.trim()} className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">Record {nextStage.title}</button>
        {statusError && <p role="alert" className="text-sm text-rose-200">{statusError}</p>}
      </div>}
      {!nextStage && <p className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3 text-sm text-emerald-100">All five stages are journaled locally. The proposed upgrade remains unapplied and requires a separate review process.</p>}
      {currentEvent && <p className="sr-only">Last stage recorded: {currentEvent.stage}</p>}
    </section>
    <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />This journal is not a production audit log and does not synchronize across devices. Avoid entering secrets or sensitive personal information. Export and server-side persistence are not implemented in this change.</p>
  </main>;
}
