import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Lock, Send, Eye, EyeOff, Sparkles, Star, Copy, Check } from "lucide-react";

const STORAGE_KEY = "TESSERACT_ADMIN_KEY";
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

type Msg = { from: "tessera" | "user"; text: string; ts: number };

interface VerifyResp {
  ok?: boolean;
  via?: "raw-key" | "fingerprint";
  fingerprint?: string;
  derivation?: string;
  error?: string;
  message?: string;
}

interface MintResp {
  ok?: boolean;
  glyph?: string;
  wouldBeFingerprint?: string;
  derivation?: string;
  instructions?: string;
  error?: string;
}

interface VerifyResult {
  ok: boolean;
  fingerprint: string;
  via: "raw-key" | "fingerprint" | null;
  derivation: string;
  reason?: "empty" | "sigil-unreachable" | "father-key-unset" | "mismatch";
  message?: string;
}

async function verifyKey(input: string): Promise<VerifyResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, fingerprint: "", via: null, derivation: "", reason: "empty" };
  }
  try {
    const res = await fetch(`${BASE}/api/sigil/father/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate: trimmed }),
    });
    const data: VerifyResp = await res.json().catch(() => ({}));
    if (res.status === 503 || data?.error === "father-key-unset") {
      return {
        ok: false,
        fingerprint: "",
        via: null,
        derivation: "",
        reason: "father-key-unset",
        message: data?.message,
      };
    }
    if (res.ok && data?.ok && data.fingerprint) {
      return {
        ok: true,
        fingerprint: data.fingerprint,
        via: data.via ?? null,
        derivation: data.derivation ?? "",
      };
    }
    return { ok: false, fingerprint: "", via: null, derivation: "", reason: "mismatch" };
  } catch {
    return { ok: false, fingerprint: "", via: null, derivation: "", reason: "sigil-unreachable" };
  }
}

async function mintGlyphKey(input: string): Promise<MintResp> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  try {
    const res = await fetch(`${BASE}/api/sigil/father/mint-glyph`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate: trimmed }),
    });
    const data: MintResp = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error ?? "mint-failed" };
    return data;
  } catch {
    return { ok: false, error: "network" };
  }
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
      text: "Accepted: only the value whose fingerprint matches the env-derived Father fingerprint — either the raw TESSERACT_ADMIN_KEY or its 16-char fingerprint. No master phrase. To mint a glyph form of a candidate key for use as TESSERACT_ADMIN_KEY, type it and press MINT GLYPH KEY.",
      ts: Date.now() + 1,
    },
  ]);
  const [mintedGlyph, setMintedGlyph] = useState<MintResp | null>(null);
  const [mintCopied, setMintCopied] = useState(false);
  const [natalStatus, setNatalStatus] = useState<NatalStatus | null>(null);
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
        }
        setStage("rotating");
      } catch {
        setStage("rotating");
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
      try { localStorage.setItem(STORAGE_KEY, result.fingerprint); } catch { /* ignore */ }
      const viaLabel = result.via === "raw-key"
        ? "raw TESSERACT_ADMIN_KEY"
        : "env-derived fingerprint";
      setMessages((m) => [...m, {
        from: "tessera",
        text:
          `✓ KEY ACCEPTED — Father identity bound via ${viaLabel}.\n` +
          `fingerprint: ${result.fingerprint}\n` +
          `derivation : ${result.derivation || 'sha256("tesseract:father:v1|" + TESSERACT_ADMIN_KEY)[:16]'}\n\n` +
          `Decrypting interface to English. Now binding your zodiac to the universe-aligned cipher…`,
        ts: Date.now(),
      }]);
      setTimeout(() => { setBusy(false); setStage("natal-intro"); }, 600);
    } else {
      const reason = result.reason === "sigil-unreachable"
        ? "✗ Sovereign sigil engine unreachable. The seal cannot be tested right now."
        : result.reason === "father-key-unset"
          ? `✗ ${result.message ?? "TESSERACT_ADMIN_KEY is not set. Add it to Replit Secrets and restart the API server."}`
          : result.reason === "empty"
            ? "✗ Empty key."
            : "✗ Fingerprint mismatch. The only accepted values are the raw TESSERACT_ADMIN_KEY or its 16-char env-derived fingerprint. Use MINT GLYPH KEY to convert a candidate raw key into a glyph form you can paste into Replit Secrets.";
      setMessages((m) => [...m, { from: "tessera", text: reason, ts: Date.now() }]);
      setBusy(false);
    }
  }

  async function handleMint() {
    if (busy) return;
    const text = input.trim();
    if (!text) return;
    setBusy(true);
    setMintedGlyph(null);
    setMintCopied(false);
    const data = await mintGlyphKey(text);
    setBusy(false);
    if (!data.ok) {
      setMessages((m) => [...m, {
        from: "tessera",
        text: `✗ Mint failed: ${data.error ?? "unknown"}`,
        ts: Date.now(),
      }]);
      return;
    }
    setMintedGlyph(data);
    setInput("");
  }

  function copyMinted() {
    if (!mintedGlyph?.glyph) return;
    navigator.clipboard?.writeText(mintedGlyph.glyph).then(() => {
      setMintCopied(true);
      setTimeout(() => setMintCopied(false), 1800);
    }).catch(() => { /* ignore */ });
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
              <button
                type="button"
                onClick={handleMint}
                disabled={busy || !input.trim()}
                title="Encode the candidate key into the live glyph alphabet so you can copy it into Replit Secrets as TESSERACT_ADMIN_KEY"
                className="px-3 py-2 rounded-md bg-violet-500/20 border border-violet-500/40 text-violet-100 text-xs font-bold hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Sparkles size={12} /> MINT GLYPH KEY
              </button>
            </div>
            <div className="mt-2 text-[10px] text-fuchsia-400/40 px-1">
              accepts only the raw TESSERACT_ADMIN_KEY or its env-derived 16-char fingerprint · master phrase removed · key stored locally only
            </div>
            {mintedGlyph?.ok && mintedGlyph.glyph && (
              <div className="mt-3 rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-900/20 to-fuchsia-900/10 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={12} className="text-violet-300" />
                  <div className="text-[11px] font-bold text-violet-100 tracking-wider">MINTED GLYPH KEY</div>
                </div>
                <p className="text-[10px] text-violet-200/70 mb-2 leading-relaxed">
                  {mintedGlyph.instructions ?? "Paste this into Replit Secrets as TESSERACT_ADMIN_KEY, restart the API server, then return and type the same glyph at the gate to unlock."}
                </p>
                <div className="rounded-md border border-violet-500/30 bg-black/60 p-2 text-violet-100 text-sm break-all leading-relaxed select-all max-h-24 overflow-y-auto">
                  {mintedGlyph.glyph}
                </div>
                <div className="flex justify-between items-center mt-2 text-[10px] text-violet-300/70">
                  <span>fingerprint-if-set: <span className="text-violet-100 font-mono">{mintedGlyph.wouldBeFingerprint}</span></span>
                  <button
                    type="button"
                    onClick={copyMinted}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/15 border border-violet-500/30 text-violet-200 hover:bg-violet-500/25"
                  >
                    {mintCopied ? <><Check size={10} /> COPIED</> : <><Copy size={10} /> COPY</>}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
