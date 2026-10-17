import { useEffect, useRef, useState } from "react";

interface IssueResponse {
  ok?: boolean;
  code?: string;
  confirmationToken?: string;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function isFatherCodeRotationCommand(text: string): boolean {
  const command = text.trim().toLowerCase().replace(/\s+/g, " ");
  return [
    "rotate my sigil",
    "rotate sigil",
    "new sigil",
    "rotate my chat sigil",
    "rotate chat sigil",
    "new chat sigil",
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
      aria-label={copied ? "Private chat sigil copied" : "Copy private chat sigil"}
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
  const [confirmationToken, setConfirmationToken] = useState("");
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [initialize, setInitialize] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activated, setActivated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCurrentSigil("");
    setIssuedCode(null);
    setError(null);
    setConfirmationToken("");
    setSaved(false);
    setActivated(false);
    setInitialize(false);
    setEnrolled(null);
    const controller = new AbortController();
    void fetch("/api/sigil/father/status", { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        if (data.rotatedThisSession) { onClose(); return; }
        setEnrolled(data.enrolled === true);
      })
      .catch(() => { if (!controller.signal.aborted) setError("Sigil storage is unavailable. Retry after the connection recovers."); });
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [open]);

  if (!open) return null;

  const verifyAndIssue = async () => {
    const candidate = currentSigil.trim();
    if (!candidate) {
      setError("Enter your last saved chat sigil, not your admin key.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/sigil/father/issue-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentSigil: candidate, initialize: enrolled === false && initialize }),
        cache: "no-store",
      });
      const data = await response.json() as IssueResponse;
      if (!response.ok || !data.ok || !data.code || !data.confirmationToken) {
        setError(
          response.status === 401
            ? "Unlock TESSERA first, then try again."
            : data.error === "same-origin-required"
              ? "Open TESSERA in this same preview tab and try again."
              : data.error === "sigil-mismatch"
                ? "That is not your last saved chat sigil. Nothing was changed."
                : data.error === "sigil-length"
                  ? "Use a sigil between 8 and 512 characters."
                  : data.error === "already-rotated-this-session"
                    ? "The sigil was already rotated in this owner session."
                : data.error === "rate-limited"
                  ? "Too many attempts. Wait a minute, then try again."
                  : "TESSERA could not issue a replacement. The saved code is unchanged.",
        );
        return;
      }

      setIssuedCode(data.code);
      setConfirmationToken(data.confirmationToken);
      setCurrentSigil("");
    } catch {
      setError("The connection failed. Your saved code is unchanged; try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmSaved = async () => {
    if (!saved) {
      setError("Save the new sigil privately before activating it.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/sigil/father/confirm-code", {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationToken }),
      });
      // Always verify the committed state. This handles a lost confirmation
      // response and gives the owner an authoritative success receipt.
      const status = await fetch("/api/sigil/father/status", { credentials: "include", cache: "no-store" });
      if (!status.ok || !(await status.json()).rotatedThisSession) throw new Error("not-confirmed");
      setIssuedCode(null);
      setConfirmationToken("");
      setActivated(true);
    } catch {
      setError("Confirmation was not verified. Keep both sigils until you can confirm; your admin key is unchanged.");
    } finally { setBusy(false); }
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
            {issuedCode ? "Your new chat sigil" : "Rotate your chat sigil"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            {issuedCode
              ? "Save this Lingua Universalis Sacra sigil privately, then confirm below. Your admin key stays the same."
              : enrolled === false
                ? "Your separate chat sigil has not been enrolled. Use the sigil you already saved to set up this layer."
                : "Enter your last saved chat sigil. This is separate from the admin key used at the entry gate."}
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

      {activated ? (
        <div className="mt-3 space-y-3">
          <p
            role="status"
            aria-label="New private chat sigil activated"
            className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3 text-sm leading-relaxed text-emerald-100"
          >
            New private chat sigil activated for this session. Your Father admin key is unchanged.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-primary/40 bg-primary/15 p-3 text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Continue to chat
          </button>
        </div>
      ) : issuedCode ? (
        <div className="mt-3 space-y-3">
          <div
            className="select-all break-all rounded-xl border border-emerald-300/20 bg-black/40 p-3 font-mono text-base leading-relaxed text-emerald-100"
            role="status"
            aria-live="polite"
            aria-label="New private chat sigil in LUS"
          >
            {issuedCode}
          </div>
          <div className="flex justify-end">
            <CopyButton code={issuedCode} onError={setError} />
          </div>
          <p className="border-t border-white/10 pt-3 text-xs leading-relaxed text-slate-300">
            {dataDefaultInstructions}
          </p>
          <label className="flex gap-2 items-start text-sm text-foreground">
            <input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} />
            I saved this new sigil somewhere private.
          </label>
          <button type="button" disabled={!saved || busy} onClick={() => void confirmSaved()}
            className="w-full rounded-lg border border-primary/40 bg-primary/15 p-3 text-primary disabled:opacity-50">
            {busy ? "Confirming…" : "Confirm saved & activate new sigil"}
          </button>
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
            placeholder="Last saved chat sigil"
            className="w-full rounded-xl border border-slate-600 bg-black/50 px-3 py-3 font-mono text-sm text-white placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/20"
          />
          {enrolled === false && (
            <label className="flex gap-2 items-start text-xs text-foreground">
              <input type="checkbox" checked={initialize} onChange={event => setInitialize(event.target.checked)} />
              Enroll this saved sigil as my separate chat credential. Leave my admin key unchanged.
            </label>
          )}
          {error && <p role="alert" className="text-xs text-amber-200">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="max-w-md text-[11px] leading-relaxed text-slate-400">
              The sigil is sent only to TESSERA’s protected verifier, not to the AI model or chat history.
            </p>
            <button
              type="submit"
              disabled={busy || currentSigil.trim().length < 8 || enrolled === null || (enrolled === false && !initialize)}
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
  "Do not put this in TESSERACT_ADMIN_KEY and do not restart the API. Your old chat sigil stays valid until you confirm saving this replacement. The pending replacement expires in 15 minutes. Only hashes are stored; neither sigil enters AI prompts, chat history, or browser storage.";
