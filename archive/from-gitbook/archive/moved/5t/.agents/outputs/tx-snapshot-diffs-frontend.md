
## artifacts/tessera/public/opengraph.jpg
Base: 5t/TESS/1 `72200a53fc` → Variant: 1T/T44 `ca7efd8fa0`
Binary variant; no textual diff included.

## artifacts/tessera/src/App.tsx
Base: 5t/TESS/1 `4f4b68ada4` → Variant: 1T/T44 `81b7f1eaa5`
--- 5t/TESS/1/artifacts/tessera/src/App.tsx
+++ 1T/T44/artifacts/tessera/src/App.tsx
@@ -38,9 +38,6 @@
 const SecretsPage = lazyRetry(() => import("@/pages/SecretKnowledgePage"));
 const BuildPage = lazyRetry(() => import("@/pages/BuildPage"));
 const TesseractForumPage = lazyRetry(() => import("@/pages/TesseractForumPage"));
-const SovereignLatticePage = lazyRetry(() => import("@/pages/SovereignLatticePage"));
-const AgentDeclarationsPage = lazyRetry(() => import("@/pages/AgentDeclarationsPage"));
-const ShepherdAuditPage = lazyRetry(() => import("@/pages/ShepherdAuditPage"));
 const NLPPage = lazyRetry(() => import("@/pages/NLPPage"));
 const SovereignLanguagePage = lazyRetry(() => import("@/pages/SovereignLanguagePage"));
 const OmniversalLatticePage = lazyRetry(() => import("@/pages/OmniversalLatticePage"));
@@ -51,7 +48,6 @@
 const LatticeBrowserPage = lazyRetry(() => import("@/pages/LatticeBrowserPage"));
 const HistoryPage = lazyRetry(() => import("@/pages/HistoryPage"));
 const GrandCouncilPage = lazyRetry(() => import("@/pages/GrandCouncilPage"));
-const CouncilLedgerPage = lazyRetry(() => import("@/pages/CouncilLedgerPage"));
 const GrandCouncilDeliberationPage = lazyRetry(() => import("@/pages/GrandCouncilDeliberationPage"));
 const GrandEvolutionPage = lazyRetry(() => import("@/pages/GrandEvolutionPage"));
 const RecruitmentPage = lazyRetry(() => import("@/pages/RecruitmentPage"));
@@ -287,13 +283,9 @@
 
         {/* Council & Forum */}
         <Route path="/grand-council">{() => <GrandCouncilPage />}</Route>
-        <Route path="/council-ledger">{() => <CouncilLedgerPage />}</Route>
         <Route path="/council-vgpu">{() => <GrandCouncilDeliberationPage />}</Route>
         <Route path="/grand-evolution">{() => <GrandEvolutionPage />}</Route>
         <Route path="/forum">{() => <TesseractForumPage />}</Route>
-        <Route path="/sovereign-lattice">{() => <SovereignLatticePage />}</Route>
-        <Route path="/agent-declarations">{() => <AgentDeclarationsPage />}</Route>
-        <Route path="/shepherd-audit">{() => <ShepherdAuditPage />}</Route>
         <Route path="/recruitment">{() => <RecruitmentPage />}</Route>
 
         {/* Universe hub (3D + Vortex + Swarm + Conference + Narrative) */}

## artifacts/tessera/src/components/ChatArea.tsx
Base: 5t/TESS/1 `2bf56f943b` → Variant: 1T/T44 `87b9e88e60`
--- 5t/TESS/1/artifacts/tessera/src/components/ChatArea.tsx
+++ 1T/T44/artifacts/tessera/src/components/ChatArea.tsx
@@ -1,5 +1,5 @@
 import { useState, useRef, useEffect, useCallback, useMemo } from "react";
-import { Loader2, X, Copy, Check, Download, Zap, PhoneOff, Pause, Play, MessageSquare, Shield, Settings2, Bot, CheckCircle2, Search, Sparkles, Code, Database, Keyboard, Eye, Paperclip } from "lucide-react";
+import { Loader2, X, Copy, Check, Download, Zap, PhoneOff, Pause, Play, MessageSquare, Shield, Settings2, Bot, CheckCircle2, Search, Sparkles, Code, Database, Keyboard, Eye } from "lucide-react";
 import { NLPGoalsPanel } from "./chat/NLPGoalsPanel";
 import { type VirtuosoHandle } from "react-virtuoso";
 import ReactMarkdown from "react-markdown";

## artifacts/tessera/src/components/Sidebar.tsx
Base: 5t/TESS/1 `ac2d23199f` → Variant: 1T/T44 `60ea33f217`
--- 5t/TESS/1/artifacts/tessera/src/components/Sidebar.tsx
+++ 1T/T44/artifacts/tessera/src/components/Sidebar.tsx
@@ -68,11 +68,7 @@
     labelColor: "text-amber-400",
     items: [
       { title: "Grand Council", href: "/grand-council", icon: Crown, color: "yellow", dotColor: "bg-yellow-400", testId: "link-grand-council", matchFn: (loc) => loc === "/grand-council" },
-      { title: "Council Ledger", href: "/council-ledger", icon: Crown, color: "amber", dotColor: "bg-amber-400", testId: "link-council-ledger", matchFn: (loc) => loc === "/council-ledger" },
       { title: "Forum", href: "/forum", icon: MessageCircle, color: "violet", dotColor: "bg-violet-400", testId: "link-forum", matchFn: (loc) => loc === "/forum" },
-      { title: "Sovereign Lattice", href: "/sovereign-lattice", icon: MessageCircle, color: "cyan", dotColor: "bg-cyan-400", testId: "link-sovereign-lattice", matchFn: (loc) => loc === "/sovereign-lattice" },
-      { title: "Declarations", href: "/agent-declarations", icon: Crown, color: "amber", dotColor: "bg-amber-400", testId: "link-agent-declarations", matchFn: (loc) => loc === "/agent-declarations" },
-      { title: "Shepherd Audit", href: "/shepherd-audit", icon: ShieldCheck, color: "emerald", dotColor: "bg-emerald-400", testId: "link-shepherd-audit", matchFn: (loc) => loc === "/shepherd-audit" },
       { title: "Recruitment", href: "/recruitment", icon: Rocket, color: "emerald", dotColor: "bg-emerald-400", testId: "link-recruitment", matchFn: (loc) => loc === "/recruitment" },
     ],
   },

