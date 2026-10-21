import { useEffect, useState, type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Heavy Council, Apr 2026 — Proposals P1, P2, P5, P6, P11
//
// Single-credential, finite-state entry. The operator presents ONE token.
// The server returns an HttpOnly cookie. Browser code never touches the
// canonical token after submission. Four UI states, one CTA per state, plus
// a recovery runbook drawer.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");

type GateState =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "session-secret-missing" }
  | { kind: "locked"; reason?: string }
  | { kind: "submitting" }
  | { kind: "invalid"; reason?: string }
  | { kind: "rate-limited"; retryAfterMs: number }
  | { kind: "expired" }
  | { kind: "unlocked"; expiresAt: number };

interface StatusResponse {
  ok: boolean;
  configured: boolean;
  authenticated: boolean;
  expiresAt?: number;
  reason?: string;
}

async function fetchStatus(): Promise<StatusResponse | null> {
  try {
    const res = await fetch(`${BASE}api/admin/session/status`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as StatusResponse;
  } catch {
    return null;
  }
}

async function postUnlock(token: string): Promise<{ ok: true; expiresAt: number } | { ok: false; status: number; body: unknown }> {
  const res = await fetch(`${BASE}api/admin/session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* ignore */ }
  if (res.ok) {
    const b = body as { expiresAt?: number };
    return { ok: true, expiresAt: b.expiresAt ?? Date.now() + 8 * 3600 * 1000 };
  }
  return { ok: false, status: res.status, body };
}

async function postLogout(): Promise<void> {
  try {
    await fetch(`${BASE}api/admin/session/logout`, { method: "POST", credentials: "include" });
  } catch { /* ignore */ }
}

function classifyStatus(s: StatusResponse | null): GateState {
  if (!s) return { kind: "locked", reason: "network" };
  if (s.reason === "session-signing-unconfigured") return { kind: "session-secret-missing" };
  if (!s.configured) return { kind: "unconfigured" };
  if (s.authenticated && s.expiresAt) return { kind: "unlocked", expiresAt: s.expiresAt };
  if (s.reason === "expired") return { kind: "expired" };
  return { kind: "locked", reason: s.reason };
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ }
      }}
      className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-border text-foreground hover:bg-accent"
    >
      {done ? "copied" : "copy"}
    </button>
  );
}

function RecoveryPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? "▾" : "▸"} Can't unlock? Recovery runbook
      </button>
      {open && (
        <ol className="mt-3 space-y-3 text-xs text-muted-foreground">
          <li>
            <div className="font-semibold text-foreground">1. Generate the admin key</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 px-2 py-1 rounded bg-background font-mono text-primary text-[11px]">openssl rand -base64 48 | tr -d '\n'</code>
              <CopyButton text={"openssl rand -base64 48 | tr -d '\\n'"} />
            </div>
          </li>
          <li>
            <div className="font-semibold text-foreground">2. Generate a separate session-signing secret</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 px-2 py-1 rounded bg-background font-mono text-primary text-[11px]">openssl rand -base64 48 | tr -d '\n'</code>
              <CopyButton text={"openssl rand -base64 48 | tr -d '\\n'"} />
            </div>
          </li>
          <li>
            <div className="font-semibold text-foreground">3. Save both values in the host's private secret store</div>
            <div className="mt-1 text-muted-foreground">Use <code className="px-1 py-0.5 rounded bg-background text-foreground">TESSERACT_ADMIN_KEY</code> for the admin key and <code className="px-1 py-0.5 rounded bg-background text-foreground">SOVEREIGN_SESSION_SECRET</code> for the signing secret. Never put either value in chat, logs, or Git.</div>
          </li>
          <li>
            <div className="font-semibold text-foreground">4. Restart the API service</div>
            <div className="mt-1 text-muted-foreground">Restart the server after saving both secrets.</div>
          </li>
          <li>
            <div className="font-semibold text-foreground">5. Verify the gate</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 px-2 py-1 rounded bg-background font-mono text-primary text-[11px]">curl -sS https://&lt;your-host&gt;/api/admin/session/status</code>
              <CopyButton text={"curl -sS https://<your-host>/api/admin/session/status"} />
            </div>
            <div className="mt-1 text-muted-foreground">Expect configured=true and authenticated=false before entering the admin key here.</div>
          </li>
        </ol>
      )}
    </div>
  );
}

function Frame({ tone, title, body }: { tone: "amber" | "rose" | "emerald" | "zinc"; title: string; body: ReactNode }) {
  const ring = {
    amber: "border-destructive",
    rose: "border-destructive",
    emerald: "border-primary",
    zinc: "border-border",
  }[tone];
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-6">
      <div className={`tessera-gate-frame w-full max-w-xl rounded-2xl border bg-card p-6 text-card-foreground shadow-2xl ${ring}`}>
        <div className="tessera-gate-header">
          <div className="tessera-brand-mark tessera-brand-mark--small" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="tessera-gate-kicker">TESSERA / SESSION GATE</p>
            <p className="text-xs text-muted-foreground mt-0.5">Evidence before execution.</p>
          </div>
        </div>
        <h2 className="font-sans text-lg font-semibold text-foreground">{title}</h2>
        {body}
        <RecoveryPanel />
      </div>
    </div>
  );
}

export default function TesseractKeyGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ kind: "loading" });
  const [tokenInput, setTokenInput] = useState("");

  // Initial probe + periodic re-probe to detect server-side expiry.
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const s = await fetchStatus();
      if (cancelled) return;
      // Don't clobber a transient submitting/invalid state mid-typing.
      setState(prev => {
        if (prev.kind === "submitting" || prev.kind === "invalid" || prev.kind === "rate-limited") return prev;
        return classifyStatus(s);
      });
    };
    probe();
    const t = setInterval(probe, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Auto-expire watch.
  useEffect(() => {
    if (state.kind !== "unlocked") return;
    const ms = Math.max(0, state.expiresAt - Date.now());
    const t = setTimeout(() => setState({ kind: "expired" }), ms);
    return () => clearTimeout(t);
  }, [state]);

  const submit = async () => {
    let tok = tokenInput.trim();
    if (!tok) {
      setState({ kind: "invalid", reason: "empty" });
      return;
    }
    setTokenInput("");
    setState({ kind: "submitting" });
    try {
      const result = await postUnlock(tok);
      if (result.ok) {
        setState({ kind: "unlocked", expiresAt: result.expiresAt });
        return;
      }
      if (result.status === 429) {
        const retry = (result.body as { retryAfterMs?: number })?.retryAfterMs ?? 60_000;
        setState({ kind: "rate-limited", retryAfterMs: retry });
        setTimeout(() => setState({ kind: "locked" }), retry);
        return;
      }
      if (result.status === 503 && (result.body as { error?: string })?.error === "session-signing-unconfigured") {
        setState({ kind: "session-secret-missing" });
        return;
      }
      if (result.status === 503) {
        setState({ kind: "unconfigured" });
        return;
      }
      setState({ kind: "invalid", reason: (result.body as { error?: string })?.error });
    } catch {
      setState({ kind: "locked", reason: "network" });
    } finally {
      tok = "";
    }
  };

  const logout = async () => {
    await postLogout();
    setState({ kind: "locked" });
  };

  if (state.kind === "loading") {
    return <Frame tone="zinc" title="Tesseract — verifying session…" body={<p className="mt-2 text-sm text-muted-foreground">Probing sovereign session.</p>} />;
  }

  if (state.kind === "unlocked") {
    return (
      <>
        {children}
        <div className="fixed bottom-3 right-3 z-[9998] text-[10px] text-primary/80 font-mono">
          ◈ session · expires {new Date(state.expiresAt).toLocaleTimeString()}
          <button onClick={logout} className="ml-2 underline hover:text-foreground">logout</button>
        </div>
      </>
    );
  }

  if (state.kind === "unconfigured") {
    return (
      <Frame
        tone="rose"
        title="◈ Tesseract — sovereign-unconfigured"
        body={
          <div className="mt-3 space-y-3 text-sm text-foreground">
            <p>The server has no <code className="px-1 py-0.5 rounded bg-background text-foreground">TESSERACT_ADMIN_KEY</code> configured.</p>
            <p className="text-muted-foreground">Privileged routes are fail-closed. Open the recovery runbook below to provision one.</p>
          </div>
        }
      />
    );
  }

  if (state.kind === "session-secret-missing") {
    return (
      <Frame
        tone="rose"
        title="◈ Tesseract — session signing is not configured"
        body={
          <div className="mt-3 space-y-3 text-sm text-foreground">
            <p>The server cannot safely sign an admin session. The admin key is not enough by itself.</p>
            <p className="text-muted-foreground">Configure <code className="px-1 py-0.5 rounded bg-background text-foreground">SOVEREIGN_SESSION_SECRET</code> (32+ characters) in the host's private secret store, restart the API, then verify status. The submitted key was cleared and no session was created.</p>
          </div>
        }
      />
    );
  }

  if (state.kind === "rate-limited") {
    const secs = Math.ceil(state.retryAfterMs / 1000);
    return (
      <Frame
        tone="rose"
        title="◈ Tesseract — too many attempts"
        body={
          <p className="mt-3 text-sm text-foreground">Try again in <span className="font-mono text-destructive">{secs}s</span>. Your IP was rate-limited to protect the canonical token.</p>
        }
      />
    );
  }

  const isInvalid = state.kind === "invalid";
  const isSubmitting = state.kind === "submitting";
  const isExpired = state.kind === "expired";
  const isNetworkError = state.kind === "locked" && state.reason === "network";

  return (
    <Frame
      tone={isInvalid || isExpired ? "amber" : "emerald"}
      title={isExpired ? "◈ Tesseract — session expired" : "◈ Tesseract — sovereign entry"}
      body={
        <div className="mt-3 space-y-3 text-sm text-foreground">
          <p>
            Present the <span className="text-primary font-semibold">canonical server admin key</span>.
            It is used only to request an HttpOnly session; do not enter a separate chat sigil here.
          </p>
          <input
            type="password"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="paste TESSERACT_ADMIN_KEY"
            className="w-full px-3 py-2 rounded-md bg-background border border-input text-foreground font-mono text-sm focus:outline-none focus:border-primary"
            disabled={isSubmitting}
          />
          {isInvalid && (
            <p className="text-xs text-destructive">Token rejected. Verify the secret value matches what the server expects, then try again.</p>
          )}
          {isExpired && (
            <p className="text-xs text-destructive">Your previous session expired. Re-present your token to continue.</p>
          )}
          {isNetworkError && (
            <p className="text-xs text-destructive">The session service could not be reached. The submitted key was cleared; check the API service before trying again.</p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting || !tokenInput.trim()}
            className="w-full py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground font-semibold transition-colors"
          >
            {isSubmitting ? "verifying…" : "Unlock Tesseract"}
          </button>
          <p className="text-[11px] text-muted-foreground">
            Once unlocked, the server issues an HttpOnly session cookie (8h). Your token never persists in browser storage.
          </p>
        </div>
      }
    />
  );
}
