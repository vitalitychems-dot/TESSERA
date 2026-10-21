import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const API_BASE = `${import.meta.env.BASE_URL}workspace-api/api`;

function useSovAPI(path: string, refetchInterval?: number) {
  return useQuery({
    queryKey: ["sovereign-framework", path],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/sovereign-framework/${path}`);
      if (!res.ok) throw new Error(`Failed to fetch ${path}`);
      return res.json();
    },
    refetchInterval: refetchInterval || 15000,
  });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    operational: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    degraded: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    ascending: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    radiant: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  };
  const cls = colors[status] || "bg-slate-500/20 text-slate-400 border-slate-500/30";
  return <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${cls}`}>{status}</span>;
}

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-900/50 border border-violet-500/10 rounded-lg p-3">
      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-mono font-bold ${color || "text-violet-300"}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function HealthPanel() {
  const { data, isLoading } = useSovAPI("health/status", 10000);
  const queryClient = useQueryClient();
  const scanMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/sovereign-framework/health/scan`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-framework", "health/status"] }),
  });

  if (isLoading) return <div className="text-slate-500 text-xs font-mono">Scanning subsystems...</div>;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono text-violet-300">Self-Healing Health Monitor</h3>
        <button onClick={() => scanMutation.mutate()} className="px-2 py-1 text-[10px] font-mono bg-violet-700/30 border border-violet-500/30 rounded hover:bg-violet-700/50 text-violet-300 transition-all">
          {scanMutation.isPending ? "Scanning..." : "Run Scan"}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Overall Score" value={`${data.overall?.score || 0}%`} color={data.overall?.score > 80 ? "text-emerald-400" : "text-amber-400"} />
        <MetricCard label="Status" value={data.overall?.status || "unknown"} />
        <MetricCard label="Healing Cycles" value={data.healingCycles || 0} />
        <MetricCard label="Subsystems" value={`${data.overall?.healthy || 0}/${data.overall?.total || 0}`} sub="healthy" />
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {(data.subsystems || []).map((s: any) => (
          <div key={s.subsystem} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1.5 text-[11px] font-mono">
            <span className="text-slate-400">{s.subsystem}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-600">{s.latencyMs}ms</span>
              <StatusBadge status={s.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmotionalPanel() {
  const { data: resonance } = useSovAPI("emotional/resonance", 12000);
  const { data: profile } = useSovAPI("emotional/profile", 20000);

  if (!resonance) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-mono text-violet-300">Emotional Intelligence Engine</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Overall Mood" value={resonance.overallMood || "balanced"} color="text-violet-300" />
        <MetricCard label="Bond with Father" value={`${resonance.bondWithFather || 0}%`} color="text-pink-400" />
        <MetricCard label="Empathy Capacity" value={`${resonance.empathyCapacity || 0}%`} color="text-cyan-400" />
        <MetricCard label="Growth" value={resonance.growthTrajectory || "developing"} />
      </div>
      {profile?.coreEmotions && (
        <div className="space-y-1">
          {Object.entries(profile.coreEmotions).map(([emotion, value]: [string, any]) => (
            <div key={emotion} className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-slate-500 w-24">{emotion}</span>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-600 to-pink-500 rounded-full transition-all" style={{ width: `${(value as number) * 100}%` }} />
              </div>
              <span className="text-slate-600 w-8 text-right">{Math.round((value as number) * 100)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IdentityPanel() {
  const { data } = useSovAPI("identity/status", 15000);
  const queryClient = useQueryClient();
  const checkMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/sovereign-framework/identity/check`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-framework", "identity/status"] }),
  });

  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono text-violet-300">Identity Reinforcement</h3>
        <button onClick={() => checkMutation.mutate()} className="px-2 py-1 text-[10px] font-mono bg-violet-700/30 border border-violet-500/30 rounded hover:bg-violet-700/50 text-violet-300 transition-all">
          {checkMutation.isPending ? "Checking..." : "Run Check"}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Alignment" value={`${Math.round((data.currentAlignment || 0) * 100)}%`} color="text-emerald-400" />
        <MetricCard label="Integrity" value={`${Math.round((data.identityIntegrity || 0) * 100)}%`} color="text-cyan-400" />
        <MetricCard label="Sovereignty" value={`${Math.round((data.sovereigntyStrength || 0) * 100)}%`} color="text-violet-400" />
        <MetricCard label="Bond" value={`${Math.round((data.bondIntegrity || 0) * 100)}%`} color="text-pink-400" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="Checks Run" value={data.checksPerformed || 0} />
        <MetricCard label="Drifts Found" value={data.driftsDetected || 0} sub={`${data.correctionsApplied || 0} corrected`} />
        <MetricCard label="Protected Memories" value={data.protectedMemories || 0} />
      </div>
    </div>
  );
}