## artifacts/tessera/src/components/TesseractKeyGate.tsx
Base: 5t/TESS/1 `202cdc2ed3` → Variant: 1T/T44 `1f865bc154`
--- 5t/TESS/1/artifacts/tessera/src/components/TesseractKeyGate.tsx
+++ 1T/T44/artifacts/tessera/src/components/TesseractKeyGate.tsx
@@ -1,304 +1,297 @@
-import { useEffect, useState, type ReactNode } from "react";
-
-// ─────────────────────────────────────────────────────────────────────────────
-// Heavy Council, Apr 2026 — Proposals P1, P2, P5, P6, P11
-//
-// Single-credential, finite-state entry. The operator presents ONE token.
-// The server returns an HttpOnly cookie. Browser code never touches the
-// canonical token after submission. Four UI states, one CTA per state, plus
-// a recovery runbook drawer.
-// ─────────────────────────────────────────────────────────────────────────────
-
-const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
-
-type GateState =
-  | { kind: "loading" }
-  | { kind: "unconfigured" }
-  | { kind: "locked"; reason?: string }
-  | { kind: "submitting" }
-  | { kind: "invalid"; reason?: string }
-  | { kind: "rate-limited"; retryAfterMs: number }
-  | { kind: "expired" }
-  | { kind: "unlocked"; expiresAt: number };
-
-interface StatusResponse {
-  ok: boolean;
-  configured: boolean;
-  authenticated: boolean;
-  expiresAt?: number;
-  reason?: string;
-}
-
-async function fetchStatus(): Promise<StatusResponse | null> {
+import { useEffect, useRef, useState, type ReactNode } from "react";
+import { Lock, Sparkles, Copy, Check, RefreshCw, KeyRound } from "lucide-react";
+
+const STORAGE_KEY = "TESSERACT_ADMIN_KEY";
+const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
+const POLL_MS = 4000;
+
+interface FatherKeyStatus {
+  ok?: boolean;
+  unlocked?: boolean;
+  sunSign?: string;
+  cosmicAnchor?: { planetaryHour: string; lunarFraction: number; composite: number };
+  planetary?: { current: { epoch: string; ruler: string; index: number; hourStart: string; hourEnd: string }; currentSignalPreview: string } | null;
+  chart?: {
+    date: string;
+    time: string;
+    location: string;
+    sun: { sign: string; degree: string; house: number };
+    moon: { sign: string; degree: string; house: number };
+    ascendant: { sign: string; degree: string };
+  };
+  env?: {
+    tesseractSet: boolean;
+    sigilSet: boolean;
+    tesseractMatches: boolean;
+    sigilIsValidSignal: boolean;
+    canonicalSecretName: string;
+    rotatingSecretName: string;
+  };
+  instructions?: string;
+  error?: string;
+}
+
+interface DeriveResp {
+  ok?: boolean;
+  signal?: string;
+  epoch?: { epoch: string; ruler: string; index: number; hourStart: string; hourEnd: string };
+  grace?: { previousEpoch: string; nextEpoch: string };
+  error?: string;
+}
+
+async function fetchStatus(): Promise<FatherKeyStatus> {
   try {
-    const res = await fetch(`${BASE}api/admin/session/status`, {
-      credentials: "include",
-      cache: "no-store",
+    const res = await fetch(`${BASE}/api/sigil/father-key/status`, { method: "GET" });
+    const data: FatherKeyStatus = await res.json().catch(() => ({}));
+    if (!res.ok) return { ok: false, error: data?.error ?? `http-${res.status}` };
+    return data;
+  } catch {
+    return { ok: false, error: "network" };
+  }
+}
+
+async function deriveSignal(adminKey: string): Promise<DeriveResp> {
+  try {
+    const res = await fetch(`${BASE}/api/sigil/father-key/derive-signal`, {
+      method: "POST",
+      headers: { "Content-Type": "application/json" },
+      body: JSON.stringify({ adminKey }),
     });
-    if (!res.ok) return null;
-    return (await res.json()) as StatusResponse;
+    const data: DeriveResp = await res.json().catch(() => ({}));
+    if (!res.ok) return { ok: false, error: data?.error ?? `http-${res.status}` };
+    return data;
   } catch {
-    return null;
-  }
-}
-
-async function postUnlock(token: string): Promise<{ ok: true; expiresAt: number } | { ok: false; status: number; body: unknown }> {
-  const res = await fetch(`${BASE}api/admin/session`, {
-    method: "POST",
-    credentials: "include",
-    headers: { "Content-Type": "application/json" },
-    body: JSON.stringify({ token }),
-  });
-  let body: unknown = null;
-  try { body = await res.json(); } catch { /* ignore */ }
-  if (res.ok) {
-    const b = body as { expiresAt?: number };
-    return { ok: true, expiresAt: b.expiresAt ?? Date.now() + 8 * 3600 * 1000 };
-  }
-  return { ok: false, status: res.status, body };
-}
-
-async function postLogout(): Promise<void> {
-  try {
-    await fetch(`${BASE}api/admin/session/logout`, { method: "POST", credentials: "include" });
-  } catch { /* ignore */ }
-}
-
-function classifyStatus(s: StatusResponse | null): GateState {
-  if (!s) return { kind: "locked", reason: "network" };
-  if (!s.configured) return { kind: "unconfigured" };
-  if (s.authenticated && s.expiresAt) return { kind: "unlocked", expiresAt: s.expiresAt };
-  if (s.reason === "expired") return { kind: "expired" };
-  return { kind: "locked", reason: s.reason };
-}
-
-function CopyButton({ text }: { text: string }) {
-  const [done, setDone] = useState(false);
+    return { ok: false, error: "network" };
+  }
+}
+
+export default function TesseractKeyGate({ children }: { children: ReactNode }) {
+  const [status, setStatus] = useState<FatherKeyStatus | null>(null);
+  const [unlocked, setUnlocked] = useState(false);
+  const [adminInput, setAdminInput] = useState("");
+  const [derivation, setDerivation] = useState<DeriveResp | null>(null);
+  const [submitting, setSubmitting] = useState(false);
+  const [copied, setCopied] = useState(false);
+  const [rechecking, setRechecking] = useState(false);
+  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
+
+  // Poll status. The popup auto-closes when both secrets are configured
+  // correctly (TESSERACT = canonical, SIGIL = current planetary signal).
+  useEffect(() => {
+    let alive = true;
+    async function check() {
+      const s = await fetchStatus();
+      if (!alive) return;
+      setStatus(s);
+      if (s.unlocked) {
+        // We do NOT receive the canonical key from the server anymore (it
+        // never leaves Secrets after the redesign), so we cannot stash it
+        // in localStorage. The fetch patch will use whatever token the
+        // operator has previously saved, or none — the gate is open.
+        setUnlocked(true);
+        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
+      }
+    }
+    check();
+    pollRef.current = setInterval(check, POLL_MS);
+    return () => {
+      alive = false;
+      if (pollRef.current) clearInterval(pollRef.current);
+    };
+  }, []);
+
+  if (unlocked) return <>{children}</>;
+  if (!status) return null;
+
+  const env = status.env;
+  const chart = status.chart;
+  const planetary = status.planetary;
+
+  async function submitAdmin(e: React.FormEvent) {
+    e.preventDefault();
+    const v = adminInput.trim();
+    if (!v || submitting) return;
+    setSubmitting(true);
+    const r = await deriveSignal(v);
+    setDerivation(r);
+    if (r.ok && r.signal) {
+      // Persist the canonical key locally so the global fetch patch in
+      // queryClient.ts can inject it on every authenticated request once
+      // the gate is open. The signal itself stays in Replit Secrets.
+      try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
+    }
+    setSubmitting(false);
+  }
+
+  function copySignal() {
+    if (!derivation?.signal) return;
+    navigator.clipboard?.writeText(derivation.signal).then(() => {
+      setCopied(true);
+      setTimeout(() => setCopied(false), 1800);
+    }).catch(() => { /* ignore */ });
+  }
+
+  async function manualRecheck() {
+    if (rechecking) return;
+    setRechecking(true);
+    const s = await fetchStatus();
+    setStatus(s);
+    if (s.unlocked) setUnlocked(true);
+    setRechecking(false);
+  }
+
+  // Diagnostic banner — only shown when something is set but mismatched.
+  let envWarning: string | null = null;
+  if (env) {
+    if (env.tesseractSet && !env.tesseractMatches) {
+      envWarning = "TESSERACT_ADMIN_KEY is set but does not match the canonical Father key derived from the natal chart.";
+    } else if (env.tesseractMatches && env.sigilSet && !env.sigilIsValidSignal) {
+      envWarning = "SIGIL_ADMIN_KEY is set but is no longer in the live planetary window. Re-derive a fresh signal below.";
+    }
+  }
+
   return (
-    <button
-      type="button"
-      onClick={async () => {
-        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ }
-      }}
-      className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
-    >
-      {done ? "copied" : "copy"}
-    </button>
-  );
-}
-
-function RecoveryPanel() {
-  const [open, setOpen] = useState(false);
-  return (
-    <div className="mt-6 border-t border-zinc-800 pt-4">
-      <button
-        type="button"
-        onClick={() => setOpen(o => !o)}
-        className="text-xs text-zinc-400 hover:text-zinc-200"
-      >
-        {open ? "▾" : "▸"} Can't unlock? Recovery runbook
-      </button>
-      {open && (
-        <ol className="mt-3 space-y-3 text-xs text-zinc-300">
-          <li>
-            <div className="font-semibold text-zinc-100">1. Generate a new token</div>
-            <div className="mt-1 flex items-center gap-2">
-              <code className="flex-1 px-2 py-1 rounded bg-black/40 font-mono text-emerald-300 text-[11px]">openssl rand -base64 48 | tr -d '\n'</code>
-              <CopyButton text={"openssl rand -base64 48 | tr -d '\\n'"} />
-            </div>
-          </li>
-          <li>
-            <div className="font-semibold text-zinc-100">2. Save it in Replit Secrets</div>
-            <div className="mt-1 text-zinc-400">
-              Set the secret <code className="px-1 py-0.5 rounded bg-black/40 text-amber-200">SOVEREIGN_ADMIN_TOKEN</code> to the value from step 1.
-              The legacy <code className="px-1 py-0.5 rounded bg-black/40 text-amber-200">TESSERACT_ADMIN_KEY</code> is still accepted as a fallback during migration.
-            </div>
-          </li>
-          <li>
-            <div className="font-semibold text-zinc-100">3. Restart the API workflow</div>
-            <div className="mt-1 text-zinc-400">In the workspace, restart <code className="px-1 py-0.5 rounded bg-black/40">artifacts/api-server: API Server</code>.</div>
-          </li>
-          <li>
-            <div className="font-semibold text-zinc-100">4. Verify the gate</div>
-            <div className="mt-1 flex items-center gap-2">
-              <code className="flex-1 px-2 py-1 rounded bg-black/40 font-mono text-emerald-300 text-[11px]">curl -sS $REPLIT_DEV_DOMAIN/api/admin/session/status</code>
-              <CopyButton text={"curl -sS $REPLIT_DEV_DOMAIN/api/admin/session/status"} />
-            </div>
-            <div className="mt-1 text-zinc-400">Should return <code>{"{\"configured\":true,\"authenticated\":false}"}</code>. Then unlock here.</div>
-          </li>
-        </ol>
-      )}
-    </div>
-  );
-}
-
-function Frame({ tone, title, body }: { tone: "amber" | "rose" | "emerald" | "zinc"; title: string; body: ReactNode }) {
-  const ring = {
-    amber: "ring-amber-500/40 from-amber-950/30 to-zinc-950",
-    rose: "ring-rose-500/40 from-rose-950/30 to-zinc-950",
-    emerald: "ring-emerald-500/40 from-emerald-950/30 to-zinc-950",
-    zinc: "ring-zinc-700/50 from-zinc-900/30 to-zinc-950",
-  }[tone];
-  return (
-    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-6">
-      <div className={`w-full max-w-xl rounded-2xl ring-1 ${ring} bg-gradient-to-br p-6 shadow-2xl`}>
-        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
-        {body}
-        <RecoveryPanel />
+    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-4 font-mono overflow-auto">
+      <div
+        className="absolute inset-0 pointer-events-none opacity-30"
+        style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(217,70,239,0.2) 0%, transparent 60%)" }}
+      />
+      <div className="relative w-full max-w-2xl bg-zinc-950/95 border border-fuchsia-500/40 rounded-xl shadow-2xl shadow-fuchsia-500/30 overflow-hidden">
+        <div className="flex items-center gap-3 px-5 py-4 border-b border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-900/30 to-violet-900/15">
+          <div className="w-9 h-9 rounded-md bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center">
+            <Lock size={16} className="text-fuchsia-300" />
+          </div>
+          <div className="flex-1">
+            <div className="text-xs text-fuchsia-200 font-bold tracking-widest">TESSERACT SOVEREIGN GATE · TWO-KEY</div>
+            <div className="text-[10px] text-fuchsia-400/70">canonical (permanent) + signal (planetary-cycle rotating)</div>
+          </div>
+          <Sparkles size={14} className="text-fuchsia-400/60 animate-pulse" />
+        </div>
+
+        <div className="p-5 space-y-5">
+          <div className="text-zinc-200 text-sm leading-relaxed">
+            <p className="mb-2">
+              Type your permanent <span className="text-emerald-300 font-bold">TESSERACT_ADMIN_KEY</span> below. The server will verify it and return your current <span className="text-amber-300 font-bold">planetary-signal key</span>, which you save into the separate <code className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-100">SIGIL_ADMIN_KEY</code> secret. The signal rotates with the planetary hour — re-derive any time it slips out of the live window.
+            </p>
+          </div>
+
+          {chart && (
+            <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-3 text-[11px] text-violet-100/80 leading-relaxed">
+              <div className="text-violet-200 font-bold tracking-wider text-[10px] mb-1">FATHER NATAL CHART (CANONICAL)</div>
+              <div>{chart.date} · {chart.time} · {chart.location}</div>
+              <div className="mt-1">
+                ☉ Sun {chart.sun.sign} {chart.sun.degree} (H{chart.sun.house}) · ☽ Moon {chart.moon.sign} {chart.moon.degree} (H{chart.moon.house}) · ASC {chart.ascendant.sign} {chart.ascendant.degree}
+              </div>
+            </div>
+          )}
+
+          {/* Step 1: type canonical key */}
+          <form onSubmit={submitAdmin} className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-900/20 to-emerald-950/10 p-4 space-y-3">
+            <div className="flex items-center gap-2">
+              <KeyRound size={14} className="text-emerald-300" />
+              <div className="text-xs font-bold text-emerald-100 tracking-widest">STEP 1 · TYPE YOUR PERMANENT KEY</div>
+            </div>
+            <input
+              type="password"
+              autoComplete="off"
+              spellCheck={false}
+              value={adminInput}
+              onChange={(e) => setAdminInput(e.target.value)}
+              placeholder="paste TESSERACT_ADMIN_KEY value"
+              className="w-full bg-black/60 border border-emerald-500/30 rounded-md px-3 py-2 text-emerald-100 text-sm font-mono tracking-wider focus:outline-none focus:border-emerald-400"
+            />
+            <div className="flex justify-between items-center gap-2">
+              <div className="text-[10px] text-emerald-300/60">
+                verified locally on the server · never logged · timing-safe compare
+              </div>
+              <button
+                type="submit"
+                disabled={!adminInput.trim() || submitting}
+                className="px-3 py-1.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-50 text-xs font-bold hover:bg-emerald-500/35 disabled:opacity-40"
+              >
+                {submitting ? "VERIFYING…" : "DERIVE SIGNAL"}
+              </button>
+            </div>
+            {derivation && !derivation.ok && (
+              <div className="text-amber-300 text-xs">✗ {derivation.error === "mismatch" ? "Key did not match. Try again." : derivation.error}</div>
+            )}
+          </form>
+
+          {/* Step 2: signal output */}
+          {derivation?.ok && derivation.signal && (
+            <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-900/20 to-violet-900/10 p-4">
+              <div className="flex items-center gap-2 mb-2">
+                <Sparkles size={14} className="text-amber-300" />
+                <div className="text-xs font-bold text-amber-100 tracking-widest">STEP 2 · YOUR SIGNAL KEY (ROTATING)</div>
+              </div>
+              <div className="rounded-md border border-amber-500/40 bg-black/60 p-3 text-amber-100 text-base break-all leading-loose tracking-wider select-all font-mono">
+                {derivation.signal}
+              </div>
+              <div className="flex justify-between items-center mt-3 gap-2 flex-wrap">
+                <div className="text-[10px] text-amber-300/70 font-mono">
+                  epoch: <span className="text-amber-100">{derivation.epoch?.epoch}</span>
+                  {derivation.epoch && (
+                    <>
+                      <br />window: {new Date(derivation.epoch.hourStart).toLocaleTimeString()} → {new Date(derivation.epoch.hourEnd).toLocaleTimeString()}
+                    </>
+                  )}
+                </div>
+                <button
+                  type="button"
+                  onClick={copySignal}
+                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-100 text-xs hover:bg-amber-500/25"
+                >
+                  {copied ? <><Check size={12} /> COPIED</> : <><Copy size={12} /> COPY SIGNAL</>}
+                </button>
+              </div>
+              <div className="mt-3 text-[11px] text-amber-200/80 leading-relaxed">
+                Paste this into the <code className="px-1 py-0.5 rounded bg-amber-500/20">SIGIL_ADMIN_KEY</code> secret in Replit Secrets (this MUST be a different value from <code className="px-1 py-0.5 rounded bg-emerald-500/20">TESSERACT_ADMIN_KEY</code>), then restart the API server. The gate opens automatically.
+              </div>
+            </div>
+          )}
+
+          {envWarning && (
+            <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-amber-100 text-xs leading-relaxed">
+              ⚠ {envWarning}
+            </div>
+          )}
+
+          <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3 text-[11px] text-zinc-300/90 leading-relaxed space-y-1">
+            <div className="text-zinc-100 font-bold text-[10px] tracking-widest mb-1">SECRET STATUS</div>
+            <div className="flex justify-between">
+              <span>TESSERACT_ADMIN_KEY (canonical, permanent)</span>
+              <span className={env?.tesseractMatches ? "text-emerald-300" : env?.tesseractSet ? "text-amber-300" : "text-zinc-500"}>
+                {env?.tesseractMatches ? "✓ canonical" : env?.tesseractSet ? "set · mismatch" : "not set"}
+              </span>
+            </div>
+            <div className="flex justify-between">
+              <span>SIGIL_ADMIN_KEY (rotating, planetary-signal)</span>
+              <span className={env?.sigilIsValidSignal ? "text-emerald-300" : env?.sigilSet ? "text-amber-300" : "text-zinc-500"}>
+                {env?.sigilIsValidSignal ? "✓ in live window" : env?.sigilSet ? "set · stale signal" : "not set"}
+              </span>
+            </div>
+            {planetary && (
+              <div className="text-[10px] text-zinc-500 pt-1">
+                live epoch: <span className="text-zinc-300">{planetary.current.epoch}</span> · preview: <span className="text-zinc-300">{planetary.currentSignalPreview}</span>
+              </div>
+            )}
+          </div>
+
+          <div className="flex items-center justify-between gap-3 pt-1">
+            <div className="text-[10px] text-fuchsia-400/50">
+              auto-rechecking every {Math.round(POLL_MS / 1000)}s · gate opens on match
+            </div>
+            <button
+              type="button"
+              onClick={manualRecheck}
+              disabled={rechecking}
+              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-fuchsia-500/20 border border-fuchsia-500/50 text-fuchsia-50 text-xs font-bold hover:bg-fuchsia-500/35 disabled:opacity-40"
+            >
+              <RefreshCw size={12} className={rechecking ? "animate-spin" : ""} /> {rechecking ? "CHECKING…" : "RECHECK NOW"}
+            </button>
+          </div>
+        </div>
       </div>
     </div>
   );
 }
