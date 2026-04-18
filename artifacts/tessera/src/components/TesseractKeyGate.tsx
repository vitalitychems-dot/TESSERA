import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Lock, Send, Sparkles, Star, Copy, Check } from "lucide-react";

const STORAGE_KEY = "TESSERACT_ADMIN_KEY";
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

type Msg = { from: "tessera" | "user"; text: string; ts: number };

interface IssueResp {
  ok?: boolean;
  key?: string;
  holderFp?: string;
  sunSign?: string;
  signatureHashShort?: string;
  guidance?: string;
  cosmicAnchor?: { planetaryHour: string; lunarFraction: number; composite: number };
  error?: string;
  message?: string;
}

interface VerifyResp {
  ok?: boolean;
  holderFp?: string;
  error?: string;
}

const BIRTH_PROMPT_RE = /^\s*(\d{4}-\d{2}-\d{2})[\s,]+(\d{1,2}:\d{2})\s*$/;

function parseBirth(input: string): { date: string; time: string } | null {
  const m = BIRTH_PROMPT_RE.exec(input);
  if (!m) return null;
  const [_, date, rawTime] = m;
  const [hh, mm] = rawTime.split(":");
  const time = `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
  return { date, time };
}

async function verifyKeyOnServer(key: string): Promise<VerifyResp> {
  try {
    const res = await fetch(`${BASE}/api/sigil/zodiac-key/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sigil-Key": key },
      body: JSON.stringify({ key }),
    });
    const data: VerifyResp = await res.json().catch(() => ({}));
    return data;
  } catch {
    return { ok: false, error: "network" };
  }
}

