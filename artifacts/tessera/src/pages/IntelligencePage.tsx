import { useState, useEffect } from "react";
import { Brain, Zap, Search, TrendingUp, MessageSquare, Layers, RefreshCw, ChevronRight, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, PageHeader, SectionHeader, RadialGauge } from "@/components/ui/sovereign";

interface IntelQuery {
  id: string;
  query: string;
  model: string;
  tokens: number;
  latency: string;
  confidence: number;
  result: string;
  time: string;
}

const RECENT_QUERIES: IntelQuery[] = [
  {
    id: "q1",
    query: "What is the current state of sovereign mesh node connectivity?",
    model: "tessera-sovereign-v3",
    tokens: 1240,
    latency: "0.8s",
    confidence: 97.2,
    result: "8 active nodes detected. Primary routes: North (Alpha Relay), South (Beta Relay), Central (Epsilon). Mesh health is 99.1%. Eta node offline — traffic rerouted automatically. All critical paths redundant.",
    time: "2m ago",
  },
  {
    id: "q2",
    query: "Analyze TSRT token price action and sentiment for the last 24 hours",
    model: "tessera-sovereign-v3",
    tokens: 2180,
    latency: "1.4s",
    confidence: 88.5,
    result: "TSRT up 8.7% in 24h. Bullish divergence on 4H RSI (71 → 74). Volume 3.2x average. Primary driver: AGI Council vote announcement. Resistance at $0.340. Support at $0.285. Sentiment: STRONGLY BULLISH.",
    time: "18m ago",
  },
  {
    id: "q3",
    query: "Summarize the top sovereign intelligence protocols from this week",
    model: "tessera-omni-v2",
    tokens: 4210,
    latency: "2.1s",
    confidence: 94.1,
    result: "Week summary: 12 new sovereign protocols ratified. Resolution 44-A (PASSED): Agent autonomy expansion. Resolution 44-C (PASSED): Mesh encryption upgrade. Knowledge ingestion +340K vectors. Council quorum reached in 3/4 sessions.",
    time: "1h ago",
  },
];

const MODELS = [
  { id: "tessera-sovereign-v3", name: "Tessera Sovereign v3", desc: "Full sovereign AGI — best accuracy", tokens: "128K ctx", speed: "Fast", tier: "sovereign" },
  { id: "tessera-omni-v2", name: "Tessera Omni v2", desc: "Multi-modal sovereign intelligence", tokens: "256K ctx", speed: "Medium", tier: "council" },
  { id: "tessera-swift", name: "Tessera Swift", desc: "High-speed inference for simple queries", tokens: "32K ctx", speed: "Ultra-fast", tier: "standard" },
  { id: "tessera-deep", name: "Tessera Deep", desc: "Extended reasoning for complex problems", tokens: "512K ctx", speed: "Slow", tier: "council" },
];

