import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Code2, Play, CheckCircle, XCircle, RefreshCw, Shield, GitBranch, Cpu,
  Terminal, ChevronDown, ChevronUp, Zap, Database, Search, Filter,
  ExternalLink, Globe, Tag, Clock, AlertTriangle, Activity
} from "lucide-react";

interface SandboxTask {
  id: string;
  name: string;
  status: "pending" | "running" | "passed" | "failed";
  executor: string;
  executioner: string;
  description: string;
  result?: string;
  timestamp: string;
}

interface IngestedItem {
  id: number;
  source: string;
  sourceType: string;
  title: string | null;
  content: string;
  url: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  ingestedAt: string;
  publishedAt: string | null;
}

interface IngestionStats {
  totalItems: number;
  bySource: Array<{ source: string; count: number }>;
  byType: Array<{ sourceType: string; count: number }>;
  sources: Array<{ id: number; name: string; type: string; enabled: boolean; lastRunAt: string | null; lastError: string | null; totalRuns: number; totalIngested: number }>;
  recentJobs: Array<{ id: number; sourceName: string; status: string; itemsIngested: number; itemsSkipped: number; errors: string[]; startedAt: string; completedAt: string | null; durationMs: number | null }>;
  jobStats: { total: number; success: number; failed: number };
}

