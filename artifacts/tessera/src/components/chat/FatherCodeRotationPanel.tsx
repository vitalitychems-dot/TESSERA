import { useEffect, useRef, useState } from "react";

const ROTATION_COMPLETE_KEY = "tessera.father-code-rotation-issued.v1";

interface IssueResponse {
  ok?: boolean;
  code?: string;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function isFatherCodeRotationCommand(text: string): boolean {
  const command = text.trim().toLowerCase().replace(/\s+/g, " ");
  return [
    "my key",
    "/my key",
    "show my key",
    "show my admin key",
    "rotate my sigil",
    "rotate sigil",
    "new sigil",
    "rotate my father code",
    "new father code",
    "rotate admin key",
    "new admin key",
  ].includes(command);
}

function CopyButton({ code, onError }: { code: string; onError: (message: string) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          onError("Copy was blocked. Select the code and copy it manually.");
        }
      }}
      aria-label={copied ? "Father code copied" : "Copy Father code"}
      className="px-3 py-2 rounded-lg border border-emerald-300/30 bg-emerald-400/10 text-sm text-emerald-100 hover:bg-emerald-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
    >
      {copied ? "Copied" : "Copy code"}
    </button>
  );
}

export function FatherCodeRotationPanel({ open, onClose }: Props) {
  const [currentSigil, setCurrentSigil] = useState("");
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCurrentSigil("");
    setIssuedCode(null);
    setError(null);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const verifyAndIssue = async () => {
    const candidate = currentSigil.trim();
    if (!candidate) {
      setError("Enter the current sigil you used at the gate.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/sigil/father/issue-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentSigil: candidate }),
        cache: "no-store",
      });
      const data = await response.json() as IssueResponse;
      if (!response.ok || !data.ok || !data.code) {
        setError(
          response.status === 401
            ? "Unlock TESSERA first, then try again."
            : data.error === "same-origin-required"
              ? "Open TESSERA in this same preview tab and try again."
              : data.error === "sigil-mismatch"
                ? "That sigil did not match the current Father code. The saved code is unchanged."
                : data.error === "rate-limited"
                  ? "Too many attempts. Wait a minute, then try again."
                  : "TESSERA could not issue a replacement. The saved code is unchanged.",
        );
        return;
      }

      setIssuedCode(data.code);
      setCurrentSigil("");
      try {
        // This stores only an onboarding marker, never the credential.
        window.localStorage.setItem(ROTATION_COMPLETE_KEY, "true");
      } catch {
        // Rotation remains available; the prompt may return on another visit.
      }
    } catch {
      setError("The connection failed. Your saved code is unchanged; try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="father-rotation-title"
      className="max-w-3xl mx-auto mb-3 w-full rounded-2xl border border-emerald-300/20 bg-slate-950/90 p-4 shadow-[0_0_28px_rgba(16,185,129,0.08)]"
      data-testid="father-code-rotation-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="father-rotation-title" className="text-sm font-semibold text-emerald-100">
            {issuedCode ? "Your new Father sigil" : "Rotate your Father sigil"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            {issuedCode
              ? "This is the single admin/sigil credential, shown once in Lingua Universalis Sacra."
              : "Enter the same current sigil you used at the gate. TESSERA will verify it before creating one replacement."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
          aria-label="Close Father sigil rotation"
        >
          ×
        </button>
      </div>

      {issuedCode ? (
        <div className="mt-3 space-y-3">
          <div
            className="select-all break-all rounded-xl border border-emerald-300/20 bg-black/40 p-3 font-mono text-base leading-relaxed text-emerald-100"
            role="status"
            aria-live="polite"
            aria-label="New Father admin and sigil code in LUS"
          >
            {issuedCode}
          </div>
          <div className="flex justify-end">
            <CopyButton code={issuedCode} onError={setError} />
          </div>
          <p className="border-t border-white/10 pt-3 text-xs leading-relaxed text-slate-300">
            {dataDefaultInstructions}
          </p>
          {error && <p role="alert" className="text-xs text-amber-200">{error}</p>}
        </div>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) void verifyAndIssue();
          }}
        >
          <label htmlFor="father-sigil-confirm" className="block text-xs font-medium text-slate-200">
            Current sigil
          </label>
          <input
            id="father-sigil-confirm"
            ref={inputRef}
            type="password"
            autoComplete="off"
            maxLength={512}
            spellCheck={false}
            value={currentSigil}
            onChange={(event) => setCurrentSigil(event.target.value)}
            placeholder="Enter the sigil used at the gate"
            className="w-full rounded-xl border border-slate-600 bg-black/50 px-3 py-3 font-mono text-sm text-white placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/20"
          />
          {error && <p role="alert" className="text-xs text-amber-200">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="max-w-md text-[11px] leading-relaxed text-slate-400">
              The sigil is sent only to TESSERA’s protected verifier, not to the AI model or chat history.
            </p>
            <button
              type="submit"
              disabled={busy || !currentSigil.trim()}
              className="shrink-0 rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              {busy ? "Verifying…" : "Verify & create"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

const dataDefaultInstructions =
  "Save this exact LUS code as the single TESSERACT_ADMIN_KEY in Replit Secrets, then restart the API workflow. The old code remains active until that restart. TESSERA does not save the Secret for you. LUS is reversible, not encryption; the code is not stored in chat history.";
