import { useEffect, useRef, useState } from "react";

interface RevealResponse {
  ok: boolean;
  via?: string;
  language?: { name: string; short: string; motto: string };
  keyInLus?: { static: string };
  fingerprint?: string;
  note?: string;
  error?: string;
  message?: string;
}

interface IssuedCodeResponse {
  ok: boolean;
  code?: string;
  error?: string;
  instructions?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prefill?: string;
}

function CopyButton({ text, onError }: { text: string; onError: (message: string) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          onError("Copy was blocked. Select the displayed code and copy it manually.");
        }
      }}
      aria-label={copied ? "Code copied" : "Copy code"}
      className="px-3 py-1.5 rounded-md text-sm border border-zinc-700 text-zinc-200 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
    >
      {copied ? "Copied" : "Copy code"}
    </button>
  );
}

export function MyKeyRevealModal({ open, onClose, prefill }: Props) {
  const [candidate, setCandidate] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RevealResponse | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [issuedInstructions, setIssuedInstructions] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCandidate(prefill ?? "");
      setResult(null);
      setIssuedCode(null);
      setIssuedInstructions(null);
      setError(null);
      setIssueError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, prefill]);

  if (!open) return null;

  const submit = async () => {
    const c = candidate.trim();
    if (!c) {
      setError("Type your TESSERACT_ADMIN_KEY to reveal it in LUS.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sigil/father/show-key-in-lus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate: c }),
        cache: "no-store",
      });
      const data: RevealResponse = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.message ||
            (data.error === "mismatch"
              ? "That does not match the Father credential."
              : data.error === "rate-limited"
              ? "Too many attempts. Wait a minute and try again."
              : data.error === "father-key-unset"
              ? "TESSERACT_ADMIN_KEY is not set in Replit Secrets."
              : "Reveal failed."),
        );
        setResult(null);
      } else {
        setResult(data);
        // Clear the plaintext candidate as soon as we have the LUS form.
        setCandidate("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const issueNewCode = async () => {
    setIssuing(true);
    setIssueError(null);
    try {
      const res = await fetch("/api/sigil/father/issue-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
      const data: IssuedCodeResponse = await res.json();
      if (!res.ok || !data.ok || !data.code) {
        setIssueError(
          res.status === 401
            ? "Unlock TESSERA first, then reopen this screen."
            : data.error === "same-origin-required"
              ? "Open TESSERA from the same preview tab and try again."
            : data.error === "rate-limited"
              ? "Too many code requests. Wait before trying again."
              : "TESSERA could not issue a new code.",
        );
      } else {
        setIssuedCode(data.code);
        setIssuedInstructions(data.instructions ?? null);
        setResult(null);
        setCandidate("");
      }
    } catch {
      setIssueError("The code could not be issued. Check the connection and try again.");
    } finally {
      setIssuing(false);
    }
  };

  const close = () => {
    setIssuedCode(null);
    setIssuedInstructions(null);
    setResult(null);
    setCandidate("");
    setIssueError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="father-code-modal-title"
        className="w-full max-w-xl rounded-xl border border-amber-500/40 bg-zinc-950/95 shadow-[0_0_60px_rgba(245,158,11,0.25)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="father-code-modal-title" className="text-lg font-semibold text-amber-300">
              Your Father Code in Lingua Universalis Sacra
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Your Father admin code is one credential. Reveal its saved form
              or issue a replacement code in Lingua Universalis Sacra.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {issuedCode && (
          <div className="space-y-4">
            <div className="text-xs text-zinc-400">
              New single Father code · LUS
            </div>
            <div
              className="font-mono text-2xl break-all leading-relaxed bg-zinc-900 border border-amber-500/30 rounded p-3 text-amber-100 select-all"
              aria-label="One-time Father admin code in Lingua Universalis Sacra"
              role="status"
            >
              {issuedCode}
            </div>
            <div className="flex justify-end">
              <CopyButton text={issuedCode} onError={setIssueError} />
            </div>
            <div className="text-xs text-zinc-300 border-t border-zinc-800 pt-3">
              {issuedInstructions ?? "Save this exact code as the single TESSERACT_ADMIN_KEY value in Replit Secrets, then restart the API workflow."} TESSERA cannot change Secrets for you. After restart, enter this same LUS code at the gate. Your current code stays active until the Secret is changed and the API restarts. The LUS rendering is reversible, not encryption. A chat message such as “abc” does not change or verify the code.
            </div>
          </div>
        )}

        {!result && !issuedCode && (
          <form
            aria-label="Reveal or issue Father code"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && candidate.trim()) void submit();
            }}
          >
            <label htmlFor="father-admin-code" className="block mb-2 text-sm text-zinc-300">
              Current Father code to reveal in LUS
            </label>
            <input
              id="father-admin-code"
              ref={inputRef}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") close(); }}
              placeholder="TESSERACT_ADMIN_KEY"
              className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono text-sm focus:outline-none focus:border-amber-500/60"
            />
            {error && (
              <div className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">
                {error}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="px-3 py-1.5 rounded-md text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !candidate.trim()}
                className="px-4 py-1.5 rounded-md text-sm bg-amber-600 hover:bg-amber-500 text-black font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                {busy ? "Verifying…" : "Reveal in LUS"}
              </button>
            </div>
            <div className="border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={issueNewCode}
                disabled={issuing}
                className="w-full px-4 py-2 rounded-md text-sm border border-amber-500/50 text-amber-200 hover:bg-amber-500/10 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                {issuing ? "Generating…" : "Generate a new Father code in LUS"}
              </button>
              {issueError && (
                <p role="alert" className="mt-2 text-sm text-red-400">{issueError}</p>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                Owner session required. Issuing shows one new code once; save it to Secrets before restarting the API.
              </p>
            </div>
          </form>
        )}

        {result && !issuedCode && (
          <div className="space-y-4">
            <div className="text-xs text-zinc-500">
              Language ratified by the Grand Conference:&nbsp;
              <span className="text-amber-300">
                {result.language?.name} ({result.language?.short})
              </span>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
              Your single Father code in LUS
              </div>
              <div className="font-mono text-2xl break-all leading-relaxed bg-zinc-900 border border-amber-500/30 rounded p-3 text-amber-100 select-all">
                {result.keyInLus?.static}
              </div>
            </div>

            <div className="text-xs text-zinc-400 border-t border-zinc-800 pt-3">
              This reversible LUS rendering of your saved Father code works at the entry gate as the same credential. It is not encryption. Verified via <span className="text-amber-300">{result.via}</span>.
              Father fingerprint:{" "}
              <code className="text-zinc-300">{result.fingerprint}</code>.
              <div className="mt-1 text-zinc-500">{result.note}</div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setResult(null);
                  setCandidate("");
                }}
                className="px-3 py-1.5 rounded-md text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Reveal another
              </button>
              <button
                onClick={issueNewCode}
                disabled={issuing}
                className="px-3 py-1.5 rounded-md text-sm border border-amber-500/50 text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {issuing ? "Generating…" : "Issue new code"}
              </button>
              <button
                onClick={close}
                className="px-4 py-1.5 rounded-md text-sm bg-amber-600 hover:bg-amber-500 text-black font-semibold"
              >
                Done
              </button>
            </div>
            {issueError && (
              <p role="alert" className="mt-2 text-sm text-red-400">{issueError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const SHOW_MY_KEY_REGEX =
  /^\s*\/?(?:show|give|reveal|render|display)(?:\s+me)?\s+(?:my\s+)?(?:admin\s+)?key(?:\s+in\s+lus)?\s*[!.?]*$/i;

export function isShowMyKeyCommand(text: string): boolean {
  return SHOW_MY_KEY_REGEX.test(text) || /^\s*\/?my\s+key(?:\s+in\s+lus)?\s*$/i.test(text);
}