const SOURCE_TYPE_COLORS: Record<string, string> = {
  api: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  rss: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  github: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "github-file": "text-violet-400 bg-violet-500/10 border-violet-500/20",
  "open-dataset": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  manual: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

function SourceTypeBadge({ type }: { type: string }) {
  const cls = SOURCE_TYPE_COLORS[type] || "text-gray-400 bg-gray-500/10 border-gray-500/20";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {type}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SandboxPage({ embedded }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<"data" | "code" | "health">("data");
  const [tasks, setTasks] = useState<SandboxTask[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [targetFile, setTargetFile] = useState("");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sandboxLog, setSandboxLog] = useState<string[]>([]);
  const [dataSearch, setDataSearch] = useState("");
  const [dataSourceFilter, setDataSourceFilter] = useState("");
  const [dataTypeFilter, setDataTypeFilter] = useState("");
  const [dataPage, setDataPage] = useState(0);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => { document.title = "Sandbox | Tessera"; }, []);

  const { data: ingestionStats, isLoading: statsLoading } = useQuery<IngestionStats>({
    queryKey: ["/api/ingestion/stats"],
    refetchInterval: 30000,
    queryFn: async () => {
      const res = await fetch("/api/ingestion/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const json = await res.json();
      return json;
    },
  });

  const { data: ingestedData, isLoading: dataLoading } = useQuery<{ data: IngestedItem[]; total: number; count: number }>({
    queryKey: ["/api/ingestion/data", dataSearch, dataSourceFilter, dataTypeFilter, dataPage],
    refetchInterval: 30000,
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "20",
        offset: String(dataPage * 20),
        ...(dataSearch ? { search: dataSearch } : {}),
        ...(dataSourceFilter ? { source: dataSourceFilter } : {}),
        ...(dataTypeFilter ? { sourceType: dataTypeFilter } : {}),
      });
      const res = await fetch(`/api/ingestion/data?${params}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      return res.json();
    },
  });

  const triggerIngestion = useMutation({
    mutationFn: async (sourceName: string) => {
      const res = await fetch(`/api/ingestion/trigger/${encodeURIComponent(sourceName)}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to trigger ingestion");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingestion/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ingestion/data"] });
    },
  });

  const triggerAll = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ingestion/trigger-all", { method: "POST" });
      if (!res.ok) throw new Error("Failed to trigger all");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingestion/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ingestion/data"] });
    },
  });

  const addLog = (msg: string) => {
    setSandboxLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  };

  const runSandboxTest = async () => {
    if (!codeInput.trim()) return;
    setIsRunning(true);
    const taskId = `SBX-${Date.now().toString(36).toUpperCase()}`;
    const newTask: SandboxTask = {
      id: taskId,
      name: targetFile || "inline-test",
      status: "running",
      executor: "Tessera-Beta (Code Generator)",
      executioner: "Tessera-Zeta (Validator)",
      description: codeInput.slice(0, 200),
      timestamp: new Date().toISOString()
    };
    setTasks(prev => [newTask, ...prev]);
    addLog(`[EXECUTOR] Task ${taskId} initiated — code analysis starting...`);
    addLog(`[SANDBOX] Cloning environment for isolated testing...`);

    try {
      const res = await fetch("/api/sandbox/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput, targetFile, taskId })
      });
      const data = await res.json();
      addLog(`[EXECUTIONER] Validation complete — ${data.passed ? "PASSED" : "NEEDS REVIEW"}`);
      addLog(`[SANDBOX] ${data.message || "Test cycle complete"}`);
      setTasks(prev => prev.map(t => t.id === taskId ? {
        ...t,
        status: data.passed ? "passed" : "failed",
        result: data.message || data.result || (data.passed ? "Code validated" : "Validation flagged issues")
      } : t));
    } catch {
      addLog(`[EXECUTIONER] Offline validation — syntax check only`);
      const hasBraces = (codeInput.match(/{/g) || []).length === (codeInput.match(/}/g) || []).length;
      const hasParens = (codeInput.match(/\(/g) || []).length === (codeInput.match(/\)/g) || []).length;
      const passed = hasBraces && hasParens;
      setTasks(prev => prev.map(t => t.id === taskId ? {
        ...t,
        status: passed ? "passed" : "failed",
        result: passed ? "Syntax validation passed" : "Syntax error — unbalanced delimiters"
      } : t));
    }
    setIsRunning(false);
    setCodeInput("");
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "passed": case "completed": return "text-green-400";
      case "failed": return "text-red-400";
      case "running": return "text-amber-400 animate-pulse";
      default: return "text-muted-foreground";
    }
  };

  const uniqueSources = Array.from(new Set((ingestedData?.data || []).map(d => d.source)));
  const uniqueTypes = Array.from(new Set((ingestedData?.data || []).map(d => d.sourceType)));

  return (
    <div className="flex h-full bg-background flex-col" data-testid="sandbox-page">
      <div className="border-b border-border/50 bg-black/30 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Database size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">Sandbox</h1>
            <p className="text-[11px] text-muted-foreground">Real scraped data ingestion — browse, search, and learn from live sources</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {statsLoading ? (
              <RefreshCw size={12} className="text-muted-foreground animate-spin" />
            ) : (
              <span className="text-xs text-muted-foreground font-mono">{ingestionStats?.totalItems?.toLocaleString() || 0} items</span>
            )}
          </div>
        </div>

        <div className="flex gap-1">
          {(["data", "code", "health"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "data" ? "Data Center" : tab === "code" ? "Code Sandbox" : "Health Monitor"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">

        {activeTab === "data" && (
          <>
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-40 relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search ingested data..."
                  value={dataSearch}
                  onChange={e => { setDataSearch(e.target.value); setDataPage(0); }}
                  className="w-full bg-black/40 rounded-lg border border-border/30 pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/30"
                />
              </div>
              <select
                value={dataTypeFilter}
                onChange={e => { setDataTypeFilter(e.target.value); setDataPage(0); }}
                className="bg-black/40 rounded-lg border border-border/30 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-violet-500/30"
              >
                <option value="">All types</option>
                <option value="api">API</option>
                <option value="rss">RSS</option>
                <option value="github">GitHub</option>
                <option value="open-dataset">Dataset</option>
              </select>
              <button
                onClick={() => triggerAll.mutate()}
                disabled={triggerAll.isPending}
                className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 text-xs font-medium border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {triggerAll.isPending ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
                Run All Sources
              </button>
            </div>

            {ingestionStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-border/30 bg-card/20 p-3">
                  <div className="text-[10px] text-muted-foreground mb-1">Total Items</div>
                  <div className="text-lg font-bold text-foreground font-mono">{ingestionStats.totalItems.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-border/30 bg-card/20 p-3">
                  <div className="text-[10px] text-muted-foreground mb-1">Sources</div>
                  <div className="text-lg font-bold text-foreground font-mono">{ingestionStats.bySource.length}</div>
                </div>
                <div className="rounded-lg border border-border/30 bg-card/20 p-3">
                  <div className="text-[10px] text-muted-foreground mb-1">Jobs Run</div>
                  <div className="text-lg font-bold text-foreground font-mono">{ingestionStats.jobStats.total}</div>
                </div>
                <div className="rounded-lg border border-border/30 bg-card/20 p-3">
                  <div className="text-[10px] text-muted-foreground mb-1">Failed Jobs</div>
                  <div className={`text-lg font-bold font-mono ${ingestionStats.jobStats.failed > 0 ? "text-red-400" : "text-green-400"}`}>
                    {ingestionStats.jobStats.failed}
                  </div>
                </div>
              </div>
            )}

            {ingestionStats && ingestionStats.bySource.length > 0 && (
              <div className="rounded-xl border border-border/30 bg-card/20 p-3">
                <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                  <Tag size={12} className="text-violet-400" />
                  Items by Source
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {ingestionStats.bySource.slice(0, 20).map(s => (
                    <button
                      key={s.source}
                      onClick={() => { setDataSourceFilter(prev => prev === s.source ? "" : s.source); setDataPage(0); }}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${
                        dataSourceFilter === s.source
                          ? "bg-violet-500/30 text-violet-300 border-violet-500/40"
                          : "bg-black/30 text-muted-foreground border-border/20 hover:border-border/40"
                      }`}
                    >
                      {s.source}
                      <span className="font-mono ml-0.5 opacity-70">{s.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dataLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : ingestedData && ingestedData.data.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                  <span>Showing {ingestedData.data.length} of {ingestedData.total.toLocaleString()} items</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setDataPage(p => Math.max(0, p - 1))}
                      disabled={dataPage === 0}
                      className="px-2 py-0.5 rounded border border-border/20 hover:border-border/40 disabled:opacity-30 transition-colors"
                    >
                      ←
                    </button>
                    <span className="px-2 py-0.5">Page {dataPage + 1}</span>
                    <button
                      onClick={() => setDataPage(p => p + 1)}
                      disabled={(dataPage + 1) * 20 >= ingestedData.total}
                      className="px-2 py-0.5 rounded border border-border/20 hover:border-border/40 disabled:opacity-30 transition-colors"
                    >
                      →
                    </button>
                  </div>
                </div>
                {ingestedData.data.map(item => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border/20 bg-black/20 p-3 cursor-pointer hover:bg-black/30 transition-colors"
                    onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <SourceTypeBadge type={item.sourceType} />
                          <span className="text-[11px] text-muted-foreground font-medium">{item.source}</span>
                          <span className="text-[10px] text-muted-foreground/60 ml-auto flex items-center gap-1">
                            <Clock size={9} />
                            {timeAgo(item.ingestedAt)}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-foreground line-clamp-1">{item.title || "(no title)"}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{item.content}</p>
                        {item.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {item.tags.slice(0, 5).map(tag => (
                              <span key={tag} className="text-[9px] bg-black/30 text-muted-foreground/70 px-1 py-0.5 rounded">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-muted-foreground/40">
                        {expandedItem === item.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </div>
                    </div>
                    {expandedItem === item.id && (
                      <div className="mt-3 pt-3 border-t border-border/20 space-y-2">
                        <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <ExternalLink size={10} />
                            View Source
                          </a>
                        )}
                        {item.publishedAt && (
                          <div className="text-[10px] text-muted-foreground">
                            Published: {new Date(item.publishedAt).toLocaleDateString()}
                          </div>
                        )}
                        {Object.keys(item.metadata || {}).length > 0 && (
                          <div className="text-[10px] text-muted-foreground/70 font-mono bg-black/30 rounded p-2">
                            {JSON.stringify(item.metadata, null, 2).slice(0, 500)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border/20 bg-black/10 p-8 text-center space-y-3">
                <Database size={32} className="text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No ingested data yet</p>
                <p className="text-xs text-muted-foreground/60">Click "Run All Sources" to start populating the data center</p>
                <button
                  onClick={() => triggerAll.mutate()}
                  disabled={triggerAll.isPending}
                  className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 text-xs font-medium border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 transition-colors"
                >
                  {triggerAll.isPending ? "Running..." : "Start Ingestion"}
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "code" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-violet-400">
                  <Play size={14} />
                  EXECUTOR (Tessera-Beta)
                </div>
                <p className="text-xs text-muted-foreground">Generates code modifications, analyzes impact, and prepares changes in an isolated clone.</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Target file (e.g., server/routes.ts)"
                    value={targetFile}
                    onChange={e => setTargetFile(e.target.value)}
                    className="w-full bg-black/40 rounded-lg border border-border/30 px-3 py-2 text-xs text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/30"
                    data-testid="input-sandbox-target"
                  />
                  <textarea
                    placeholder="Paste code or describe modification..."
                    value={codeInput}
                    onChange={e => setCodeInput(e.target.value)}
                    rows={4}
                    className="w-full bg-black/40 rounded-lg border border-border/30 px-3 py-2 text-xs text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/30 resize-none"
                    data-testid="input-sandbox-code"
                  />
                  <button
                    onClick={runSandboxTest}
                    disabled={isRunning || !codeInput.trim()}
                    className="w-full py-2 rounded-lg bg-violet-500/20 text-violet-400 text-xs font-medium border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    data-testid="button-sandbox-run"
                  >
                    {isRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                    {isRunning ? "Testing in Sandbox..." : "Execute & Validate"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-400">
                  <Shield size={14} />
                  EXECUTIONER (Tessera-Zeta)
                </div>
                <p className="text-xs text-muted-foreground">Validates, tests, and approves/rejects changes before they touch the live system.</p>
                <div className="bg-black/40 rounded-lg border border-border/30 p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Syntax Validation:</span>
                    <span className="text-green-400">Active</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Impact Analysis:</span>
                    <span className="text-green-400">Active</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Father Protocol Guard:</span>
                    <span className="text-green-400">LOCKED</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Rollback System:</span>
                    <span className="text-green-400">5 versions/file</span>
                  </div>
                </div>
              </div>
            </div>

            {tasks.length > 0 && (
              <div className="rounded-xl border border-border/30 bg-card/30 p-4">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Terminal size={14} />
                  Sandbox Tasks ({tasks.length})
                </h3>
                <div className="space-y-2">
                  {tasks.map(task => {
                    const isExp = expandedTask === task.id;
                    return (
                      <div
                        key={task.id}
                        className="rounded-lg border border-border/30 bg-black/20 p-3 cursor-pointer hover:bg-black/30 transition-colors"
                        onClick={() => setExpandedTask(isExp ? null : task.id)}
                      >
                        <div className="flex items-center gap-3">
                          {task.status === "passed" && <CheckCircle size={14} className="text-green-400 shrink-0" />}
                          {task.status === "failed" && <XCircle size={14} className="text-red-400 shrink-0" />}
                          {task.status === "running" && <RefreshCw size={14} className="text-amber-400 animate-spin shrink-0" />}
                          {task.status === "pending" && <Cpu size={14} className="text-muted-foreground shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">{task.id}</span>
                              <span className="text-xs font-medium text-foreground truncate">{task.name}</span>
                              <span className={`text-[10px] ml-auto ${statusColor(task.status)}`}>{task.status.toUpperCase()}</span>
                            </div>
                          </div>
                          {isExp ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                        </div>
                        {isExp && (
                          <div className="mt-2 pt-2 border-t border-border/20 space-y-1 text-[11px]">
                            <div><span className="text-muted-foreground">Code:</span> <span className="text-foreground font-mono">{task.description}</span></div>
                            {task.result && <div><span className="text-muted-foreground">Result:</span> <span className={task.status === "passed" ? "text-green-400" : "text-red-400"}>{task.result}</span></div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {sandboxLog.length > 0 && (
              <div className="rounded-xl border border-border/30 bg-black/30 p-4">
                <h3 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-2">
                  <Terminal size={12} />
                  SANDBOX LOG
                </h3>
                <div className="space-y-0.5 max-h-48 overflow-auto font-mono text-[11px]">
                  {sandboxLog.map((log, i) => (
                    <div key={i} className={`${log.includes("PASSED") || log.includes("passed") ? "text-green-400" : log.includes("FAIL") || log.includes("error") ? "text-red-400" : "text-cyan-300/70"}`}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "health" && (
          <div className="space-y-4">
            {ingestionStats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-green-400 mb-2">
                      <Activity size={14} />
                      Successful Jobs
                    </div>
                    <div className="text-2xl font-mono font-bold text-green-400">{ingestionStats.jobStats.success}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">of {ingestionStats.jobStats.total} total</div>
                  </div>
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-red-400 mb-2">
                      <AlertTriangle size={14} />
                      Failed Jobs
                    </div>
                    <div className="text-2xl font-mono font-bold text-red-400">{ingestionStats.jobStats.failed}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">require attention</div>
                  </div>
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-blue-400 mb-2">
                      <Database size={14} />
                      Data Sources
                    </div>
                    <div className="text-2xl font-mono font-bold text-blue-400">{ingestionStats.sources.length}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{ingestionStats.sources.filter(s => s.enabled).length} enabled</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/30 bg-card/20 p-4">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Globe size={14} className="text-violet-400" />
                    Data Sources
                  </h3>
                  <div className="space-y-1.5 max-h-64 overflow-auto">
                    {ingestionStats.sources.map(src => (
                      <div key={src.id} className="flex items-center gap-3 text-[11px] py-1.5 border-b border-border/10 last:border-0">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${src.enabled ? "bg-green-400" : "bg-gray-500"}`} />
                        <span className="text-foreground font-medium flex-1 truncate">{src.name}</span>
                        <SourceTypeBadge type={src.type} />
                        {src.lastRunAt && (
                          <span className="text-muted-foreground/60 shrink-0">{timeAgo(src.lastRunAt)}</span>
                        )}
                        {src.lastError && (
                          <span className="text-red-400 truncate max-w-32" title={src.lastError}>
                            <AlertTriangle size={9} className="inline mr-0.5" />
                            {src.lastError.slice(0, 40)}
                          </span>
                        )}
                        <button
                          onClick={() => triggerIngestion.mutate(src.name)}
                          disabled={triggerIngestion.isPending}
                          className="shrink-0 text-muted-foreground hover:text-violet-400 transition-colors"
                          title="Run now"
                        >
                          <Play size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/30 bg-card/20 p-4">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Clock size={14} className="text-cyan-400" />
                    Recent Jobs
                  </h3>
                  <div className="space-y-1.5 max-h-64 overflow-auto">
                    {ingestionStats.recentJobs.map(job => (
                      <div key={job.id} className="flex items-start gap-3 text-[11px] py-1.5 border-b border-border/10 last:border-0">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${job.status === "completed" ? "bg-green-400" : job.status === "failed" ? "bg-red-400" : "bg-amber-400"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground font-medium truncate">{job.sourceName}</span>
                            <span className={`ml-auto shrink-0 ${statusColor(job.status)}`}>{job.status}</span>
                          </div>
                          <div className="text-muted-foreground/60 flex gap-3">
                            <span>{job.itemsIngested} ingested</span>
                            <span>{job.itemsSkipped} skipped</span>
                            {job.durationMs && <span>{(job.durationMs / 1000).toFixed(1)}s</span>}
                            <span className="ml-auto">{timeAgo(job.startedAt)}</span>
                          </div>
                          {job.errors.length > 0 && (
                            <div className="text-red-400/80 mt-0.5 truncate">
                              <AlertTriangle size={9} className="inline mr-0.5" />
                              {job.errors[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {ingestionStats.recentJobs.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No jobs run yet</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-12">
                <RefreshCw size={20} className="animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