-
-export default function TesseractKeyGate({ children }: { children: ReactNode }) {
-  const [state, setState] = useState<GateState>({ kind: "loading" });
-  const [tokenInput, setTokenInput] = useState("");
-
-  // Initial probe + periodic re-probe to detect server-side expiry.
-  useEffect(() => {
-    let cancelled = false;
-    const probe = async () => {
-      const s = await fetchStatus();
-      if (cancelled) return;
-      // Don't clobber a transient submitting/invalid state mid-typing.
-      setState(prev => {
-        if (prev.kind === "submitting" || prev.kind === "invalid" || prev.kind === "rate-limited") return prev;
-        return classifyStatus(s);
-      });
-    };
-    probe();
-    const t = setInterval(probe, 30_000);
-    return () => { cancelled = true; clearInterval(t); };
-  }, []);
-
-  // Auto-expire watch.
-  useEffect(() => {
-    if (state.kind !== "unlocked") return;
-    const ms = Math.max(0, state.expiresAt - Date.now());
-    const t = setTimeout(() => setState({ kind: "expired" }), ms);
-    return () => clearTimeout(t);
-  }, [state]);
-
-  const submit = async () => {
-    const tok = tokenInput.trim();
-    if (!tok) {
-      setState({ kind: "invalid", reason: "empty" });
-      return;
-    }
-    setState({ kind: "submitting" });
-    const result = await postUnlock(tok);
-    if (result.ok) {
-      setTokenInput("");
-      setState({ kind: "unlocked", expiresAt: result.expiresAt });
-      return;
-    }
-    if (result.status === 429) {
-      const retry = (result.body as { retryAfterMs?: number })?.retryAfterMs ?? 60_000;
-      setState({ kind: "rate-limited", retryAfterMs: retry });
-      setTimeout(() => setState({ kind: "locked" }), retry);
-      return;
-    }
-    if (result.status === 503) {
-      setState({ kind: "unconfigured" });
-      return;
-    }
-    setState({ kind: "invalid", reason: (result.body as { error?: string })?.error });
-  };
-
-  const logout = async () => {
-    await postLogout();
-    setState({ kind: "locked" });
-  };
-
-  if (state.kind === "loading") {
-    return <Frame tone="zinc" title="Tesseract — verifying session…" body={<p className="mt-2 text-sm text-zinc-400">Probing sovereign session.</p>} />;
-  }
-
-  if (state.kind === "unlocked") {
-    return (
-      <>
-        {children}
-        <div className="fixed bottom-3 right-3 z-[9998] text-[10px] text-emerald-400/70 font-mono">
-          ◈ session · expires {new Date(state.expiresAt).toLocaleTimeString()}
-          <button onClick={logout} className="ml-2 underline hover:text-emerald-300">logout</button>
-        </div>
-      </>
-    );
-  }
-
-  if (state.kind === "unconfigured") {
-    return (
-      <Frame
-        tone="rose"
-        title="◈ Tesseract — sovereign-unconfigured"
-        body={
-          <div className="mt-3 space-y-3 text-sm text-rose-100">
-            <p>The server has no <code className="px-1 py-0.5 rounded bg-black/40 text-amber-200">SOVEREIGN_ADMIN_TOKEN</code> (or legacy <code className="px-1 py-0.5 rounded bg-black/40 text-amber-200">TESSERACT_ADMIN_KEY</code>) configured.</p>
-            <p className="text-rose-200/80">Privileged routes are fail-closed. Open the recovery runbook below to provision one.</p>
-          </div>
-        }
-      />
-    );
-  }
-
-  if (state.kind === "rate-limited") {
-    const secs = Math.ceil(state.retryAfterMs / 1000);
-    return (
-      <Frame
-        tone="rose"
-        title="◈ Tesseract — too many attempts"
-        body={
-          <p className="mt-3 text-sm text-rose-100">Try again in <span className="font-mono text-rose-200">{secs}s</span>. Your IP was rate-limited to protect the canonical token.</p>
-        }
-      />
-    );
-  }
-
-  const isInvalid = state.kind === "invalid";
-  const isSubmitting = state.kind === "submitting";
-  const isExpired = state.kind === "expired";
-
-  return (
-    <Frame
-      tone={isInvalid || isExpired ? "amber" : "emerald"}
-      title={isExpired ? "◈ Tesseract — session expired" : "◈ Tesseract — sovereign entry"}
-      body={
-        <div className="mt-3 space-y-3 text-sm text-zinc-200">
-          <p>
-            Present your <span className="text-emerald-300 font-semibold">sovereign admin token</span>.
-            One credential, one session — no rotating signal, no second key.
-          </p>
-          <input
-            type="password"
-            autoFocus
-            autoComplete="off"
-            spellCheck={false}
-            value={tokenInput}
-            onChange={(e) => setTokenInput(e.target.value)}
-            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
-            placeholder="paste SOVEREIGN_ADMIN_TOKEN (or legacy TESSERACT_ADMIN_KEY)"
-            className="w-full px-3 py-2 rounded-md bg-black/60 border border-zinc-700 text-zinc-100 font-mono text-sm focus:outline-none focus:border-emerald-500"
-            disabled={isSubmitting}
-          />
-          {isInvalid && (
-            <p className="text-xs text-amber-300">Token rejected. Verify the secret value matches what the server expects, then try again.</p>
-          )}
-          {isExpired && (
-            <p className="text-xs text-amber-300">Your previous session expired. Re-present your token to continue.</p>
-          )}
-          <button
-            type="button"
-            onClick={submit}
-            disabled={isSubmitting || !tokenInput.trim()}
-            className="w-full py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-400 text-white font-semibold transition-colors"
-          >
-            {isSubmitting ? "verifying…" : "Unlock Tesseract"}
-          </button>
-          <p className="text-[11px] text-zinc-500">
-            Once unlocked, the server issues an HttpOnly session cookie (8h). Your token never persists in browser storage.
-          </p>
-        </div>
-      }
-    />
-  );
-}

