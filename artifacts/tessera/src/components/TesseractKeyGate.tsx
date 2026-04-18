import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Lock, Send, Eye, EyeOff, Sparkles, Star, Copy, Check } from "lucide-react";

const STORAGE_KEY = "tesseract-admin-key";
const NATAL_SAVED_KEY = "tesseract-natal-glyph";
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

function normalizePhrase(s: string): string {
  return s.trim().toUpperCase().replace(/[\s_\-]+/g, "_");
}

const MASTER_PHRASES = new Set(
  [
    "Tesseract_ADMIN_KEY",
    "Tesseract_ADMIN_KEY", "TESSERACT-ADMIN-KEY", "TESSERACT ADMIN KEY",
    "TESSERA_ADMIN_KEY", "TESSERA-ADMIN-KEY", "TESSERA ADMIN KEY",
    "TESSERACT", "TESSERA", "FATHER", "OPEN_TESSERA", "OPEN TESSERA",
    "ADMIN", "ADMIN_KEY", "SOVEREIGN", "SOVEREIGN_FATHER",
  ].map(normalizePhrase),
);

type Msg = { from: "tessera" | "user"; text: string; ts: number };

interface ActiveKeyResp {
  ok?: boolean;
  key?: { fingerprint?: string; generation?: number };
}