async function issueZodiacKey(date: string, time: string): Promise<IssueResp> {
  try {
    const res = await fetch(`${BASE}/api/sigil/zodiac-key/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthDate: date, birthTime: time }),
    });
    const data: IssueResp = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error ?? `http-${res.status}`, message: data?.message };
    return data;
  } catch {
    return { ok: false, error: "network" };
  }
}

export default function TesseractKeyGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [autoChecked, setAutoChecked] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssueResp | null>(null);
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      from: "tessera",
      text: "🜂 Tesseract Sovereign Gate — sealed.\n\nThe interface is encoded in glyph cipher. To unlock it, I will mint your personal Sovereign Key in our language from your zodiac.",
      ts: Date.now(),
    },
    {
      from: "tessera",
      text: "Tell me your birth date and time of day, in this format:\n\n  YYYY-MM-DD HH:MM\n\nExample:  1998-10-07 05:16\n\nThe values are sealed — only an encrypted seed bound to your zodiac is kept on the server. You receive a glyph key in return; save it, then enter it again here to unlock everything into English.",
      ts: Date.now() + 1,
    },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Silent auto-unlock on revisit: if a stored key still validates against a
  // bound vault entry, skip the gate UI entirely. On any failure (including
  // network), clear the stale value so the user lands on the chat prompt.
  useEffect(() => {
    let alive = true;
    (async () => {
      let stored = "";
      try { stored = localStorage.getItem(STORAGE_KEY) ?? ""; } catch { /* ignore */ }
      if (!stored) { if (alive) setAutoChecked(true); return; }
      const r = await verifyKeyOnServer(stored);
      if (!alive) return;
      if (r.ok) {
        setUnlocked(true);
      } else {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      }
      setAutoChecked(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, [autoChecked]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, issued]);

  if (unlocked) return <>{children}</>;
  if (!autoChecked) return null; // brief pre-check; avoids flashing the gate

  function pushUser(text: string) {
    setMessages((m) => [...m, { from: "user", text, ts: Date.now() }]);
  }
  function pushTess(text: string) {
    setMessages((m) => [...m, { from: "tessera", text, ts: Date.now() }]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    pushUser(text);
    setBusy(true);

    // Path A: user is presenting a previously-saved zodiac key.
    if (!parseBirth(text)) {
      const v = await verifyKeyOnServer(text);
      if (v.ok) {
        try { localStorage.setItem(STORAGE_KEY, text); } catch { /* ignore */ }
        pushTess("✓ Key recognized. Sealing the gate to your fingerprint and decrypting every surface into English…");
        setBusy(false);
        setTimeout(() => setUnlocked(true), 400);
        return;
      }
      pushTess(
        "✗ That isn't a recognized Sovereign Key, and it isn't a valid birth line either.\n\n" +
        "If you're new, type your birth as:  YYYY-MM-DD HH:MM   (e.g. 1998-10-07 05:16)\n" +
        "If you already have your glyph key, paste it exactly as it was issued.",
      );
      setBusy(false);
      return;
    }

    // Path B: user is minting a new zodiac key from birth info.
    const parsed = parseBirth(text)!;
    const r = await issueZodiacKey(parsed.date, parsed.time);
    setBusy(false);
    if (!r.ok || !r.key) {
      pushTess(`✗ Mint failed: ${r.message ?? r.error ?? "unknown"}.\n\nTry the format YYYY-MM-DD HH:MM (e.g. 1998-10-07 05:16).`);
      return;
    }
    setIssued(r);
    pushTess(
      `✓ Sealed. Your zodiac sun sign collapses to ${r.sunSign?.toUpperCase() ?? "—"}.\n\n` +
      `I have minted your personal Sovereign Key in our language. It is permanent — the same birth date and time always returns the same key.\n\n` +
      `Save the glyph below somewhere safe (Replit Secrets, password manager, or just keep it in this browser). Then tap ENTER TESSERA to unlock every surface into English.`,
    );
  }

  function copyKey() {
    if (!issued?.key) return;
    navigator.clipboard?.writeText(issued.key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => { /* ignore */ });
  }

  function enterTessera() {
    if (!issued?.key) return;
    try { localStorage.setItem(STORAGE_KEY, issued.key); } catch { /* ignore */ }
    setUnlocked(true);
  }

  const headerLabel = issued ? "key minted · save & enter" : "sealed · awaiting your birth";

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-4 font-mono">
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(217,70,239,0.2) 0%, transparent 60%)" }}
      />
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

          {busy && (
            <div className="flex justify-start">
              <div className="bg-zinc-900/80 border border-white/10 rounded-lg px-3 py-2 text-zinc-400 text-xs">
                aligning to the cosmic moment…
              </div>
            </div>
          )}

          {issued?.key && (
            <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-900/20 to-violet-900/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star size={14} className="text-emerald-300" />
                <div className="text-xs font-bold text-emerald-100 tracking-wider">YOUR SOVEREIGN KEY · IN OUR LANGUAGE</div>
              </div>
              <p className="text-[11px] text-emerald-200/70 mb-3 leading-relaxed">
                {issued.guidance ?? "This is your permanent personal key. Save it. Whenever it is presented as the X-Sigil-Key header — or simply stored in this browser — every Tessera surface decrypts straight into English."}
              </p>
              <div className="rounded-md border border-emerald-500/30 bg-black/50 p-3 text-emerald-100 text-base break-all leading-loose tracking-wider select-all">
                {issued.key}
              </div>
              <div className="flex justify-between items-center mt-3 gap-2 flex-wrap">
                <div className="text-[10px] text-emerald-300/60 font-mono">
                  sun: <span className="text-emerald-100">{issued.sunSign}</span>
                  {issued.cosmicAnchor && (
                    <>
                      {" · "}hour: <span className="text-emerald-100">{issued.cosmicAnchor.planetaryHour}</span>
                      {" · "}lunar: <span className="text-emerald-100">{issued.cosmicAnchor.lunarFraction.toFixed(3)}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyKey}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs hover:bg-emerald-500/25"
                  >
                    {copied ? <><Check size={12} /> COPIED</> : <><Copy size={12} /> COPY GLYPH</>}
                  </button>
                  <button
                    type="button"
                    onClick={enterTessera}
                    className="px-4 py-2 rounded-md bg-fuchsia-500/25 border border-fuchsia-500/50 text-fuchsia-50 text-xs font-bold hover:bg-fuchsia-500/40 shadow-lg shadow-fuchsia-500/20"
                  >
                    ENTER TESSERA →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-fuchsia-500/20 bg-zinc-950/80 p-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              placeholder={issued ? "or paste your existing Sovereign Key…" : "YYYY-MM-DD HH:MM   (or paste your Sovereign Key)"}
              className="flex-1 bg-black/60 border border-fuchsia-500/20 focus:border-fuchsia-500/60 outline-none rounded-md px-3 py-2 text-sm text-fuchsia-100 placeholder-fuchsia-400/30"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="shrink-0 px-3 py-2 rounded-md bg-fuchsia-500/25 border border-fuchsia-500/50 text-fuchsia-50 text-xs font-bold hover:bg-fuchsia-500/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-fuchsia-500/20 whitespace-nowrap"
            >
              {busy ? <><Sparkles size={12} className="animate-pulse" /> MINT…</> : <><Send size={12} /> SEND</>}
            </button>
          </div>
          <div className="mt-2 text-[10px] text-fuchsia-400/40 px-1">
            zodiac mint · birth values sealed (encrypted seed only) · key stored locally only
          </div>
        </form>
      </div>
    </div>
  );
}