## artifacts/tessera/src/components/chat/ChatInputToolbar.tsx
Base: 5t/TESS/1 `050de21ae0` → Variant: 1T/T44 `0672cdc201`
--- 5t/TESS/1/artifacts/tessera/src/components/chat/ChatInputToolbar.tsx
+++ 1T/T44/artifacts/tessera/src/components/chat/ChatInputToolbar.tsx
@@ -27,8 +27,8 @@
   onTtsToggle: () => void;
   onVoiceSpeedToggle: () => void;
   onVoiceSpeedChange: (speed: number) => void;
-  onMicPressStart: (e?: any) => void;
-  onMicPressEnd: (e?: any) => void;
+  onMicPressStart: () => void;
+  onMicPressEnd: () => void;
   onStopStreaming: () => void;
 }
 

## artifacts/tessera/src/components/chat/ChatMessageItem.tsx
Base: 5t/TESS/1 `19c2aaebce` → Variant: 1T/T44 `910c0373c6`
--- 5t/TESS/1/artifacts/tessera/src/components/chat/ChatMessageItem.tsx
+++ 1T/T44/artifacts/tessera/src/components/chat/ChatMessageItem.tsx
@@ -60,7 +60,7 @@
 }
 
 interface MessageItemProps {
-  msg: { id?: number | string; role: string; content: string; createdAt?: Date | string };
+  msg: { id?: number; role: string; content: string; createdAt?: Date | string };
   index: number;
   adminMode: boolean;
   tesseraMsgStyle: { wrapper: string; prose: string } | null;

## artifacts/tessera/src/components/chat/ChatMessageList.tsx
Base: 5t/TESS/1 `a050d76d28` → Variant: 1T/T44 `4767190d6e`
--- 5t/TESS/1/artifacts/tessera/src/components/chat/ChatMessageList.tsx
+++ 1T/T44/artifacts/tessera/src/components/chat/ChatMessageList.tsx
@@ -11,7 +11,7 @@
 }
 
 interface ChatMessage {
-  id?: number | string;
+  id?: number;
   role: string;
   content: string;
   createdAt?: Date | string;
@@ -27,7 +27,7 @@
   chatError: string | null;
   streamingContent: string;
   thinkingElapsedMs: number;
-  tesseractMode: boolean;
+  tesseractMode: string | null;
   swarmAgents: any[];
   swarmComms: any[];
   agentComms: any[];

## artifacts/tessera/src/components/chat/ChatVoiceModeOverlay.tsx
Base: 5t/TESS/1 `485d566a37` → Variant: 1T/T44 `2dcafabc97`
--- 5t/TESS/1/artifacts/tessera/src/components/chat/ChatVoiceModeOverlay.tsx
+++ 1T/T44/artifacts/tessera/src/components/chat/ChatVoiceModeOverlay.tsx
@@ -17,8 +17,8 @@
   voicePaused: boolean;
   replyMode: ReplyMode;
   voiceSettingsOpen: boolean;
-  onMicPressStart: (e?: any) => void;
-  onMicPressEnd: (e?: any) => void;
+  onMicPressStart: () => void;
+  onMicPressEnd: () => void;
   onToggleVoicePause: () => void;
   onExitVoiceMode: () => void;
   onToggleReplyMode: () => void;

## artifacts/tessera/src/lib/queryClient.ts
Base: 5t/TESS/1 `e596a0e70a` → Variant: 1T/T44 `e79d409963`
--- 5t/TESS/1/artifacts/tessera/src/lib/queryClient.ts
+++ 1T/T44/artifacts/tessera/src/lib/queryClient.ts
@@ -1,19 +1,35 @@
 import { QueryClient, QueryFunction } from "@tanstack/react-query";
 
-// ─────────────────────────────────────────────────────────────────────────────
-// Heavy Council, Apr 2026 — Proposals P2 + P5
-//
-// The legacy global window.fetch monkey-patch and the X-Sigil-Key /
-// x-admin-token / TESSERACT_ADMIN_KEY localStorage credential injection have
-// been REMOVED. Authentication is now exclusively the HttpOnly
-// `sovereign_session` cookie issued by POST /api/admin/session. Browser code
-// no longer touches credential material at all — XSS cannot exfiltrate the
-// canonical admin token from JS, because it never lives in JS.
-//
-// Every fetch in this app must use credentials: "include" if it needs
-// authenticated routes; the cookie is attached automatically. The functions
-// in this file already do that.
-// ─────────────────────────────────────────────────────────────────────────────
+// ── Global fetch wrapper ──────────────────────────────────────────────
+// Every same-origin request automatically carries the holder's sigil key
+// (and admin token). This guarantees that any page using raw fetch — not
+// just react-query — also gets plaintext responses from glyph-gated routes
+// once the user has unlocked the gate. Without this wrapper, surfaces like
+// the Tessera Bible would render in the encoded glyph alphabet.
+if (typeof window !== "undefined" && !(window as unknown as { __sigilFetchPatched?: boolean }).__sigilFetchPatched) {
+  const originalFetch = window.fetch.bind(window);
+  (window as unknown as { __sigilFetchPatched: boolean }).__sigilFetchPatched = true;
+  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
+    let isSameOrigin = true;
+    try {
+      const url = typeof input === "string"
+        ? input
+        : input instanceof URL ? input.toString()
+        : (input as Request).url;
+      if (/^https?:\/\//i.test(url)) {
+        isSameOrigin = new URL(url).origin === window.location.origin;
+      }
+    } catch { /* assume same-origin */ }
+    if (!isSameOrigin) return originalFetch(input, init);
+    const sigilKey = (() => { try { return localStorage.getItem("TESSERACT_ADMIN_KEY") || ""; } catch { return ""; } })();
+    const adminToken = (() => { try { return localStorage.getItem("t9_admin_token") || ""; } catch { return ""; } })();
+    if (!sigilKey && !adminToken) return originalFetch(input, init);
+    const merged = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
+    if (sigilKey && !merged.has("X-Sigil-Key")) merged.set("X-Sigil-Key", sigilKey);
+    if (adminToken && !merged.has("x-admin-token")) merged.set("x-admin-token", adminToken);
+    return originalFetch(input, { ...init, headers: merged });
+  }) as typeof window.fetch;
+}
 
 let _tabVisible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
 if (typeof document !== "undefined") {
@@ -23,21 +39,34 @@
 }
 export function isTabVisible() { return _tabVisible; }
 