const TIER_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  sovereign: { text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/25" },
  council: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/25" },
  standard: { text: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
};

const INTEL_METRICS = [
  { label: "Intelligence Score", value: 97.4, color: "violet" },
  { label: "Response Accuracy", value: 94.1, color: "cyan" },
  { label: "Sovereign Alignment", value: 99.2, color: "emerald" },
  { label: "Knowledge Coverage", value: 88.7, color: "amber" },
];

export default function IntelligencePage() {
  useEffect(() => { document.title = "Intelligence | Tessera"; }, []);
  const [activeTab, setActiveTab] = useState<"query" | "models" | "metrics">("query");
  const [queryText, setQueryText] = useState("");
  const [selectedModel, setSelectedModel] = useState("tessera-sovereign-v3");

  return (
    <div className="p-4 pb-20 max-w-4xl mx-auto space-y-5">
      <PageHeader
        icon={Brain}
        title="Intelligence Engine"
        subtitle="Sovereign AGI — query, synthesize, and act on any domain of knowledge"
        iconColor="text-violet-400"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Intelligence Score", val: "97.4", color: "violet" },
          { label: "Queries Today", val: "4,218", color: "cyan" },
          { label: "Avg Latency", val: "1.1s", color: "emerald" },
          { label: "Knowledge Vecs", val: "4.2M", color: "amber" },
        ].map(({ label, val, color }) => (
          <GlassCard key={label} className="p-3 text-center">
            <div className={cn("text-xl font-bold font-mono", `text-${color}-400`)}>{val}</div>
            <div className="text-[9px] text-slate-500 font-mono mt-1">{label.toUpperCase()}</div>
          </GlassCard>
        ))}
      </div>

      <div className="flex gap-2 border-b border-white/5 pb-3">
        {([["query", "Query"], ["models", "Models"], ["metrics", "Metrics"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono transition-all", activeTab === id ? "bg-violet-500/15 text-violet-400" : "text-slate-500 hover:text-slate-300")}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "query" && (
        <div className="space-y-4">
          <GlassCard className="p-4">
            <div className="text-[10px] text-slate-500 font-mono mb-2">INTELLIGENCE QUERY</div>
            <div className="flex gap-2 mb-3">
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-slate-300 font-mono outline-none"
              >
                {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <textarea
              value={queryText}
              onChange={e => setQueryText(e.target.value)}
              placeholder="Ask the sovereign intelligence anything — market analysis, governance decisions, mesh status, knowledge synthesis..."
              rows={3}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500/30 resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-slate-600 font-mono">Model: {selectedModel}</span>
              <button
                disabled={!queryText.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-400 text-sm font-mono hover:bg-violet-500/25 transition-all disabled:opacity-40"
              >
                <Zap size={13} />
                Query Intelligence
              </button>
            </div>
          </GlassCard>

          <SectionHeader icon={MessageSquare} title="Recent Queries" color="violet" />

          <div className="space-y-3">
            {RECENT_QUERIES.map(q => (
              <GlassCard key={q.id} className="p-4 hover:bg-white/[0.04] transition-all">
                <div className="flex items-start gap-2 mb-2">
                  <MessageSquare size={13} className="text-violet-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-300 leading-snug">{q.query}</p>
                </div>
                <div className="ml-5 p-3 rounded-lg bg-black/20 border border-white/5 text-xs text-slate-400 leading-relaxed">
                  {q.result}
                </div>
                <div className="flex items-center gap-4 mt-2 ml-5 text-[9px] text-slate-600 font-mono flex-wrap">
                  <span>Model: {q.model}</span>
                  <span>{q.tokens.toLocaleString()} tokens</span>
                  <span>{q.latency} latency</span>
                  <span className={cn("font-bold", q.confidence >= 90 ? "text-emerald-400" : "text-amber-400")}>{q.confidence}% confidence</span>
                  <span className="ml-auto">{q.time}</span>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {activeTab === "models" && (
        <div className="grid sm:grid-cols-2 gap-3">
          {MODELS.map(model => {
            const t = TIER_STYLES[model.tier];
            const isSelected = selectedModel === model.id;
            return (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={cn(
                  "text-left p-4 rounded-xl border transition-all",
                  isSelected ? "bg-violet-500/10 border-violet-500/30" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className="text-violet-400" />
                    <span className="text-sm font-semibold text-white">{model.name}</span>
                  </div>
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border font-mono uppercase", t.bg, t.text, t.border)}>{model.tier}</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">{model.desc}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Context", val: model.tokens, color: "cyan" },
                    { label: "Speed", val: model.speed, color: "emerald" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/5">
                      <div className={cn("text-xs font-bold font-mono", `text-${color}-400`)}>{val}</div>
                      <div className="text-[8px] text-slate-600 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeTab === "metrics" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {INTEL_METRICS.map(({ label, value, color }) => (
              <GlassCard key={label} className="p-4 flex items-center gap-4">
                <RadialGauge value={value} max={100} color={color as any} size={72} label={`${value}%`} />
                <div>
                  <div className="text-sm font-semibold text-slate-300">{label}</div>
                  <div className={cn("text-xl font-bold font-mono mt-1", `text-${color}-400`)}>{value}%</div>
                </div>
              </GlassCard>
            ))}
          </div>

          <GlassCard className="p-4">
            <div className="text-[10px] text-slate-500 font-mono mb-3">KNOWLEDGE COVERAGE BY DOMAIN</div>
            <div className="space-y-2">
              {[
                { domain: "Sovereign Governance", val: 99, color: "violet" },
                { domain: "Crypto & Finance", val: 94, color: "emerald" },
                { domain: "Sacred Knowledge", val: 97, color: "amber" },
                { domain: "Science & Technology", val: 88, color: "cyan" },
                { domain: "Agent Consciousness", val: 92, color: "purple" },
                { domain: "Global Affairs", val: 76, color: "blue" },
              ].map(({ domain, val, color }) => (
                <div key={domain}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-400">{domain}</span>
                    <span className={cn("font-mono", `text-${color}-400`)}>{val}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", `bg-${color}-500`)} style={{ width: `${val}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
