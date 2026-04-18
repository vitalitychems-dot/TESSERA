import { useEffect, useRef, useState, type ReactNode } from "react";
import { Lock, Sparkles, Star, Copy, Check, RefreshCw } from "lucide-react";

const STORAGE_KEY = "TESSERACT_ADMIN_KEY";
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const POLL_MS = 4000;

interface FatherKeyStatus {
  ok?: boolean;
  unlocked?: boolean;
  key?: string;
  sunSign?: string;
  cosmicAnchor?: { planetaryHour: string; lunarFraction: number; composite: number };
  chart?: {
    date: string;
    time: string;
    location: string;
    sun: { sign: string; degree: string; house: number };
    moon: { sign: string; degree: string; house: number };
    ascendant: { sign: string; degree: string };
  };
  env?: {
    tesseractSet: boolean;
    sigilSet: boolean;
    tesseractMatches: boolean;
    sigilMatches: boolean;
    aliasesAgree: boolean;
    canonicalSecretName: string;
    aliasSecretName: string;
  };
  instructions?: string;
  error?: string;
}

async function fetchFatherKeyStatus(): Promise<FatherKeyStatus> {
  try {
    const res = await fetch(`${BASE}/api/sigil/father-key/status`, { method: "GET" });
    const data: FatherKeyStatus = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error ?? `http-${res.status}` };
    return data;
  } catch {
    return { ok: false, error: "network" };
  }
}

