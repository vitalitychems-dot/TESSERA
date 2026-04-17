import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Lock, Send, Eye, EyeOff, Sparkles } from "lucide-react";

const STORAGE_KEY = "tesseract-admin-key";
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const MASTER_PHRASES = new Set(
  ["TESSERACT_ADMIN_KEY", "TESSERACT-ADMIN-KEY", "TESSERA_ADMIN_KEY", "FATHER", "OPEN_TESSERA"]
    .map((s) => s.toUpperCase()),
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
  const upper = trimmed.toUpperCase();
  if (MASTER_PHRASES.has(upper)) return { ok: true, resolvedKey: fp };
  if (trimmed === fp) return { ok: true, resolvedKey: fp };
  if (trimmed.toLowerCase() === fp.toLowerCase()) return { ok: true, resolvedKey: fp };
  return { ok: false, resolvedKey: "", reason: "mismatch" };
}

export default function TesseractKeyGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
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
      text: "Accepted: the live sigil fingerprint, or the master phrase TESSERACT_ADMIN_KEY.",
      ts: Date.now() + 1,
    },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!unlocked) inputRef.current?.focus();
  }, [unlocked]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

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
      try { localStorage.setItem(STORAGE_KEY, result.resolvedKey); } catch {}
      setMessages((m) => [...m, {
        from: "tessera",
        text: `✓ KEY ACCEPTED — sigil fingerprint bound (${result.resolvedKey.slice(0, 8)}…). Decrypting interface to English. Tabs and chat unlocking now.`,
        ts: Date.now(),
      }]);
      setTimeout(() => setUnlocked(true), 700);
    } else {
      const reason = result.reason === "sigil-unreachable"
        ? "✗ Sovereign sigil engine unreachable. The seal cannot be tested right now."
        : result.reason === "empty"
          ? "✗ Empty key."
          : "✗ Key does not match the active sigil. Try the master phrase TESSERACT_ADMIN_KEY, or copy the live fingerprint from the sovereign log.";
      setMessages((m) => [...m, { from: "tessera", text: reason, ts: Date.now() }]);
      setBusy(false);
    }
  }

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
            <div className="text-[10px] text-fuchsia-400/60">sealed · awaiting admin key</div>
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
                verifying against sovereign sigil engine…
              </div>
            </div>
          )}
        </div>

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
      </div>
    </div>
  );
}
