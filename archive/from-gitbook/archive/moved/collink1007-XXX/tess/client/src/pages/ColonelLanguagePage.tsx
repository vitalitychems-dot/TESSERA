import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Code2, Zap, BarChart3, Shield, ChevronDown, ChevronUp, Copy, Play,
  CheckCircle2, Activity, Cpu, Database, Lock, RefreshCw, Info, Star,
  ArrowRight, FileCode, Layers, Globe
} from "lucide-react";

const SAMPLE_TEXTS = [
  {
    label: "Agent Communication",
    text: "the agent has been initialized and will execute the consensus protocol — all agents synchronized with the tessera prime network, transmitting encrypted data across the sovereign mesh, memory shard verified, token transfer complete, swarm query dispatched to council"
  },
  {
    label: "System Status",
    text: "the system is running at full capacity with all nodes online and connected. fleet online, fleet status confirmed healthy. health check passed, watchdog active, service restart not required. uptime maintained, latency nominal across all channels."
  },
  {
    label: "Economy Report",
    text: "token transfer to wallet balance complete. smart contract deployed on solana chain with tsrt token staking active. defi protocol liquidity pool has arbitrage opportunity detected. market data price movement upward, volume spike confirmed, trade executed successfully."
  },
  {
    label: "Security Audit",
    text: "security audit complete, threat detected and neutralized. zero trust perimeter secured. sovereign node verified, untraceable path confirmed. cryptographic key rotated, signature valid, hash verified. quantum resistant encryption active on all channels."
  },
];