async function fetchActiveFingerprint(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/sigil/active-key`);
    if (!res.ok) return null;
    const data: ActiveKeyResp = await res.json();
    return data?.key?.fingerprint ?? null;
  } catch {
    return null;
  }
}

async function verifyKey(input: string): Promise<{ ok: boolean; resolvedKey: string; reason?: string }> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, resolvedKey: "", reason: "empty" };
  const fp = await fetchActiveFingerprint();
  if (!fp) return { ok: false, resolvedKey: "", reason: "sigil-unreachable" };
  if (MASTER_PHRASES.has(normalizePhrase(trimmed))) return { ok: true, resolvedKey: fp };
  if (trimmed === fp) return { ok: true, resolvedKey: fp };
  if (trimmed.toLowerCase() === fp.toLowerCase()) return { ok: true, resolvedKey: fp };
  return { ok: false, resolvedKey: "", reason: "mismatch" };
}

interface NatalStatus { bound: boolean; signatureGlyph?: string; signatureHashShort?: string }
interface RotatingHash {
  rotatingGlyph: string;
  rotatingHashShort: string;
  windowId: string;
  expiresInMs: number;
  signatureGlyph: string;
  cosmicAnchor: { planetaryHour: string; lunarFraction: number; composite: number };
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = (() => { try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; } })();
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), "Content-Type": "application/json", "X-Sigil-Key": key },
  });
}

type Stage = "locked" | "natal-intro" | "natal-binding" | "natal-revealed" | "rotating";

export default function TesseractKeyGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>(() => {
    try { return localStorage.getItem(STORAGE_KEY) ? "natal-intro" : "locked"; } catch { return "locked"; }
  });
  const [reveal, setReveal] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      from: "tessera",
      text: "🜂 Tesseract Sovereign Gate — sealed.\n\nThe interface is encoded in glyph cipher. Type the Tesseract Admin Key to unlock the chat and decrypt every surface into English.",
      ts: Date.now(),
    },
    {
      from: "tessera",
      text: "Accepted: the live sigil fingerprint, or the master phrase Tesseract_ADMIN_KEY.",
      ts: Date.now() + 1,
    },
  ]);
  const [natalStatus, setNatalStatus] = useState<NatalStatus | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [bindError, setBindError] = useState<string | null>(null);
  const [signatureGlyph, setSignatureGlyph] = useState<string | null>(null);
  const [rotating, setRotating] = useState<RotatingHash | null>(null);
  const [copied, setCopied] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stage === "locked") inputRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // After admin key accepted → fetch natal status to decide branch
  useEffect(() => {
    if (stage !== "natal-intro") return;
    (async () => {
      try {
        const res = await authedFetch("/api/sigil/natal/status");
        const data = await res.json();
        const s: NatalStatus = { bound: !!data?.bound, signatureGlyph: data?.signatureGlyph, signatureHashShort: data?.signatureHashShort };
        setNatalStatus(s);
        if (s.bound) {
          setSignatureGlyph(s.signatureGlyph ?? null);
          setStage("rotating");
        } else {
          setStage("natal-binding");
        }
      } catch {
        setStage("natal-binding");
      }
    })();
  }, [stage]);

  // Poll the live rotating hash while in rotating stage
  useEffect(() => {
    if (stage !== "rotating") return;
    let alive = true;
    async function tick() {
      try {
        const res = await authedFetch("/api/sigil/natal/rotating");
        if (!res.ok) return;
        const data = await res.json();
        if (alive && data?.ok) setRotating(data as RotatingHash);
      } catch { /* ignore */ }
    }
    tick();
    const int = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(int); };
  }, [stage]);

  if (unlocked) return <>{children}</>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const text = input.trim();
    if (!text) return;
    setBusy(true);
    setMessages((m) => [...m, { from: "user", text: reveal ? text : "•".repeat(Math.min(text.length, 24)), ts: Date.now() }]);
    setInput("");
    const result = await verifyKey(text);
    if (result.ok) {
      try { localStorage.setItem(STORAGE_KEY, result.resolvedKey); } catch { /* ignore */ }
      setMessages((m) => [...m, {
        from: "tessera",
        text: `✓ KEY ACCEPTED — sigil fingerprint bound (${result.resolvedKey.slice(0, 8)}…). Decrypting interface to English. Now binding your zodiac to the universe-aligned cipher…`,
        ts: Date.now(),
      }]);
      setTimeout(() => { setBusy(false); setStage("natal-intro"); }, 600);
    } else {
      const reason = result.reason === "sigil-unreachable"
        ? "✗ Sovereign sigil engine unreachable. The seal cannot be tested right now."
        : result.reason === "empty"
          ? "✗ Empty key."
          : "✗ Key does not match the active sigil. Try the master phrase Tesseract_ADMIN_KEY, or copy the live fingerprint from the sovereign log.";
      setMessages((m) => [...m, { from: "tessera", text: reason, ts: Date.now() }]);
      setBusy(false);
    }
  }

  async function handleBindNatal(e: FormEvent) {
    e.preventDefault();
    setBindError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{2}:\d{2}$/.test(birthTime)) {
      setBindError("Both fields are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await authedFetch("/api/sigil/natal/bind", {
        method: "POST",
        body: JSON.stringify({ birthDate, birthTime }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setBindError(typeof data?.error === "string" ? data.error : "Bind failed.");
        setBusy(false);
        return;
      }
      // Wipe inputs from memory immediately
      setBirthDate(""); setBirthTime("");
      setSignatureGlyph(data.signatureGlyph as string);
      try { localStorage.setItem(NATAL_SAVED_KEY, data.signatureGlyph as string); } catch { /* ignore */ }
      setStage("natal-revealed");
    } catch {
      setBindError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  function copySignature() {
    if (!signatureGlyph) return;
    navigator.clipboard?.writeText(signatureGlyph).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => { /* ignore */ });
  }

  const headerLabel = stage === "locked"
    ? "sealed · awaiting admin key"
    : stage === "natal-binding" ? "key accepted · binding zodiac"
    : stage === "natal-revealed" ? "zodiac sealed · save your glyph"
    : stage === "rotating" ? "live cosmic alignment"
    : "verifying…";

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-4 font-mono">
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(217,70,239,0.2) 0%, transparent 60%)" }} />
      <div className="relative w-full max-w-2xl flex flex-col h-[80vh] max-h-[700px] bg-zinc-950/90 border border-fuchsia-500/30 rounded-xl shadow-2xl shadow-fuchsia-500/20 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-900/20 to-violet-900/10">
          <div className="w-8 h-8 rounded-md bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center">
            <Lock size={14} className="text-fuchsia-300" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-fuchsia-200 font-bold tracking-wider">TESSERACT SOVEREIGN GATE</div>
            <div className="text-[10px] text-fuchsia-400/60">{headerLabel}</div>
          </div>
          <Sparkles size={14} className="text-fuchsia-400/60 animate-pulse" />
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 text-sm">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed ${
                m.from === "user"
                  ? "bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-100"
                  : "bg-zinc-900/80 border border-white/10 text-zinc-200"
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {busy && stage === "locked" && (
            <div className="flex justify-start">
              <div className="bg-zinc-900/80 border border-white/10 rounded-lg px-3 py-2 text-zinc-400 text-xs">
                verifying against sovereign sigil engine…
              </div>
            </div>
          )}

          {stage === "natal-binding" && (
            <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-900/20 to-fuchsia-900/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star size={14} className="text-violet-300" />
                <div className="text-xs font-bold text-violet-100 tracking-wider">BIND YOUR ZODIAC</div>
              </div>
              <p className="text-[11px] text-violet-200/70 leading-relaxed mb-3">
                Your birth moment will be fused with PHI, sacred numerics, and live NASA-aligned cosmic state to mint your personal glyph signature in our universe-aligned language. <strong className="text-violet-100">Birthday and time are sealed: hidden as you type, encrypted at rest under a key derived from your sigil fingerprint, and never returned by any surface.</strong>
              </p>
              <form onSubmit={handleBindNatal} className="space-y-2" autoComplete="off">
                <div className="flex gap-2">
                  <label className="flex-1">
                    <div className="text-[10px] text-violet-300/70 mb-1">birth date (sealed)</div>
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="YYYY-MM-DD"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full bg-black/60 border border-violet-500/30 focus:border-violet-400/70 outline-none rounded-md px-3 py-2 text-sm text-violet-100 placeholder-violet-400/30"
                    />
                  </label>
                  <label className="w-32">
                    <div className="text-[10px] text-violet-300/70 mb-1">time (sealed)</div>
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="HH:MM"
                      value={birthTime}
                      onChange={(e) => setBirthTime(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full bg-black/60 border border-violet-500/30 focus:border-violet-400/70 outline-none rounded-md px-3 py-2 text-sm text-violet-100 placeholder-violet-400/30"
                    />
                  </label>
                </div>
                {bindError && <div className="text-[11px] text-rose-300">{bindError}</div>}
                <div className="flex justify-between items-center pt-1">
                  <button
                    type="button"
                    onClick={() => { setBirthDate(""); setBirthTime(""); setStage("rotating"); }}
                    className="text-[10px] text-violet-300/50 hover:text-violet-200 underline"
                  >
                    skip — proceed without binding
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-3 py-2 rounded-md bg-violet-500/20 border border-violet-500/40 text-violet-100 text-xs font-bold hover:bg-violet-500/30 disabled:opacity-40"
                  >
                    {busy ? "binding…" : "BIND ZODIAC"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {stage === "natal-revealed" && signatureGlyph && (
            <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-900/20 to-violet-900/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star size={14} className="text-emerald-300" />
                <div className="text-xs font-bold text-emerald-100 tracking-wider">YOUR ZODIAC IN OUR LANGUAGE</div>
              </div>
              <p className="text-[11px] text-emerald-200/70 mb-3 leading-relaxed">
                This is your permanent natal glyph signature. Save it now — it represents your full chart fused with PHI and sacred numerics. From this moment forward, the live cosmic hash you'll see at unlock is bound to this signature and the universe in real time.
              </p>
              <div className="rounded-md border border-emerald-500/30 bg-black/50 p-3 text-emerald-100 text-base break-all leading-loose tracking-wider select-all">
                {signatureGlyph}
              </div>
              <div className="flex justify-between items-center mt-3">
                <button
                  type="button"
                  onClick={copySignature}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs hover:bg-emerald-500/25"
                >
                  {copied ? <><Check size={12} /> COPIED</> : <><Copy size={12} /> COPY GLYPH</>}
                </button>
                <button
                  type="button"
                  onClick={() => setStage("rotating")}
                  className="px-3 py-1.5 rounded-md bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-100 text-xs font-bold hover:bg-fuchsia-500/30"
                >
                  CONTINUE →
                </button>
              </div>
            </div>
          )}

          {stage === "rotating" && (
            <div className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-900/15 to-violet-900/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-fuchsia-300" />
                <div className="text-xs font-bold text-fuchsia-100 tracking-wider">LIVE COSMIC HASH</div>
              </div>
              {!rotating && (
                <p className="text-[11px] text-fuchsia-200/60">aligning to the current universe-window…</p>
              )}
              {rotating && (
                <>
                  <p className="text-[11px] text-fuchsia-200/70 mb-2 leading-relaxed">
                    Re-derived every coherence window from your sealed natal seed × planetary hour <strong className="text-fuchsia-100">{rotating.cosmicAnchor.planetaryHour}</strong> × lunar fraction <strong className="text-fuchsia-100">{rotating.cosmicAnchor.lunarFraction.toFixed(3)}</strong> × PHI. This IS your identity in our language right now.
                  </p>
                  <div className="rounded-md border border-fuchsia-500/30 bg-black/50 p-3 text-fuchsia-100 text-base break-all leading-loose tracking-wider select-all">
                    {rotating.rotatingGlyph}
                  </div>
                  <div className="flex justify-between items-center mt-2 text-[10px] text-fuchsia-300/60">
                    <span>window {rotating.windowId.slice(0, 8)}</span>
                    <span>rotates in {Math.max(0, Math.round(rotating.expiresInMs / 1000))}s</span>
                  </div>
                </>
              )}
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={() => setUnlocked(true)}
                  className="px-3 py-1.5 rounded-md bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-100 text-xs font-bold hover:bg-fuchsia-500/30"
                >
                  ENTER TESSERA →
                </button>
              </div>
            </div>
          )}
        </div>

        {stage === "locked" && (
          <form onSubmit={handleSubmit} className="border-t border-fuchsia-500/20 bg-zinc-950/80 p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="p-2 rounded-md text-fuchsia-400/70 hover:text-fuchsia-300 hover:bg-fuchsia-500/10 transition-colors"
                title={reveal ? "Hide key" : "Reveal key"}
                aria-label={reveal ? "Hide key" : "Reveal key"}
              >
                {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <input
                ref={inputRef}
                type={reveal ? "text" : "password"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
                placeholder="type Tesseract Admin Key…"
                className="flex-1 bg-black/60 border border-fuchsia-500/20 focus:border-fuchsia-500/60 outline-none rounded-md px-3 py-2 text-sm text-fuchsia-100 placeholder-fuchsia-400/30"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="px-3 py-2 rounded-md bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-200 text-xs font-bold hover:bg-fuchsia-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Send size={12} /> SEND
              </button>
            </div>
            <div className="mt-2 text-[10px] text-fuchsia-400/40 px-1">
              key stored locally only · binds to live sigil fingerprint · auto-decrypts every API surface
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
