import { useState } from "react";

type OwnerDataCounts = {
  conversations: number;
  messages: number;
  feedback: number;
  modelRoutingLogs: number;
  providerCalls: number;
  providerDiffs: number;
  natalCharts: number;
  identityVerifications: number;
};

type DeletePreview = {
  previewToken: string;
  confirmPhrase: string;
  expiresAt: string;
  counts: OwnerDataCounts;
};

const API = import.meta.env.VITE_API_URL || "";
const EMPTY_COUNTS: OwnerDataCounts = {
  conversations: 0,
  messages: 0,
  feedback: 0,
  modelRoutingLogs: 0,
  providerCalls: 0,
  providerDiffs: 0,
  natalCharts: 0,
  identityVerifications: 0,
};

const COUNT_LABELS: Array<[keyof OwnerDataCounts, string]> = [
  ["conversations", "Saved chats"],
  ["messages", "Chat messages"],
  ["feedback", "Feedback records"],
  ["modelRoutingLogs", "Routing records"],
  ["providerCalls", "Provider call records"],
  ["providerDiffs", "Provider comparison records"],
  ["natalCharts", "Stored Father chart"],
  ["identityVerifications", "Identity verification records"],
];

export default function PersonalDataPanel() {
  const [counts, setCounts] = useState<OwnerDataCounts | null>(null);
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function readJson(response: Response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) {
      throw new Error(body?.error || `Request failed (${response.status})`);
    }
    return body;
  }

  async function loadSummary() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API}/api/privacy/data/summary`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await readJson(response);
      setCounts(body.counts as OwnerDataCounts);
    } catch {
      setError("Owner session required, or the private data summary is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadExport() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API}/api/privacy/data/export`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Export unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tessera-owner-data-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setNotice("Private data export download started.");
    } catch {
      setError("Export failed. Your saved data has not been changed.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewDeletion() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API}/api/privacy/data/delete/preview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await readJson(response);
      setPreview({
        previewToken: body.previewToken,
        confirmPhrase: body.confirmPhrase,
        expiresAt: body.expiresAt,
        counts: body.counts,
      });
      setCounts(body.counts);
      setConfirmation("");
    } catch {
      setError("Could not prepare a deletion review. Nothing was deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteReviewedData() {
    if (!preview || confirmation !== preview.confirmPhrase) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API}/api/privacy/data/delete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewToken: preview.previewToken,
          confirmation,
        }),
      });
      await readJson(response);
      setCounts(EMPTY_COUNTS);
      setPreview(null);
      setConfirmation("");
      setNotice("The reviewed owner data was deleted. Authentication credentials and Replit Secrets were not changed.");
    } catch {
      setError("Deletion did not complete. Review the current data again; no partial deletion was applied.");
      setPreview(null);
      setConfirmation("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="personal-data-heading"
      className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5 space-y-4"
      data-testid="panel-personal-data"
    >
      <div>
        <h2 id="personal-data-heading" className="text-base font-semibold text-white">Private data</h2>
        <p className="mt-1 text-sm text-white/65">
          This app has one owner session and no user accounts. Export or remove the owner workspace’s saved chats and listed records.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-white/65">
        New provider telemetry stores performance metadata, not prompt or response text. Older provider records may contain content.
        Export and delete are owner-gated. Nothing expires or is deleted automatically.
        The Father chart source in Replit Secrets, authentication hashes, and shared system/knowledge state are not included.
        Removing the stored chart hides it and prevents reseeding; the secret source must be removed separately in Replit Secrets.
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={loadSummary}
          disabled={busy}
          className="min-h-11 rounded-xl border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ef0d4] disabled:opacity-50"
        >
          {busy ? "Working…" : "Review data counts"}
        </button>
        <button
          type="button"
          onClick={downloadExport}
          disabled={busy}
          className="min-h-11 rounded-xl border border-[#7ef0d4]/40 px-4 py-2 text-sm text-[#b9fff0] hover:bg-[#7ef0d4]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ef0d4] disabled:opacity-50"
        >
          Download owner export
        </button>
        <button
          type="button"
          onClick={reviewDeletion}
          disabled={busy}
          className="min-h-11 rounded-xl border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ef0d4] disabled:opacity-50"
        >
          Review deletion
        </button>
      </div>

      {counts && (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Owner data record counts">
          {COUNT_LABELS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
              <dt className="text-white/65">{label}</dt>
              <dd className="font-mono text-white">{counts[key]}</dd>
            </div>
          ))}
        </dl>
      )}

      {preview && (
        <div className="space-y-3 rounded-xl border border-[#ff5c39]/35 bg-[#ff5c39]/[0.06] p-3">
          <h3 className="font-semibold text-white">Review before deleting</h3>
          <p className="text-sm text-white/70">
            This removes every listed record in the single-owner workspace. The review expires at {new Date(preview.expiresAt).toLocaleTimeString()}.
            Export first if you need a copy.
          </p>
          <label htmlFor="delete-owner-data-confirmation" className="block text-sm text-white/80">
            Type <span className="font-mono font-semibold text-white">{preview.confirmPhrase}</span> to approve:
          </label>
          <input
            id="delete-owner-data-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            maxLength={64}
            className="min-h-11 w-full rounded-lg border border-white/20 bg-black/50 px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7ef0d4]"
            data-testid="input-delete-owner-data-confirmation"
          />
          <button
            type="button"
            onClick={deleteReviewedData}
            disabled={busy || confirmation !== preview.confirmPhrase}
            className="min-h-11 rounded-xl border border-[#ff5c39]/60 px-4 py-2 text-sm font-semibold text-[#ff9c84] hover:bg-[#ff5c39]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5c39] disabled:opacity-40"
            data-testid="button-delete-owner-data"
          >
            Delete reviewed data
          </button>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-[#ff9c84]">{error}</p>}
      {notice && <p role="status" aria-live="polite" className="text-sm text-[#b9fff0]">{notice}</p>}
    </section>
  );
}
