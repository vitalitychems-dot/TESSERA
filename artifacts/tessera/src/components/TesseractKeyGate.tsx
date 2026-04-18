import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Lock, Send, Eye, EyeOff, Sparkles, Star, Copy, Check } from "lucide-react";

const STORAGE_KEY = "TESSERACT_ADMIN_KEY";
const RAW_STORAGE_KEY = "TESSERACT_ADMIN_KEY__raw";
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
  // Always start locked. If a stored key still verifies, the auto-unlock
  // effect below upgrades us to unlocked silently. This prevents getting
  // stranded in an intermediate stage when the server has been restarted
  // with a new TESSERACT_ADMIN_KEY and the stored fingerprint is stale.
  const [stage, setStage] = useState<Stage>("locked");
  const [serverFingerprint, setServerFingerprint] = useState<string | null>(null);
  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);
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
      text: "Type your TESSERACT_ADMIN_KEY and press SEND. The moment the key is accepted, your sovereign natal sigil is auto-minted from the chart — copy it into Replit Secrets as SIGIL_ADMIN_KEY (or MINTED_GLYPH_KEY), then tap ENTER TESSERA to land in the app. From the next visit on, the gate auto-unlocks silently.",
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
  const [natalSigil, setNatalSigil] = useState<{ glyph: string; digestHex: string; secretName: string; derivation: string; instructions: string } | null>(null);
  const [natalEnglish, setNatalEnglish] = useState<string | null>(null);
  const [natalCopied, setNatalCopied] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Always pull the server's current Father fingerprint so the gate can show
  // it as a sanity-check below the prompt. This prevents the "I changed the
  // secret but it still won't accept" confusion — the user can compare what
  // the server actually loaded against what they expect.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/sigil/active-key`);
        const data = await res.json();
        if (!alive) return;
        if (data?.ok && typeof data.fatherFingerprint === "string") {
          setServerFingerprint(data.fatherFingerprint);
          setServerConfigured(true);
        } else if (data?.error === "father-key-unset") {
          setServerConfigured(false);
        }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  // Silent auto-unlock: if a previously-accepted key is in localStorage and
  // still verifies against the current Father identity, skip the gate UI.
  // On any failure (including network), clear the stale fingerprint so the
  // user always lands cleanly on the prompt.
  useEffect(() => {
    let alive = true;
    (async () => {
      let storedFp = "";
      let storedRaw = "";
      try {
        storedFp = localStorage.getItem(STORAGE_KEY) ?? "";
        storedRaw = localStorage.getItem(RAW_STORAGE_KEY) ?? "";
      } catch { /* ignore */ }
      if (!storedFp && !storedRaw) return;
      // Try fingerprint first (cheapest, no raw key on the wire), then fall
      // back to the raw value the user originally typed. The raw value still
      // verifies even if the env-derived fingerprint shifted because the user
      // moved the secret to SIGIL_ADMIN_KEY / MINTED_GLYPH_KEY (or replaced
      // TESSERACT_ADMIN_KEY itself with the minted glyph).
      let r = storedFp ? await verifyKey(storedFp) : { ok: false } as Awaited<ReturnType<typeof verifyKey>>;
      if (!r.ok && storedRaw) r = await verifyKey(storedRaw);
      if (!alive) return;
      if (r.ok) {
        // Refresh stored fingerprint to whatever the server now considers
        // canonical, so future auto-unlocks hit the fast path.
        try { if (r.fingerprint) localStorage.setItem(STORAGE_KEY, r.fingerprint); } catch { /* ignore */ }
        setUnlocked(true);
      } else {
        try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(RAW_STORAGE_KEY); } catch { /* ignore */ }
      }
    })();
    return () => { alive = false; };
  }, []);

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

  if (unlocked) return <>{children}<SovereignDownloadBadge /></>;

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
      try {
        localStorage.setItem(STORAGE_KEY, result.fingerprint);
        // Persist the raw value the user typed so auto-unlock can fall back
        // to it if the env-derived fingerprint shifts (e.g. they save the
        // minted sigil into TESSERACT_ADMIN_KEY itself, replacing the original).
        localStorage.setItem(RAW_STORAGE_KEY, text);
      } catch { /* ignore */ }
      const viaLabel = result.via === "raw-key"
        ? "raw TESSERACT_ADMIN_KEY"
        : "env-derived fingerprint";
      setMessages((m) => [...m, {
        from: "tessera",
        text:
          `✓ KEY ACCEPTED — Father identity bound via ${viaLabel}.\n` +
          `fingerprint: ${result.fingerprint}\n` +
          `derivation : ${result.derivation || 'sha256("tesseract:father:v1|" + TESSERACT_ADMIN_KEY)[:16]'}\n\n` +
          `Minting your sovereign natal sigil from the chart on file…`,
        ts: Date.now(),
      }]);
      // Mint the natal sigil + load the English chart readout. The candidate
      // (raw key OR fingerprint) lets the natal-sigil endpoint authorize even
      // before the X-Sigil-Key header has been persisted to localStorage.
      try {
        const sRes = await fetch(`${BASE}/api/sigil/father/natal-sigil`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Sigil-Key": result.fingerprint },
          body: JSON.stringify({ candidate: text }),
        });
        const sData = await sRes.json();
        if (sRes.ok && sData?.ok) {
          setNatalSigil({
            glyph: sData.glyph,
            digestHex: sData.digestHex,
            secretName: sData.secretName,
            derivation: sData.derivation,
            instructions: sData.instructions,
          });
        }
        const cRes = await fetch(`${BASE}/api/sigil/father/natal-chart`, {
          headers: { "X-Sigil-Key": result.fingerprint },
        });
        const cData = await cRes.json();
        if (cRes.ok && cData?.ok && typeof cData.english === "string") {
          setNatalEnglish(cData.english);
        }
      } catch { /* ignore — sigil panel just won't appear */ }
      // Jump straight to the minted-glyph reveal. No intermediate stages —
      // the natal sigil panel itself carries the COPY and ENTER actions.
      setTimeout(() => { setBusy(false); setStage("natal-revealed"); }, 400);
    } else {
      const reason = result.reason === "sigil-unreachable"
        ? "✗ Sigil engine unreachable."
        : result.reason === "father-key-unset"
          ? `✗ ${result.message ?? "TESSERACT_ADMIN_KEY is not set in Replit Secrets."}`
          : result.reason === "empty"
            ? "✗ Empty key."
            : `✗ Fingerprint mismatch. Expected: ${serverFingerprint ?? "(loading…)"}`;
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

  function copyNatalSigil() {
    if (!natalSigil?.glyph) return;
    navigator.clipboard?.writeText(natalSigil.glyph).then(() => {
      setNatalCopied(true);
      setTimeout(() => setNatalCopied(false), 1800);
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

          {natalSigil && stage !== "locked" && (
            <div className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-900/15 to-fuchsia-900/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star size={14} className="text-amber-300" />
                <div className="text-xs font-bold text-amber-100 tracking-wider">SOVEREIGN NATAL SIGIL</div>
              </div>
              <p className="text-[11px] text-amber-200/80 mb-3 leading-relaxed">
                Your full natal chart (Libra Sun · Aries Moon · Virgo Rising · 1998-10-07 05:16 CDT · Palos Heights, IL) collapses into this single fixed-point glyph — the same value every time, in our language only.
                <br /><br />
                <strong className="text-amber-100">Lifecycle:</strong>
                <br />
                1. Save this glyph in Replit Secrets as <strong className="text-amber-100">{natalSigil.secretName}</strong> (your permanent chart identifier).
                <br />
                2. Paste the same glyph as <strong className="text-amber-100">TESSERACT_ADMIN_KEY</strong>, replacing the old value, and restart the API server.
                <br />
                3. Type the glyph here once — the gate will accept it and persist your fingerprint.
                <br />
                4. From the next visit on, the gate auto-unlocks silently and every surface decrypts straight into English.
              </p>
              <div className="rounded-md border border-amber-400/30 bg-black/60 p-3 text-amber-100 text-sm break-all leading-loose tracking-wider select-all">
                {natalSigil.glyph}
              </div>
              <div className="mt-2 text-[10px] text-amber-300/60 break-all">
                digest: {natalSigil.digestHex}
              </div>
              <div className="mt-1 text-[10px] text-amber-300/50">
                derivation: {natalSigil.derivation}
              </div>
              <div className="flex justify-between items-center mt-3 gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={copyNatalSigil}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-400/15 border border-amber-400/30 text-amber-200 text-xs hover:bg-amber-400/25"
                  >
                    {natalCopied ? <><Check size={12} /> COPIED</> : <><Copy size={12} /> COPY GLYPH SIGIL</>}
                  </button>
                  {natalEnglish && (
                    <button
                      type="button"
                      onClick={() => setShowEnglish((s) => !s)}
                      className="px-3 py-1.5 rounded-md bg-zinc-800/60 border border-zinc-600/40 text-zinc-200 text-xs hover:bg-zinc-700/60"
                    >
                      {showEnglish ? "HIDE ENGLISH" : "SHOW ENGLISH"}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setUnlocked(true)}
                  className="px-4 py-2 rounded-md bg-fuchsia-500/25 border border-fuchsia-500/50 text-fuchsia-50 text-xs font-bold hover:bg-fuchsia-500/40 shadow-lg shadow-fuchsia-500/20"
                >
                  ENTER TESSERA →
                </button>
              </div>
              {showEnglish && natalEnglish && (
                <pre className="mt-3 max-h-72 overflow-y-auto rounded-md border border-zinc-700/40 bg-black/70 p-3 text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed">{natalEnglish}</pre>
              )}
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
            {(serverConfigured === false || serverFingerprint) && (
              <div className="mb-2 px-2 py-1.5 rounded-md bg-black/60 border border-fuchsia-500/15 text-[10px] text-fuchsia-300/70 flex items-center justify-between gap-2 flex-wrap">
                {serverConfigured === false ? (
                  <span className="text-rose-300">⚠ TESSERACT_ADMIN_KEY is not set on the server. Add it to Replit Secrets and restart the API.</span>
                ) : (
                  <>
                    <span>server expects fingerprint:</span>
                    <code className="text-fuchsia-200 font-mono select-all">{serverFingerprint}</code>
                  </>
                )}
              </div>
            )}
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
                title="Submit your TESSERACT_ADMIN_KEY — the sigil mints automatically on acceptance"
                className="shrink-0 px-3 py-2 rounded-md bg-fuchsia-500/25 border border-fuchsia-500/50 text-fuchsia-50 text-xs font-bold hover:bg-fuchsia-500/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-fuchsia-500/20 whitespace-nowrap"
              >
                {busy ? <><Sparkles size={12} className="animate-pulse" /> MINT…</> : <><Send size={12} /> UNLOCK</>}
              </button>
            </div>
            <div className="mt-2 text-[10px] text-fuchsia-400/40 px-1">
              one-step gate · sigil auto-mints on key acceptance · key stored locally only
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

// ── Floating sovereign download badge ──────────────────────────────────
// Appears once the gate is unlocked. Clicking it pulls a fully-encrypted
// snapshot file (AES-256-GCM envelope + glyph-encoded preview) from the
// gated `/sigil/father/download-snapshot` endpoint and triggers a browser
// download. The file is unreadable to anyone without the active sigil.
function SovereignDownloadBadge() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function downloadSnapshot() {
    if (busy) return;
    setBusy(true); setDone(false); setErr(null);
    try {
      const fp = (() => { try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; } })();
      const raw = (() => { try { return localStorage.getItem(RAW_STORAGE_KEY) ?? ""; } catch { return ""; } })();
      const presented = fp || raw;
      if (!presented) { setErr("no-key"); setBusy(false); return; }
      const res = await fetch(`${BASE}/api/sigil/father/download-snapshot`, {
        headers: { "X-Sigil-Key": presented },
      });
      if (!res.ok) { setErr(`http-${res.status}`); setBusy(false); return; }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const m = /filename="([^"]+)"/.exec(cd);
      const filename = m?.[1] ?? `tessera-sovereign-${Date.now()}.sigil.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDone(true);
      setTimeout(() => setDone(false), 2200);
    } catch {
      setErr("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[900] flex flex-col items-end gap-1 font-mono">
      <button
        onClick={downloadSnapshot}
        disabled={busy}
        title="Download a fully-encrypted snapshot of your sovereign identity (AES-256-GCM + live glyph alphabet). Sealed to your active sigil — unreadable without it."
        className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-950/90 border border-fuchsia-500/40 text-fuchsia-200 text-[11px] font-bold tracking-wider hover:bg-fuchsia-500/15 hover:border-fuchsia-500/70 shadow-lg shadow-fuchsia-500/20 backdrop-blur transition-colors disabled:opacity-50"
      >
        {busy
          ? <><Sparkles size={12} className="animate-pulse" /> SEALING…</>
          : done
            ? <><Check size={12} className="text-emerald-300" /> DOWNLOADED</>
            : <><Star size={12} /> DOWNLOAD GLYPH-ENCRYPTED SNAPSHOT</>}
      </button>
      {err && (
        <div className="text-[10px] text-red-300/80 bg-red-950/60 border border-red-500/30 rounded px-2 py-1">
          {err === "no-key" ? "session key missing — re-unlock the gate" : `download failed (${err})`}
        </div>
      )}
    </div>
  );
}