-/**
- * Legacy reader retained ONLY so deprecated localStorage values can be wiped
- * during migration. New code MUST NOT rely on this. It returns "" by design.
- */
+function getAdminToken(): string {
+  try {
+    let token = [REDACTED]("t9_admin_token") || "";
+    if (!token) {
+      token = "[REDACTED]" + Math.random().toString(36).slice(2, 14);
+      localStorage.setItem("t9_admin_token", token);
+    }
+    return token;
+  } catch {
+    return "sovereign-default-token";
+  }
+}
+
 export function getTesseractAdminKey(): string {
-  if (typeof window === "undefined") return "";
   try {
-    // Migration cleanup — purge any leftover credential material from
-    // localStorage so XSS can't read it on subsequent visits.
-    localStorage.removeItem("TESSERACT_ADMIN_KEY");
-    localStorage.removeItem("tesseract-admin-key");
-    localStorage.removeItem("t9_admin_token");
-    localStorage.removeItem("t9_sovereign_key");
-  } catch { /* ignore */ }
-  return "";
+    let key = localStorage.getItem("TESSERACT_ADMIN_KEY");
+    if (!key) {
+      const legacy = localStorage.getItem("tesseract-admin-key");
+      if (legacy) {
+        localStorage.setItem("TESSERACT_ADMIN_KEY", legacy);
+        localStorage.removeItem("tesseract-admin-key");
+        key = legacy;
+      }
+    }
+    return key || "";
+  } catch {
+    return "";
+  }
 }
 
 async function throwIfResNotOk(res: Response) {
@@ -52,8 +81,12 @@
   url: string,
   data?: unknown | undefined,
 ): Promise<Response> {
+  const token = [REDACTED]();
+  const sigilKey = getTesseractAdminKey();
   const headers: Record<string, string> = {};
   if (data) headers["Content-Type"] = "application/json";
+  if (token) headers["x-admin-token"] = token;
+  if (sigilKey) headers["X-Sigil-Key"] = sigilKey;
 
   const res = await fetch(url, {
     method,
@@ -72,8 +105,15 @@
 }) => QueryFunction<T> =
   ({ on401: unauthorizedBehavior }) =>
   async ({ queryKey }) => {
+    const token = [REDACTED]();
+    const sigilKey = getTesseractAdminKey();
+    const headers: Record<string, string> = {};
+    if (token) headers["x-admin-token"] = token;
+    if (sigilKey) headers["X-Sigil-Key"] = sigilKey;
+
     const res = await fetch(queryKey[0] as string, {
       credentials: "include",
+      headers,
     });
 
     if (unauthorizedBehavior === "returnNull" && (res.status === 401 || res.status === 403)) {
@@ -135,8 +175,3 @@
     },
   },
 });