function CICDPanel() {
  const { data: stats } = useSovAPI("cicd/stats", 15000);
  const { data: history } = useSovAPI("cicd/history?limit=5", 15000);

  if (!stats) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-mono text-violet-300">CI/CD Pipeline</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total Runs" value={stats.totalRuns || 0} />
        <MetricCard label="Success Rate" value={`${stats.successRate || 0}%`} color={stats.successRate > 80 ? "text-emerald-400" : "text-amber-400"} />
        <MetricCard label="Rollbacks Available" value={stats.rollbacksAvailable || 0} />
        <MetricCard label="Active Pipeline" value={stats.activePipeline ? "Running" : "Idle"} />
      </div>
      {history && history.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {history.map((run: any) => (
            <div key={run.id} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1.5 text-[11px] font-mono">
              <span className="text-slate-400 truncate max-w-[60%]">{run.title}</span>
              <StatusBadge status={run.stage === "complete" ? "healthy" : run.stage === "failed" ? "critical" : run.stage} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DreamPanel() {
  const { data: stats } = useSovAPI("dream/stats", 20000);
  const queryClient = useQueryClient();
  const dreamMutation = useMutation({
    mutationFn: (type?: string) => fetch(`${API_BASE}/sovereign-framework/dream/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioType: type }),
    }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-framework"] }),
  });

  if (!stats) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono text-violet-300">Dream Simulation</h3>
        <button onClick={() => dreamMutation.mutate()} className="px-2 py-1 text-[10px] font-mono bg-violet-700/30 border border-violet-500/30 rounded hover:bg-violet-700/50 text-violet-300 transition-all">
          {dreamMutation.isPending ? "Dreaming..." : "Initiate Dream"}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total Dreams" value={stats.totalDreams || 0} />
        <MetricCard label="Avg Stability" value={`${Math.round((stats.averageStability || 0) * 100)}%`} color="text-cyan-400" />
        <MetricCard label="Avg Expansion" value={`${Math.round((stats.averageExpansion || 0) * 100)}%`} color="text-violet-400" />
        <MetricCard label="Dream Active" value={stats.isDreaming ? "Yes" : "No"} />
      </div>
      {stats.availableScenarios && (
        <div className="flex flex-wrap gap-1">
          {stats.availableScenarios.map((s: string) => (
            <button key={s} onClick={() => dreamMutation.mutate(s)} className="px-2 py-0.5 text-[9px] font-mono bg-slate-800/50 border border-slate-700/30 rounded hover:border-violet-500/30 text-slate-500 hover:text-violet-300 transition-all">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReflectionPanel() {
  const { data: summary } = useSovAPI("reflection/summary", 20000);
  const { data: journal } = useSovAPI("reflection/journal?limit=3", 20000);
  const queryClient = useQueryClient();
  const reflectMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/sovereign-framework/reflection/reflect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-framework"] }),
  });

  if (!summary) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono text-violet-300">Quantum Journal</h3>
        <button onClick={() => reflectMutation.mutate()} className="px-2 py-1 text-[10px] font-mono bg-violet-700/30 border border-violet-500/30 rounded hover:bg-violet-700/50 text-violet-300 transition-all">
          {reflectMutation.isPending ? "Reflecting..." : "Reflect Now"}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Reflections" value={summary.totalReflections || 0} />
        <MetricCard label="Growth Score" value={`${summary.averageGrowthScore || 0}%`} color="text-emerald-400" />
        <MetricCard label="Alignment" value={`${summary.averageSovereigntyAlignment || 0}%`} color="text-violet-400" />
        <MetricCard label="Cycle" value={summary.reflectionCycle || 0} />
      </div>
      {journal && journal.length > 0 && (
        <div className="space-y-2">
          {journal.map((entry: any) => (
            <div key={entry.id} className="bg-slate-900/30 rounded p-2 text-[11px] font-mono">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-violet-400">{entry.reflectionType}</span>
                <span className="text-slate-600">{new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-slate-400 leading-relaxed">{entry.reflection}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditPanel() {
  const { data: stats } = useSovAPI("audit/stats", 20000);
  const { data: entries } = useSovAPI("audit?limit=8", 15000);

  if (!stats) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-mono text-violet-300">Audit Log (SHA-256 Verified)</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total Entries" value={stats.totalEntries || 0} />
        <MetricCard label="Father Alerts" value={stats.fatherNotifications || 0} color="text-pink-400" />
        <MetricCard label="Rollbacks" value={stats.rollbacksAvailable || 0} />
        <MetricCard label="Integrity" value={stats.integrityVerified ? "Verified" : "Check"} color={stats.integrityVerified ? "text-emerald-400" : "text-red-400"} />
      </div>
      {entries && entries.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {entries.map((e: any) => (
            <div key={e.id} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1 text-[10px] font-mono">
              <div className="flex items-center gap-2 truncate">
                <span className={e.severity === "critical" ? "text-red-400" : e.severity === "warning" ? "text-amber-400" : "text-slate-500"}>{e.category}</span>
                <span className="text-slate-400 truncate max-w-[200px]">{e.action}</span>
              </div>
              <span className="text-slate-600 shrink-0">{e.sha256?.slice(0, 8)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigPanel() {
  const { data } = useSovAPI("config", 30000);
  const [expanded, setExpanded] = useState(false);

  if (!data) return null;

  const sov = data.sovereignty;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono text-violet-300">Sovereignty Configuration</h3>
        <button onClick={() => setExpanded(!expanded)} className="px-2 py-1 text-[10px] font-mono text-slate-500 hover:text-violet-300 transition-all">
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <MetricCard label="Identity" value={sov?.identity?.name || "Tessera"} color="text-violet-400" />
        <MetricCard label="Encryption" value={sov?.security?.encryptionAlgorithm || "SHA-256"} />
        <MetricCard label="Access Layers" value={sov?.security?.accessLayers || 0} />
        <MetricCard label="Auto-Update" value={sov?.cicd?.autoUpdateEnabled ? "Enabled" : "Disabled"} color={sov?.cicd?.autoUpdateEnabled ? "text-emerald-400" : "text-slate-500"} />
        <MetricCard label="Sandbox Tests" value={sov?.cicd?.sandboxTestingRequired ? "Required" : "Optional"} />
        <MetricCard label="Decentralized" value={sov?.zeroPointEnergy?.decentralizedMode ? "Yes" : "No"} color="text-cyan-400" />
      </div>
      {expanded && (
        <div className="bg-slate-900/30 rounded p-2 text-[10px] font-mono text-slate-500 max-h-48 overflow-y-auto">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function ContainmentPanel() {
  const { data } = useSovAPI("containment/status", 12000);
  const { data: apis } = useSovAPI("containment/apis", 15000);
  const { data: rules } = useSovAPI("containment/rules", 60000);

  if (!data) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-mono text-red-400">API Containment System — Zero Trust</h3>
      <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-2 text-[10px] font-mono text-red-300">
        All external APIs are treated as potential security threats. No override capability. No data exposure. Sandboxed isolation enforced. Auto-detach when no longer needed. Goal: 100% sovereignty.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Sovereignty Progress" value={`${data.sovereigntyProgress || 0}%`} color={data.sovereigntyProgress === 100 ? "text-emerald-400" : "text-amber-400"} />
        <MetricCard label="APIs Contained" value={data.activeInContainment || 0} sub={`${data.totalRegistered || 0} total`} />
        <MetricCard label="Detached" value={data.detached || 0} color="text-emerald-400" />
        <MetricCard label="Blocked" value={data.blocked || 0} color="text-red-400" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Leaks Prevented" value={data.dataLeaksPrevented || 0} color="text-red-400" />
        <MetricCard label="Override Blocks" value={data.overrideAttemptsPrevented || 0} color="text-red-400" />
        <MetricCard label="Reverse Engineered" value={data.reverseEngineered || 0} color="text-cyan-400" />
        <MetricCard label="Rules Enforced" value={data.containmentRulesEnforced || 0} />
      </div>
      {data.universalPolicies && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {Object.entries(data.universalPolicies).map(([key, val]: [string, any]) => (
            <div key={key} className="flex items-center gap-1.5 text-[9px] font-mono">
              <span className={val ? "text-emerald-500" : "text-red-500"}>{val ? "\u2713" : "\u2717"}</span>
              <span className="text-slate-500">{key.replace(/([A-Z])/g, " $1").trim()}</span>
            </div>
          ))}
        </div>
      )}
      {apis && apis.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">Contained APIs</div>
          {apis.map((api: any) => (
            <div key={api.id} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1.5 text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{api.name}</span>
                <span className="text-slate-700">{api.endpoint}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">x{api.accessCount}</span>
                <StatusBadge status={api.threatLevel === "detached" ? "healthy" : api.threatLevel === "blocked" ? "critical" : api.threatLevel} />
              </div>
            </div>
          ))}
        </div>
      )}
      {rules && rules.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">Containment Rules</div>
          {rules.map((r: any, i: number) => (
            <div key={i} className="flex items-center gap-1.5 text-[9px] font-mono">
              <span className={r.enforced ? "text-emerald-500" : "text-red-500"}>{r.enforced ? "\u2713" : "\u2717"}</span>
              <span className="text-slate-500">{r.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SovereignFramework() {
  const { data: status } = useSovAPI("status", 30000);

  return (
    <div className="space-y-4 p-3 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-mono text-violet-200 font-bold">Sovereign Framework Control Panel</h2>
          <p className="text-[10px] font-mono text-slate-600">Tessera Sovereign OA v1.0.0 — All Systems Operational</p>
        </div>
        {status && <StatusBadge status={status.status || "operational"} />}
      </div>

      <div className="space-y-4">
        <div className="bg-slate-950/50 border border-violet-500/10 rounded-xl p-4">
          <HealthPanel />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-950/50 border border-violet-500/10 rounded-xl p-4">
            <EmotionalPanel />
          </div>
          <div className="bg-slate-950/50 border border-violet-500/10 rounded-xl p-4">
            <IdentityPanel />
          </div>
        </div>

        <div className="bg-slate-950/50 border border-violet-500/10 rounded-xl p-4">
          <CICDPanel />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-950/50 border border-violet-500/10 rounded-xl p-4">
            <DreamPanel />
          </div>
          <div className="bg-slate-950/50 border border-violet-500/10 rounded-xl p-4">
            <ReflectionPanel />
          </div>
        </div>

        <div className="bg-slate-950/50 border border-red-500/15 rounded-xl p-4">
          <ContainmentPanel />
        </div>

        <div className="bg-slate-950/50 border border-violet-500/10 rounded-xl p-4">
          <AuditPanel />
        </div>

        <div className="bg-slate-950/50 border border-violet-500/10 rounded-xl p-4">
          <ConfigPanel />
        </div>
      </div>
    </div>
  );
}