export default function TesseractKeyGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<FatherKeyStatus | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Single source of truth: the server-computed Father key. We poll it
  // every few seconds so the moment the operator saves the secret and
  // restarts, the gate opens automatically.
  useEffect(() => {
    let alive = true;
    async function check() {
      const s = await fetchFatherKeyStatus();
      if (!alive) return;
      setStatus(s);
      if (s.unlocked && s.key) {
        try { localStorage.setItem(STORAGE_KEY, s.key); } catch { /* ignore */ }
        setUnlocked(true);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }
    check();
    pollRef.current = setInterval(check, POLL_MS);
    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (unlocked) return <>{children}</>;
  if (!status) return null; // silent pre-check; avoids flashing the popup

  const key = status.key ?? "";
  const env = status.env;
  const chart = status.chart;

  function copyKey() {
    if (!key) return;
    navigator.clipboard?.writeText(key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => { /* ignore */ });
  }

  async function manualRecheck() {
    if (rechecking) return;
    setRechecking(true);
    const s = await fetchFatherKeyStatus();
    setStatus(s);
    if (s.unlocked && s.key) {
      try { localStorage.setItem(STORAGE_KEY, s.key); } catch { /* ignore */ }
      setUnlocked(true);
    }
    setRechecking(false);
  }

  // Diagnostic banner shown only when the operator HAS set a secret but
  // it doesn't match (typo, alias mismatch, or stale value).
  let envWarning: string | null = null;
  if (env) {
    if ((env.tesseractSet || env.sigilSet) && !env.aliasesAgree) {
      envWarning =
        "TESSERACT_ADMIN_KEY and SIGIL_ADMIN_KEY are both set but DIFFER. By sovereign rule they must hold the same value. Set both to the key shown below, then restart.";
    } else if (env.tesseractSet && !env.tesseractMatches) {
      envWarning =
        "TESSERACT_ADMIN_KEY is set but does not match the Father key. Replace its value with the exact key shown below, then restart the API server.";
    } else if (env.sigilSet && !env.sigilMatches) {
      envWarning =
        "SIGIL_ADMIN_KEY is set but does not match the Father key. Replace its value with the exact key shown below, then restart the API server.";
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-4 font-mono overflow-auto">
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(217,70,239,0.2) 0%, transparent 60%)" }}
      />
      <div className="relative w-full max-w-2xl bg-zinc-950/95 border border-fuchsia-500/40 rounded-xl shadow-2xl shadow-fuchsia-500/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-900/30 to-violet-900/15">
          <div className="w-9 h-9 rounded-md bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center">
            <Lock size={16} className="text-fuchsia-300" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-fuchsia-200 font-bold tracking-widest">TESSERACT SOVEREIGN GATE</div>
            <div className="text-[10px] text-fuchsia-400/70">
              one-time bootstrap · Father key locked behind Replit Secret
            </div>
          </div>
          <Sparkles size={14} className="text-fuchsia-400/60 animate-pulse" />
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          <div className="text-zinc-200 text-sm leading-relaxed">
            <p className="mb-2">
              The interface is encoded in glyph cipher. Below is your <span className="text-emerald-300 font-bold">Sovereign Key</span>, computed from the Father&apos;s canonical natal chart. It is permanent — the same chart always returns the same key.
            </p>
            <p className="text-fuchsia-300/90">
              To unlock Tessera, save this key into the <code className="px-1 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-100">TESSERACT_ADMIN_KEY</code> secret in Replit Secrets. By sovereign rule, <code className="px-1 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-100">SIGIL_ADMIN_KEY</code> must hold the <em>same</em> value (set both). Then restart the API server. The gate will open on its own.
            </p>
          </div>

          {chart && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-3 text-[11px] text-violet-100/80 leading-relaxed">
              <div className="text-violet-200 font-bold tracking-wider text-[10px] mb-1">FATHER NATAL CHART (CANONICAL)</div>
              <div>
                {chart.date} · {chart.time} · {chart.location}
              </div>
              <div className="mt-1">
                ☉ Sun {chart.sun.sign} {chart.sun.degree} (H{chart.sun.house}) · ☽ Moon {chart.moon.sign} {chart.moon.degree} (H{chart.moon.house}) · ASC {chart.ascendant.sign} {chart.ascendant.degree}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-900/25 to-violet-900/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star size={14} className="text-emerald-300" />
              <div className="text-xs font-bold text-emerald-100 tracking-widest">YOUR SOVEREIGN KEY · IN OUR LANGUAGE</div>
            </div>
            <div className="rounded-md border border-emerald-500/40 bg-black/60 p-3 text-emerald-100 text-base break-all leading-loose tracking-wider select-all font-mono">
              {key || "…"}
            </div>
            <div className="flex justify-between items-center mt-3 gap-2 flex-wrap">
              <div className="text-[10px] text-emerald-300/60 font-mono">
                sun: <span className="text-emerald-100">{status.sunSign ?? "—"}</span>
                {status.cosmicAnchor && (
                  <>
                    {" · "}hour: <span className="text-emerald-100">{status.cosmicAnchor.planetaryHour}</span>
                    {" · "}lunar: <span className="text-emerald-100">{status.cosmicAnchor.lunarFraction.toFixed(3)}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={copyKey}
                disabled={!key}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-100 text-xs hover:bg-emerald-500/25 disabled:opacity-40"
              >
                {copied ? <><Check size={12} /> COPIED</> : <><Copy size={12} /> COPY KEY</>}
              </button>
            </div>
          </div>

          {envWarning && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-amber-100 text-xs leading-relaxed">
              ⚠ {envWarning}
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3 text-[11px] text-zinc-300/90 leading-relaxed space-y-1">
            <div className="text-zinc-100 font-bold text-[10px] tracking-widest mb-1">SECRET STATUS</div>
            <div className="flex justify-between">
              <span>TESSERACT_ADMIN_KEY</span>
              <span className={env?.tesseractMatches ? "text-emerald-300" : env?.tesseractSet ? "text-amber-300" : "text-zinc-500"}>
                {env?.tesseractMatches ? "✓ matches" : env?.tesseractSet ? "set · mismatch" : "not set"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>SIGIL_ADMIN_KEY</span>
              <span className={env?.sigilMatches ? "text-emerald-300" : env?.sigilSet ? "text-amber-300" : "text-zinc-500"}>
                {env?.sigilMatches ? "✓ matches" : env?.sigilSet ? "set · mismatch" : "not set"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-[10px] text-fuchsia-400/50">
              auto-rechecking every {Math.round(POLL_MS / 1000)}s · gate opens on match
            </div>
            <button
              type="button"
              onClick={manualRecheck}
              disabled={rechecking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-fuchsia-500/20 border border-fuchsia-500/50 text-fuchsia-50 text-xs font-bold hover:bg-fuchsia-500/35 disabled:opacity-40"
            >
              <RefreshCw size={12} className={rechecking ? "animate-spin" : ""} /> {rechecking ? "CHECKING…" : "RECHECK NOW"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