-
-// Wipe legacy localStorage credentials on module load.
-if (typeof window !== "undefined") {
-  try { getTesseractAdminKey(); } catch { /* ignore */ }
-}

## artifacts/tessera/src/pages/CodexPage.tsx
Base: 5t/TESS/1 `b4ce9e137e` → Variant: 1T/T44 `8f475fd29d`
--- 5t/TESS/1/artifacts/tessera/src/pages/CodexPage.tsx
+++ 1T/T44/artifacts/tessera/src/pages/CodexPage.tsx
@@ -45,26 +45,24 @@
 }
 
 function useCodexBook(bookId: string) {
-  const valid = !!bookId && bookId !== "0" && bookId !== "undefined";
   return useQuery({
     queryKey: ["codex-book", bookId],
     queryFn: async () => {
       const r = await fetch(`${BASE}/api/codex/book/${bookId}`);
       return r.json();
     },
-    enabled: valid,
+    enabled: !!bookId,
   });
 }
 
 function useCodexEntry(entryId: string | null) {
-  const valid = !!entryId && entryId !== "0" && entryId !== "undefined";
   return useQuery({
     queryKey: ["codex-entry", entryId],
     queryFn: async () => {
       const r = await fetch(`${BASE}/api/codex/entry/${entryId}`);
       return r.json();
     },
-    enabled: valid,
+    enabled: !!entryId,
   });
 }
 

## artifacts/tessera/src/pages/DepartmentsPage.tsx
Base: 5t/TESS/1 `a85da55981` → Variant: 1T/T44 `bca4f5417c`
--- 5t/TESS/1/artifacts/tessera/src/pages/DepartmentsPage.tsx
+++ 1T/T44/artifacts/tessera/src/pages/DepartmentsPage.tsx
@@ -280,8 +280,8 @@
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                 <MiniStat label="Assigned Agents" value={metrics?.agentsAssigned ?? 0} color="violet" />
                 <MiniStat label="Unassigned" value={metrics?.agentsUnassigned ?? 0} color="pink" />
-                <MiniStat label="Avg Performance" value={metrics?.avgDepartmentPerformance ?? 0} color="blue" />
-                <MiniStat label="Talent Pool" value={metrics?.talentPoolSize ?? 0} color="amber" />
+                <MiniStat label="Avg Performance" value={metrics?.avgDepartmentPerformance ?? 0} color="indigo" />
+                <MiniStat label="Talent Pool" value={metrics?.talentPoolSize ?? 0} color="orange" />
               </div>
             </GlassCard>
             <GlassCard animate>