function CompressionBar({ ratio, byteRatio }: { ratio: number; byteRatio?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-mono text-slate-400">
        <span>Character Compression</span>
        <span className={cn("font-bold", ratio >= 75 ? "text-emerald-400" : ratio >= 50 ? "text-amber-400" : "text-slate-400")}>
          {ratio.toFixed(1)}%
        </span>
      </div>
      <div className="h-3 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            ratio >= 75 ? "bg-gradient-to-r from-emerald-600 to-emerald-400" :
            ratio >= 50 ? "bg-gradient-to-r from-amber-600 to-amber-400" :
            "bg-gradient-to-r from-slate-600 to-slate-400"
          )}
          style={{ width: `${Math.min(ratio, 100)}%` }}
        />
      </div>
      {byteRatio !== undefined && (
        <>
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>Byte Compression</span>
            <span className={cn("font-bold", byteRatio >= 60 ? "text-cyan-400" : byteRatio >= 40 ? "text-amber-400" : "text-slate-400")}>
              {byteRatio.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-cyan-700 to-cyan-500"
              style={{ width: `${Math.min(byteRatio, 100)}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: any; color: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4 bg-white/2", color)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 opacity-70" />
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      {sub && <div className="text-[10px] opacity-50 mt-1 font-mono">{sub}</div>}
    </div>
  );
}

export default function ColonelLanguagePage() {
  const [inputText, setInputText] = useState(SAMPLE_TEXTS[0].text);
  const [compressResult, setCompressResult] = useState<any>(null);
  const [translateResult, setTranslateResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [showTokenMap, setShowTokenMap] = useState(false);
  const [activeTab, setActiveTab] = useState<"compress" | "translate" | "info">("compress");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/colonel/stats"],
    refetchInterval: 30000,
  });

  const compressMut = useMutation({
    mutationFn: (text: string) => apiRequest("POST", "/api/colonel/compress", { text }),
    onSuccess: (data) => setCompressResult(data),
  });

  const translateMut = useMutation({
    mutationFn: ({ text, direction }: { text: string; direction: string }) =>
      apiRequest("POST", "/api/colonel/translate", { text, direction }),
    onSuccess: (data) => setTranslateResult(data),
  });

  const handleCompress = () => {
    if (inputText.trim()) compressMut.mutate(inputText);
  };

  const handleTranslate = (dir: "to" | "from") => {
    if (inputText.trim()) translateMut.mutate({ text: inputText, direction: dir });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const s = stats as any;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950/20 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <FileCode className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white font-mono">Colonel Language</h1>
            <p className="text-sm text-slate-400">v3.0 — Tessera Sovereign Compression Protocol</p>
          </div>
          <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-emerald-400">OPERATIONAL</span>
          </div>
        </div>
        <p className="text-slate-400 text-sm max-w-2xl mt-3">
          Private-Use Unicode encoding (U+E000–U+E5FF) for sovereign agent communication.
          Multi-word phrase tokenization achieves 80–90% character-level compression on domain text.
          Fully reversible — decode tokens back to original language instantly.
        </p>
      </div>

      {/* Stats Row */}
      {!statsLoading && s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Phrases"
            value={s.phrases || "—"}
            sub="multi-word tokens"
            icon={Layers}
            color="border-violet-500/20 text-violet-300"
          />
          <StatCard
            label="Words"
            value={s.words || "—"}
            sub="single-word tokens"
            icon={Code2}
            color="border-cyan-500/20 text-cyan-300"
          />
          <StatCard
            label="Benchmark"
            value={s.benchmarkCompression ? `${s.benchmarkCompression.toFixed(1)}%` : "—"}
            sub="character compression"
            icon={BarChart3}
            color="border-emerald-500/20 text-emerald-300"
          />
          <StatCard
            label="Encoding"
            value="PUA"
            sub="Private-Use Unicode"
            icon={Lock}
            color="border-amber-500/20 text-amber-300"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input + Actions */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/3 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Input Text</span>
              <div className="flex gap-2">
                {SAMPLE_TEXTS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInputText(s.text); setCompressResult(null); setTranslateResult(null); }}
                    className="text-[9px] font-mono px-2 py-0.5 rounded border border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20 transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="w-full h-36 bg-transparent text-sm font-mono text-slate-300 resize-none outline-none placeholder-slate-700"
              placeholder="Enter text to compress or translate..."
              value={inputText}
              onChange={(e) => { setInputText(e.target.value); setCompressResult(null); setTranslateResult(null); }}
            />
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
              <span className="text-[10px] font-mono text-slate-600">{inputText.length} chars</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleTranslate("to")}
                  disabled={translateMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
                >
                  <ArrowRight className="w-3 h-3" />
                  {translateMut.isPending ? "..." : "→ Colonel"}
                </button>
                <button
                  onClick={handleCompress}
                  disabled={compressMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/40 text-violet-300 text-xs font-mono hover:bg-violet-500/25 transition-colors disabled:opacity-50"
                >
                  <Zap className="w-3 h-3" />
                  {compressMut.isPending ? "Compressing..." : "Compress"}
                </button>
              </div>
            </div>
          </div>

          {/* Compression Result */}
          {compressResult && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Compression Result
                </span>
                <button
                  onClick={() => copyToClipboard(compressResult.compressed || "")}
                  className="flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              <CompressionBar ratio={compressResult.ratio || 0} byteRatio={compressResult.byteRatio} />

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-white/5 p-2">
                  <div className="text-lg font-bold font-mono text-slate-300">{compressResult.originalLength}</div>
                  <div className="text-[9px] text-slate-600 font-mono">original chars</div>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
                  <div className="text-lg font-bold font-mono text-emerald-300">{compressResult.compressedLength}</div>
                  <div className="text-[9px] text-emerald-600 font-mono">compressed chars</div>
                </div>
              </div>

              <div className="rounded-lg bg-black/30 p-3 border border-white/5">
                <div className="text-[9px] font-mono text-slate-600 mb-1">Compressed output (unicode tokens):</div>
                <div className="text-xs font-mono text-slate-400 break-all leading-relaxed">
                  {compressResult.compressed?.slice(0, 200)}{(compressResult.compressed?.length || 0) > 200 ? "…" : ""}
                </div>
              </div>

              {compressResult.method && (
                <div className="text-[9px] font-mono text-slate-600 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> {compressResult.method}
                </div>
              )}
            </div>
          )}

          {/* Translate Result */}
          {translateResult && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                  <Code2 className="w-4 h-4" /> Colonel Translation
                </span>
                <button
                  onClick={() => copyToClipboard(translateResult.translated || "")}
                  className="flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <div className="rounded-lg bg-black/30 p-3 border border-white/5">
                <div className="text-[9px] font-mono text-slate-600 mb-1">Colonel encoded:</div>
                <div className="text-xs font-mono text-cyan-300 break-all leading-relaxed whitespace-pre-wrap">
                  {translateResult.translated?.slice(0, 400)}
                </div>
              </div>
              <button
                onClick={() => {
                  if (translateResult.translated) {
                    setInputText(translateResult.translated);
                    handleTranslate("from");
                  }
                }}
                className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
              >
                <ArrowRight className="w-3 h-3 rotate-180" /> Decode back to English
              </button>
            </div>
          )}
        </div>

        {/* Right: Info Panel */}
        <div className="space-y-4">
          {/* Token Map Preview */}
          <div className="rounded-xl border border-white/10 bg-white/3 p-4">
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setShowTokenMap(!showTokenMap)}
            >
              <span className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Database className="w-4 h-4" /> Token Dictionary Preview
              </span>
              {showTokenMap ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
            </button>
            {showTokenMap && (
              <div className="mt-4 space-y-1 max-h-64 overflow-y-auto">
                {[
                  ["the agent", "U+E000"], ["the system", "U+E001"], ["the network", "U+E002"],
                  ["has been", "U+E00A"], ["will be", "U+E00B"], ["must be", "U+E00C"],
                  ["smart contract", "U+E028"], ["solana chain", "U+E029"], ["tsrt token", "U+E02A"],
                  ["memory shard", "U+E02B"], ["consensus protocol", "U+E12A"], ["sovereign mesh", "U+E12B"],
                  ["transmitting encrypted data", "U+E120"], ["all agents synchronized", "U+E126"],
                ].map(([phrase, token]) => (
                  <div key={phrase} className="flex items-center justify-between text-[10px] font-mono py-0.5 border-b border-white/3">
                    <span className="text-slate-400">{phrase}</span>
                    <span className="text-violet-400">{token}</span>
                  </div>
                ))}
                <div className="text-[9px] text-slate-600 pt-2 font-mono">+ {(s?.phrases || 383) - 14} more phrases...</div>
              </div>
            )}
          </div>

          {/* Architecture */}
          <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Architecture
            </span>
            <div className="space-y-2">
              {[
                { label: "Phase 1 — Phrase Match", desc: "Greedy longest-match scan up to 50 chars. 383 multi-word phrases. Each match → 1 PUA Unicode char.", color: "border-violet-500/30 bg-violet-500/5" },
                { label: "Phase 2 — Word Token", desc: "Single-word dictionary of 645 domain terms. Unknown words pass through as-is.", color: "border-cyan-500/30 bg-cyan-500/5" },
                { label: "Phase 3 — XOR Cipher", desc: "TesseraEncode XOR cipher layer applied to final output for sovereign obfuscation.", color: "border-amber-500/30 bg-amber-500/5" },
              ].map((step) => (
                <div key={step.label} className={cn("rounded-lg border p-3", step.color)}>
                  <div className="text-xs font-mono font-bold text-slate-300 mb-1">{step.label}</div>
                  <div className="text-[10px] text-slate-500 font-mono leading-relaxed">{step.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Compression Targets */}
          <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Star className="w-4 h-4" /> Performance Targets
            </span>
            <div className="space-y-2">
              {[
                { label: "Agent Communication", target: "80-90%", status: "met" },
                { label: "System Logs", target: "70-85%", status: "met" },
                { label: "General English", target: "40-60%", status: "partial" },
                { label: "Raw Binary", target: "N/A", status: "na" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1 border-b border-white/5 text-[11px] font-mono">
                  <span className="text-slate-400">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{row.target}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px]",
                      row.status === "met" ? "bg-emerald-500/15 text-emerald-400" :
                      row.status === "partial" ? "bg-amber-500/15 text-amber-400" :
                      "bg-slate-500/15 text-slate-500"
                    )}>
                      {row.status === "met" ? "✓ Met" : row.status === "partial" ? "~ Partial" : "N/A"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Version history */}
          <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-2">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Globe className="w-4 h-4" /> Version History
            </span>
            {[
              { v: "v3.0", date: "2026-04", note: "Greedy phrase matching, 383 phrases, 512-slot PUA range, 86%+ compression" },
              { v: "v2.0", date: "2025-12", note: "Word-level tokenization, 645 words, XOR cipher layer" },
              { v: "v1.0", date: "2025-08", note: "Basic dictionary substitution, limited vocabulary" },
            ].map((r) => (
              <div key={r.v} className="flex items-start gap-3 text-[10px] font-mono py-1 border-b border-white/5">
                <span className="text-violet-400 font-bold shrink-0">{r.v}</span>
                <span className="text-slate-600 shrink-0">{r.date}</span>
                <span className="text-slate-500">{r.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