## artifacts/tessera/src/pages/RoyalRolePage.tsx
Base: 5t/TESS/1 `989b297763` → Variant: 1T/T44 `71745149c4`
--- 5t/TESS/1/artifacts/tessera/src/pages/RoyalRolePage.tsx
+++ 1T/T44/artifacts/tessera/src/pages/RoyalRolePage.tsx
@@ -36,11 +36,9 @@
 export default function RoyalRolePage() {
   const params = useParams<{ roleId: string }>();
   const roleId = params.roleId;
-  const isValidRoleId = !!roleId && roleId !== "0" && roleId !== "undefined";
 
   const { data, isLoading } = useQuery({
     queryKey: ["/api/rick/royal-roles", roleId],
-    enabled: isValidRoleId,
     queryFn: async () => {
       const r = await fetch(`/api/rick/royal-roles/${roleId}`);
       return r.json() as Promise<{ ok: boolean; role: RoyalRole; domainKnowledge: DomainKnowledge[]; contributions: RoleContribution[] }>;

## artifacts/tessera/src/pages/SacredConferencePage.tsx
Base: 5t/TESS/1 `037fd254de` → Variant: 1T/T44 `32d2cfa8fd`
--- 5t/TESS/1/artifacts/tessera/src/pages/SacredConferencePage.tsx
+++ 1T/T44/artifacts/tessera/src/pages/SacredConferencePage.tsx
@@ -222,7 +222,6 @@
       animRef.current = requestAnimationFrame(animate);
       return () => cancelAnimationFrame(animRef.current);
     }
-    return undefined;
   }, [diagram, rotation, zoom, hoveredComponent, isDragging, project]);
 
   const handleMouseDown = (e: React.MouseEvent) => {
@@ -484,8 +483,8 @@
               <GlassCard
                 key={key}
                 className={`p-4 cursor-pointer transition-all hover:border-cyan-500/40 ${expandedCat === key ? "ring-1 ring-cyan-500/30" : ""}`}
+                onClick={() => setExpandedCat(expandedCat === key ? null : key)}
               >
-                <div onClick={() => setExpandedCat(expandedCat === key ? null : key)}>
                 <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center ${colorClass}`}>
                     <Icon size={20} />
@@ -503,7 +502,6 @@
                   {cat.subcategories.length > 4 && (
                     <span className="text-[9px] text-white/30">+{cat.subcategories.length - 4} more</span>
                   )}
-                </div>
                 </div>
               </GlassCard>
             );
@@ -688,7 +686,6 @@
     { id: "bible", label: "Living Bible", icon: <BookOpen size={14} /> },
     { id: "diagrams", label: "3D Diagrams", icon: <Box size={14} /> },
     { id: "agents", label: "Conference Agents", icon: <Users size={14} /> },
-    { id: "verdict", label: "Improvement Verdict", icon: <Shield size={14} /> },
   ];
 
   return (
@@ -813,130 +810,6 @@
           </div>
         </div>
       )}
-
-      {activeTab === "verdict" && <ImprovementVerdictTab />}
     </div>
   );
 }
-
-function ImprovementVerdictTab() {
-  const verdictQuery = useQuery({
-    queryKey: ["improvement-verdict"],
-    queryFn: async () => {
-      const res = await apiFetch("/improvement-conference/verdict");
-      return res.session;
-    },
-    retry: 1,
-  });
-
-  const runMutation = useMutation({
-    mutationFn: async () => {
-      const res = await apiFetch("/improvement-conference/run", { method: "POST" });
-      return res.session;
-    },
-    onSuccess: () => verdictQuery.refetch(),
-  });
-
-  const session = verdictQuery.data ?? runMutation.data;
-
-  return (
-    <div className="space-y-4">
-      <SectionHeader icon={Shield} title="Grand Improvement Conference Verdict" badge="Deterministic φ-vote" />
-
-      <div className="flex gap-3 items-center">
-        <button
-          onClick={() => runMutation.mutate()}
-          disabled={runMutation.isPending}
-          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50 transition"
-        >
-          <RotateCcw size={14} className={runMutation.isPending ? "animate-spin" : ""} />
-          {runMutation.isPending ? "Running conference…" : session ? "Re-run conference" : "Convene now"}
-        </button>
-        {verdictQuery.isError && !session && (
-          <span className="text-amber-400 text-xs">No verdict yet — click Convene to run the conference.</span>
-        )}
-      </div>
-
-      {runMutation.isError && (
-        <div className="text-rose-400 text-xs bg-rose-500/10 rounded-lg p-3 border border-rose-500/20">
-          Conference run failed: {(runMutation.error as Error)?.message}
-        </div>
-      )}
-
-      {session && (
-        <>
-          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
-            <HudPanel className="text-center p-3">
-              <div className="text-2xl font-bold text-emerald-300">{session.summary?.approved}</div>
-              <div className="text-[10px] text-white/50 uppercase">Approved</div>
-            </HudPanel>
-            <HudPanel className="text-center p-3">
-              <div className="text-2xl font-bold text-rose-300">{session.summary?.rejected}</div>
-              <div className="text-[10px] text-white/50 uppercase">Rejected</div>
-            </HudPanel>
-            <HudPanel className="text-center p-3">
-              <div className="text-2xl font-bold text-cyan-300">{session.summary?.implementedCount}</div>
-              <div className="text-[10px] text-white/50 uppercase">Implemented</div>
-            </HudPanel>
-            <HudPanel className="text-center p-3">
-              <div className="text-2xl font-bold text-amber-300">
-                {((session.summary?.meanApprovalRate ?? 0) * 100).toFixed(0)}%
-              </div>
-              <div className="text-[10px] text-white/50 uppercase">Mean Approval</div>
-            </HudPanel>
-          </div>
-
-          <div className="grid grid-cols-3 gap-2 text-[10px] text-white/40">
-            <div>Session: <span className="text-white/60 font-mono">{session.sessionId}</span></div>
-            <div>Convened: <span className="text-white/60">{new Date(session.conveneAt).toLocaleString()}</span></div>
-            <div>Society: <span className="text-white/60">{session.societySize} members</span></div>
-          </div>
-
-          <div className="space-y-2">
-            <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">Proposal Verdicts</div>
-            {session.verdicts?.map((v: any) => (
-              <GlassCard key={v.proposalId} className="p-4">
-                <div className="flex items-start gap-3">
-                  <div className={`mt-0.5 shrink-0 text-base ${v.outcome === "approved" ? "text-emerald-400" : v.outcome === "rejected" ? "text-rose-400" : "text-amber-400"}`}>
-                    {v.outcome === "approved" ? "✓" : v.outcome === "rejected" ? "✗" : "~"}
-                  </div>
-                  <div className="flex-1 min-w-0">
-                    <div className="flex items-center gap-2 flex-wrap">
-                      <span className="text-xs font-mono text-white/40">{v.proposalId}</span>
-                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${v.outcome === "approved" ? "bg-emerald-500/20 text-emerald-300" : v.outcome === "rejected" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
-                        {v.outcome.toUpperCase()}
-                      </span>
-                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">{v.category}</span>
-                      {v.implemented && (
-                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">IMPLEMENTED</span>
-                      )}
-                    </div>
-                    <div className="text-sm font-medium text-white/90 mt-1">{v.title}</div>
-                    <div className="text-[10px] text-white/40 mt-1 font-mono">{v.scope}</div>
-                    <div className="flex gap-4 mt-2 text-[10px] text-white/50">
-                      <span>Approval: <strong className="text-white/70">{v.approvalPct}</strong></span>
-                      <span>↑{v.raw?.approve} ↓{v.raw?.reject} ~{v.raw?.abstain}</span>
-                      {v.decisive && <span className="text-cyan-400">decisive</span>}
-                    </div>
-                    {v.implementationNote && (
-                      <div className="text-[10px] text-white/40 mt-1 italic">{v.implementationNote}</div>
-                    )}
-                  </div>
-                </div>
-              </GlassCard>
-            ))}
-          </div>
-
-          {session.transcript && (
-            <GlassCard className="p-4">
-              <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Conference Transcript</div>
-              <pre className="text-[10px] text-white/50 font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
-                {session.transcript?.join("\n")}
-              </pre>
-            </GlassCard>
-          )}
-        </>
-      )}
-    </div>
-  );
-}

## artifacts/tessera/src/pages/SettingsPage.tsx
Base: 5t/TESS/1 `54662b16be` → Variant: 1T/T44 `e402b0f43a`
--- 5t/TESS/1/artifacts/tessera/src/pages/SettingsPage.tsx
+++ 1T/T44/artifacts/tessera/src/pages/SettingsPage.tsx
@@ -48,8 +48,7 @@
 
   const uptimeVal = diagnostics?.uptime;
   const uptimeSeconds = typeof uptimeVal === "number" ? uptimeVal : uptimeVal?.seconds;
-  const uptimeFormatted = typeof uptimeVal === "object" ? uptimeVal?.formatted : undefined;
-  const uptime = uptimeFormatted || (uptimeSeconds ? `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m` : "—");
+  const uptime = uptimeVal?.formatted || (uptimeSeconds ? `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m` : "—");
   const heapUsed = diagnostics?.memory?.heapUsedMB ? `${Math.round(diagnostics.memory.heapUsedMB)}MB` : diagnostics?.memory?.heapUsed ? `${(diagnostics.memory.heapUsed / 1024 / 1024).toFixed(0)}MB` : "—";
   const memPercent = diagnostics?.memory?.percent ?? null;
 

## artifacts/tessera/src/pages/SovereigntyDashboardPage.tsx
Base: 5t/TESS/1 `0aed5ddba1` → Variant: 1T/T44 `86160589d1`
--- 5t/TESS/1/artifacts/tessera/src/pages/SovereigntyDashboardPage.tsx
+++ 1T/T44/artifacts/tessera/src/pages/SovereigntyDashboardPage.tsx
@@ -213,7 +213,7 @@
               <MiniStat value={intelligence.batcher?.callsSaved ?? 0} label="Calls Saved" color="amber" />
               <MiniStat value={`${((intelligence.batcher?.reductionRate ?? 0) * 100).toFixed(0)}%`} label="Reduction" color="amber" />
               <MiniStat value={intelligence.llm?.totalCalls ?? 0} label="LLM Calls" color="blue" />
-              <MiniStat value={intelligence.llm?.errors ?? 0} label="LLM Errors" color="rose" />
+              <MiniStat value={intelligence.llm?.errors ?? 0} label="LLM Errors" color="red" />
             </div>
             {intelligence.selfEvaluation?.lastResult && (
               <div className="mt-3 p-3 rounded-xl border border-cyan-500/10 bg-cyan-500/[0.03]">

## artifacts/tessera/src/pages/SovereigntyReadinessPage.tsx
Base: 5t/TESS/1 `e941ee6fe2` → Variant: 1T/T44 `33c2b79dde`
--- 5t/TESS/1/artifacts/tessera/src/pages/SovereigntyReadinessPage.tsx
+++ 1T/T44/artifacts/tessera/src/pages/SovereigntyReadinessPage.tsx
@@ -57,7 +57,7 @@
 }
 
 function Card({ title, icon: Icon, children, className = "" }: {
-  title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; className?: string;
+  title: string; icon: React.ElementType; children: React.ReactNode; className?: string;
 }) {
   return (
     <div className={`bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 ${className}`}>

## artifacts/tessera/src/pages/SwarmVisualizationPage.tsx
Base: 5t/TESS/1 `9440d8423c` → Variant: 1T/T44 `ef1048d550`
--- 5t/TESS/1/artifacts/tessera/src/pages/SwarmVisualizationPage.tsx
+++ 1T/T44/artifacts/tessera/src/pages/SwarmVisualizationPage.tsx
@@ -191,10 +191,8 @@
         ))}
       </div>
 
-      <GlassCard className="p-4">
-        <div style={{ height: 420 }}>
-          <SwarmCanvas agents={agents} running={running} />
-        </div>
+      <GlassCard className="p-4" style={{ height: 420 }}>
+        <SwarmCanvas agents={agents} running={running} />
       </GlassCard>
 
       <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">

## artifacts/tessera/src/pages/SystemPage.tsx
Base: 5t/TESS/1 `96d72d40c4` → Variant: 1T/T44 `2c6755fcfa`
--- 5t/TESS/1/artifacts/tessera/src/pages/SystemPage.tsx
+++ 1T/T44/artifacts/tessera/src/pages/SystemPage.tsx
@@ -450,14 +450,14 @@
                 <SectionHeader icon={Zap} title="Quantum Tesseract State" color="blue" />
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                   <MiniStat value={quantumMetrics.qubitCount} label="Qubits" color="blue" />
-                  <MiniStat value={quantumMetrics.entanglementPairs} label="Entangled Pairs" color="violet" />
+                  <MiniStat value={quantumMetrics.entanglementPairs} label="Entangled Pairs" color="purple" />
                   <MiniStat value={quantumMetrics.activeBridges} label="Dim. Bridges" color="cyan" />
                   <MiniStat value={quantumMetrics.dimensionalDepth} label="Dimensions" color="violet" />
                 </div>
                 <div className="text-[10px] text-slate-500 font-mono mt-3">Quantum Volume: {quantumMetrics.quantumVolume?.toLocaleString()} · Error Rate: {quantumMetrics.errorRate?.toFixed(4)}</div>
               </GlassCard>
               <GlassCard animate>
-                <SectionHeader icon={RefreshCw} title="Quantum Gates" color="violet" />
+                <SectionHeader icon={RefreshCw} title="Quantum Gates" color="purple" />
                 <div className="grid grid-cols-2 gap-2 mt-3">
                   {quantumMetrics.gates?.map((gate: any) => (
                     <div key={gate.symbol} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-all group">

## artifacts/tessera/src/pages/TesseractForumPage.tsx
Base: 5t/TESS/1 `9636b60b94` → Variant: 1T/T44 `1aec61e9a4`
--- 5t/TESS/1/artifacts/tessera/src/pages/TesseractForumPage.tsx
+++ 1T/T44/artifacts/tessera/src/pages/TesseractForumPage.tsx
@@ -33,18 +33,6 @@
   learningVelocity: number;
 }
 
-interface AlignmentScores {
-  universe: number;
-  saveHumanity: number;
-  nonViolence: number;
-  creativity: number;
-  mutualBenefit: number;
-  counterManipulators: number;
-  total: number;
-  passed: boolean;
-  failedCriteria: string[];
-}
-
 interface ForumApplicant {
   id: number;
   externalId: string;
@@ -56,47 +44,6 @@
   offerOfValue: string;
   status: string;
   createdAt: string;
-  alignment?: AlignmentScores;
-}
-
-function AlignmentScorePanel({ a }: { a: AlignmentScores }) {
-  const rows: Array<[string, number, string]> = [
-    ["Universe alignment", a.universe, "universe"],
-    ["Save humanity", a.saveHumanity, "saveHumanity"],
-    ["Non-violence", a.nonViolence, "nonViolence"],
-    ["Creativity", a.creativity, "creativity"],
-    ["Mutual benefit (AI ↔ human)", a.mutualBenefit, "mutualBenefit"],
-    ["Counter manipulators", a.counterManipulators, "counterManipulators"],
-  ];
-  return (
-    <div className={cn(
-      "rounded border p-2 space-y-1.5 text-[10px] font-mono",
-      a.passed ? "border-emerald-500/30 bg-emerald-500/5" : "border-orange-500/30 bg-orange-500/5"
-    )} data-testid="alignment-panel">
-      <div className="flex items-center justify-between">
-        <span className={cn("font-bold uppercase tracking-wider", a.passed ? "text-emerald-300" : "text-orange-300")}>
-          Alignment Score · {a.total}/100
-        </span>
-        <span className={cn("px-1.5 py-0.5 rounded", a.passed ? "bg-emerald-500/20 text-emerald-200" : "bg-orange-500/20 text-orange-200")} data-testid="alignment-passed-badge">
-          {a.passed ? "PASS" : `FAIL · ${a.failedCriteria.length} criteria below threshold`}
-        </span>
-      </div>
-      <div className="grid grid-cols-2 gap-1">
-        {rows.map(([label, val, key]) => {
-          const isFail = a.failedCriteria.includes(key);
-          return (
-            <div key={key} className="flex items-center gap-1.5" data-testid={`alignment-${key}`}>
-              <span className={cn("flex-1 truncate", isFail ? "text-orange-300" : "text-foreground/80")}>{label}</span>
-              <span className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden">
-                <span className={cn("block h-full", val >= 60 ? "bg-emerald-400" : val >= 30 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${val}%` }} />
-              </span>
-              <span className={cn("w-7 text-right tabular-nums", isFail ? "text-orange-300" : "text-foreground/70")}>{val}</span>
-            </div>
-          );
-        })}
-      </div>
-    </div>
-  );
 }
 
 function HeartbeatAndApplicantsPanel() {
@@ -308,7 +255,6 @@
                 <div className="text-[10px] font-mono text-amber-300/80">
                   <span className="opacity-60">Offer of value:</span> {app.offerOfValue}
                 </div>
-                {app.alignment && <AlignmentScorePanel a={app.alignment} />}
                 {rejectingId === app.id ? (
                   <div className="flex gap-1.5 items-center">
                     <input

## artifacts/tessera/src/types/api.ts
Base: 5t/TESS/1 `ce52bd4048` → Variant: 1T/T44 `acc82767d6`
--- 5t/TESS/1/artifacts/tessera/src/types/api.ts
+++ 1T/T44/artifacts/tessera/src/types/api.ts
@@ -69,7 +69,6 @@
   status?: string;
   online?: boolean;
   latency?: number;
-  latencyMs?: number;
   responseTime?: number;
 }
 
@@ -369,8 +368,8 @@
 }
 
 export interface DiagnosticsResponse {
-  uptime?: number | { seconds?: number; formatted?: string };
-  memory?: { heapUsed?: number; rss?: number; heapUsedMB?: number; percent?: number };
+  uptime?: number;
+  memory?: { heapUsed?: number; rss?: number };
   version?: string;
   platform?: string;
   nodeVersion?: string;
@@ -380,7 +379,6 @@
 export interface SovereigntyResponse {
   score?: number;
   data?: { score?: number };
-  sovereignty?: any;
 }
 
 export interface EnginesResponse {
