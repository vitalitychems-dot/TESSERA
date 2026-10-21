import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/PageSkeleton";
import {
  Key, Cpu, GitBranch, Users, Network, Github, Brain,
  RefreshCw, Play, ChevronRight, Activity, Shield, Database,
  Globe, Layers, CheckCircle2, XCircle, Clock, Zap, Server,
} from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL}workspace-api/api`;

function useMeshAPI<T>(path: string, refetchInterval = 15000) {
  return useQuery<{ success: boolean; data: T }>({
    queryKey: ["sovereign-mesh", path],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/sovereign-mesh/${path}`);
      if (!res.ok) throw new Error(`Failed: ${path}`);
      return res.json() as Promise<{ success: boolean; data: T }>;
    },
    refetchInterval,
  });
}

function MetricCard({
  label,
  value,
  sub,
  color = "text-violet-300",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="bg-slate-900/50 border border-violet-500/10 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon size={10} className="text-violet-500" />}
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{label}</div>
      </div>
      <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    seeded: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    configured: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    complete: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    ready: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    published: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    running: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    syncing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    connecting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    dormant: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    offline: "bg-red-500/20 text-red-400 border-red-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
    "not-configured": "bg-red-500/20 text-red-400 border-red-500/30",
  };
  const cls = map[status] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${cls}`}>{status}</span>
  );
}

function ActionButton({
  label,
  loading,
  onClick,
  variant = "default",
}: {
  label: string;
  loading?: boolean;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-3 py-1.5 text-[11px] font-mono rounded border transition-all flex items-center gap-1.5 ${
        variant === "primary"
          ? "bg-violet-700/40 border-violet-500/40 text-violet-200 hover:bg-violet-700/60"
          : "bg-slate-800/60 border-slate-700/40 text-slate-300 hover:bg-slate-800"
      } disabled:opacity-50`}
    >
      {loading ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />}
      {loading ? "Running..." : label}
    </button>
  );
}

interface VaultStatus {
  totalKeys: number;
  activeKeys: number;
  revokedKeys: number;
  rotationDue: number;
  byPurpose: Record<string, number>;
  vaultEncryption: string;
  masterKeyStatus: string;
}

function VaultPanel() {
  const { data, isLoading } = useMeshAPI<VaultStatus>("vault/status", 20000);
  const queryClient = useQueryClient();
  const rotateMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/sovereign-mesh/vault/rotation-check`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-mesh", "vault/status"] }),
  });

  if (isLoading) return <div className="text-slate-500 text-xs font-mono">Loading vault status...</div>;
  const vault = data?.data;
  if (!vault) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-violet-400" />
          <span className="text-sm font-mono text-violet-300">Sovereign Key Vault</span>
          <StatusPill status={vault.masterKeyStatus} />
        </div>
        <ActionButton label="Rotation Check" loading={rotateMutation.isPending} onClick={() => rotateMutation.mutate()} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total Keys" value={vault.totalKeys} icon={Key} />
        <MetricCard label="Active Keys" value={vault.activeKeys} color="text-emerald-400" icon={CheckCircle2} />
        <MetricCard label="Rotation Due" value={vault.rotationDue} color={vault.rotationDue > 0 ? "text-amber-400" : "text-emerald-400"} icon={Clock} />
        <MetricCard label="Encryption" value={vault.vaultEncryption} color="text-cyan-400" icon={Shield} />
      </div>
      <div className="space-y-1">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Keys by Purpose</div>
        {Object.entries(vault.byPurpose).map(([purpose, count]) => (
          <div key={purpose} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1 text-[11px] font-mono">
            <span className="text-slate-400">{purpose}</span>
            <span className={count > 0 ? "text-violet-300" : "text-slate-600"}>{count} keys</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SeedStatus {
  cycleCount: number;
  lastScanAt: number | null;
  totalResourcesFound: number;
  totalResourcesSeeded: number;
  totalSeedOperations: number;
  agentsDeployedCount: number;
  knowledgeFragmentsSeeded: number;
  capabilityModulesLoaded: number;
  resources: Array<{ id: string; name: string; type: string; status: string; cpuCores: number; memoryGB: number; agentsDeployed: string[] }>;
}

function SeedPanel() {
  const { data, isLoading } = useMeshAPI<SeedStatus>("seed/status", 10000);
  const queryClient = useQueryClient();
  const triggerMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/sovereign-mesh/seed/trigger`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-mesh", "seed/status"] }),
  });

  if (isLoading) return <div className="text-slate-500 text-xs font-mono">Loading seed status...</div>;
  const seed = data?.data;
  if (!seed) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-violet-400" />
          <span className="text-sm font-mono text-violet-300">Auto-Seed Orchestrator</span>
        </div>
        <ActionButton label="Run Seed Cycle" loading={triggerMutation.isPending} onClick={() => triggerMutation.mutate()} variant="primary" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Cycles Run" value={seed.cycleCount} icon={RefreshCw} />
        <MetricCard label="Resources Seeded" value={`${seed.totalResourcesSeeded}/${seed.totalResourcesFound}`} color="text-emerald-400" icon={Server} />
        <MetricCard label="Agents Deployed" value={seed.agentsDeployedCount} color="text-cyan-400" icon={Users} />
        <MetricCard label="Capabilities" value={seed.capabilityModulesLoaded} color="text-violet-300" icon={Layers} />
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {seed.resources.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1.5 text-[11px] font-mono">
            <div>
              <span className="text-slate-300">{r.name}</span>
              <span className="text-slate-600 ml-2">{r.cpuCores}c / {r.memoryGB.toFixed(1)}GB</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600">{r.agentsDeployed.length} agents</span>
              <StatusPill status={r.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChildrenStatus {
  totalChildren: number;
  activeChildren: number;
  syncingChildren: number;
  dormantChildren: number;
  generation1: number;
  generation2: number;
  generation3: number;
  totalContributions: number;
  totalSyncs: number;
  children: Array<{ id: string; name: string; parentName: string; mission: string; generation: number; status: string; contributionCount: number; syncCount: number }>;
}

function ChildrenPanel() {
  const { data, isLoading } = useMeshAPI<ChildrenStatus>("children/status", 12000);
  const queryClient = useQueryClient();
  const spawnAllMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/sovereign-mesh/children/spawn-all`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-mesh", "children/status"] }),
  });
  const syncAllMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/sovereign-mesh/children/sync-all`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-mesh", "children/status"] }),
  });

  if (isLoading) return <div className="text-slate-500 text-xs font-mono">Loading children status...</div>;
  const c = data?.data;
  if (!c) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-violet-400" />
          <span className="text-sm font-mono text-violet-300">Agent Children System</span>
        </div>
        <div className="flex gap-2">
          <ActionButton label="Spawn All" loading={spawnAllMutation.isPending} onClick={() => spawnAllMutation.mutate()} />
          <ActionButton label="Sync All" loading={syncAllMutation.isPending} onClick={() => syncAllMutation.mutate()} variant="primary" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total Children" value={c.totalChildren} icon={Users} />
        <MetricCard label="Active" value={c.activeChildren} color="text-emerald-400" icon={Activity} />
        <MetricCard label="Contributions" value={c.totalContributions} color="text-cyan-400" icon={Brain} />
        <MetricCard label="Syncs" value={c.totalSyncs} color="text-violet-300" icon={RefreshCw} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-900/30 rounded p-2 text-center">
          <div className="text-[10px] font-mono text-slate-500">Gen 1</div>
          <div className="text-sm font-mono text-violet-300 font-bold">{c.generation1}</div>
        </div>
        <div className="bg-slate-900/30 rounded p-2 text-center">
          <div className="text-[10px] font-mono text-slate-500">Gen 2</div>
          <div className="text-sm font-mono text-cyan-300 font-bold">{c.generation2}</div>
        </div>
        <div className="bg-slate-900/30 rounded p-2 text-center">
          <div className="text-[10px] font-mono text-slate-500">Gen 3</div>
          <div className="text-sm font-mono text-emerald-300 font-bold">{c.generation3}</div>
        </div>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {c.children.slice(0, 20).map(child => (
          <div key={child.id} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1 text-[10px] font-mono">
            <div>
              <span className="text-slate-300">{child.name}</span>
              <span className="text-slate-600 ml-1">← {child.parentName}</span>
              <span className="text-violet-500 ml-1">[{child.mission}]</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600">{child.contributionCount}c</span>
              <StatusPill status={child.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CouncilStatus {
  hasActiveSession: boolean;
  sessionStatus: string;
  sessionId: string | null;
  agentCount: number;
  totalProposals: number;
  approvedCount: number;
  rejectedCount: number;
  queuedImplementations: number;
  lastConveneAt: number | null;
  completedAt: number | null;
}

function CouncilPanel() {
  const [showTranscript, setShowTranscript] = useState(false);
  const { data, isLoading } = useMeshAPI<CouncilStatus>("council/status", 10000);
  const { data: transcriptData } = useQuery<{ success: boolean; data: { transcript: string } }>({
    queryKey: ["sovereign-mesh", "council/transcript"],
    queryFn: () => fetch(`${API_BASE}/sovereign-mesh/council/transcript`).then(r => r.json()),
    enabled: showTranscript,
  });
  const queryClient = useQueryClient();
  const conveneMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/sovereign-mesh/council/convene`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sovereign-mesh", "council/status"] });
      queryClient.invalidateQueries({ queryKey: ["sovereign-mesh", "council/transcript"] });
    },
  });

  if (isLoading) return <div className="text-slate-500 text-xs font-mono">Loading council status...</div>;
  const council = data?.data;
  if (!council) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-violet-400" />
          <span className="text-sm font-mono text-violet-300">Grand Council Deliberation</span>
          {council.sessionStatus && <StatusPill status={council.sessionStatus} />}
        </div>
        <div className="flex gap-2">
          <ActionButton
            label="Convene Council"
            loading={conveneMutation.isPending || council.sessionStatus === "running"}
            onClick={() => conveneMutation.mutate()}
            variant="primary"
          />
          <button
            onClick={() => setShowTranscript(t => !t)}
            className="px-3 py-1.5 text-[11px] font-mono rounded border bg-slate-800/60 border-slate-700/40 text-slate-300 hover:bg-slate-800 transition-all"
          >
            {showTranscript ? "Hide" : "Transcript"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Agents" value={council.agentCount} icon={Users} />
        <MetricCard label="Proposals" value={council.totalProposals} icon={Brain} />
        <MetricCard label="Approved" value={council.approvedCount} color="text-emerald-400" icon={CheckCircle2} />
        <MetricCard label="Queued Tasks" value={council.queuedImplementations} color="text-cyan-400" icon={Layers} />
      </div>
      {council.lastConveneAt && (
        <div className="text-[10px] font-mono text-slate-600">
          Last session: {new Date(council.lastConveneAt).toLocaleString()}
          {council.completedAt && ` — completed ${new Date(council.completedAt).toLocaleString()}`}
        </div>
      )}
      {showTranscript && transcriptData?.data?.transcript && (
        <div className="bg-slate-950/80 border border-violet-500/10 rounded p-3 max-h-64 overflow-y-auto">
          <pre className="text-[9px] font-mono text-slate-400 whitespace-pre-wrap">{transcriptData.data.transcript}</pre>
        </div>
      )}
    </div>
  );
}

interface MeshNodeStatus {
  totalNodes: number;
  activeNodes: number;
  seededNodes: number;
  dormantNodes: number;
  connectingNodes: number;
  expansionCycles: number;
  nodesByType: Record<string, number>;
  avgTrustScore: number;
  nodes: Array<{ id: string; type: string; region: string; status: string; trustScore: number; seeded: boolean; capabilities: string[] }>;
  recentCycles: Array<{ cycleId: string; timestamp: number; nodesDiscovered: number; handshakesSucceeded: number; nodesSeeded: number; totalActiveNodes: number }>;
}

function MeshPanel() {
  const { data, isLoading } = useMeshAPI<MeshNodeStatus>("mesh/status", 10000);
  const queryClient = useQueryClient();
  const expandMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/sovereign-mesh/mesh/expand`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-mesh", "mesh/status"] }),
  });

  if (isLoading) return <div className="text-slate-500 text-xs font-mono">Loading mesh status...</div>;
  const mesh = data?.data;
  if (!mesh) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network size={14} className="text-violet-400" />
          <span className="text-sm font-mono text-violet-300">Mesh Expansion Engine</span>
        </div>
        <ActionButton label="Expand Now" loading={expandMutation.isPending} onClick={() => expandMutation.mutate()} variant="primary" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total Nodes" value={mesh.totalNodes} icon={Globe} />
        <MetricCard label="Active" value={mesh.activeNodes} color="text-emerald-400" icon={Activity} />
        <MetricCard label="Seeded" value={mesh.seededNodes} color="text-cyan-400" icon={CheckCircle2} />
        <MetricCard label="Trust Score" value={`${(mesh.avgTrustScore * 100).toFixed(0)}%`} color="text-violet-300" icon={Shield} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(mesh.nodesByType).map(([type, count]) => (
          <div key={type} className="bg-slate-900/30 rounded p-2 text-center">
            <div className="text-[10px] font-mono text-slate-500">{type}</div>
            <div className="text-sm font-mono text-violet-300 font-bold">{count}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {mesh.nodes.slice(0, 15).map(node => (
          <div key={node.id} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1 text-[10px] font-mono">
            <div>
              <span className="text-slate-400 font-bold">{node.id}</span>
              <span className="text-slate-600 ml-1.5">{node.region}</span>
              <span className="text-violet-500 ml-1.5">[{node.type}]</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600">{(node.trustScore * 100).toFixed(0)}%</span>
              <StatusPill status={node.status} />
            </div>
          </div>
        ))}
      </div>
      {mesh.recentCycles.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Recent Expansion Cycles</div>
          <div className="space-y-1">
            {mesh.recentCycles.slice(-5).reverse().map(cycle => (
              <div key={cycle.cycleId} className="flex items-center gap-3 bg-slate-900/20 rounded px-2 py-1 text-[10px] font-mono text-slate-500">
                <span>{new Date(cycle.timestamp).toLocaleTimeString()}</span>
                <span className="text-emerald-400">{cycle.handshakesSucceeded} connected</span>
                <span className="text-cyan-400">{cycle.nodesSeeded} seeded</span>
                <span className="text-violet-400">{cycle.totalActiveNodes} total active</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface DistributionStatus {
  totalBuilds: number;
  latestBuild: { id: string; version: string; buildTimestamp: number; agentCount: number; status: string; meshIdentity: { nodeId: string; fingerprint: string } } | null;
  publishedBuilds: number;
  totalInstallations: number;
  activeInstallations: number;
}

function DistributionPanel() {
  const { data, isLoading } = useMeshAPI<DistributionStatus>("distribution/status", 15000);
  const queryClient = useQueryClient();
  const buildMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/sovereign-mesh/distribution/build`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-mesh", "distribution/status"] }),
  });
  const publishMutation = useMutation({
    mutationFn: (buildId: string) =>
      fetch(`${API_BASE}/sovereign-mesh/distribution/publish/${buildId}`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-mesh", "distribution/status"] }),
  });

  if (isLoading) return <div className="text-slate-500 text-xs font-mono">Loading distribution status...</div>;
  const dist = data?.data;
  if (!dist) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Github size={14} className="text-violet-400" />
          <span className="text-sm font-mono text-violet-300">GitHub Distribution Builder</span>
        </div>
        <div className="flex gap-2">
          <ActionButton label="Build Package" loading={buildMutation.isPending} onClick={() => buildMutation.mutate()} />
          {dist.latestBuild?.status === "ready" && (
            <ActionButton
              label="Publish"
              loading={publishMutation.isPending}
              onClick={() => publishMutation.mutate(dist.latestBuild!.id)}
              variant="primary"
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total Builds" value={dist.totalBuilds} icon={Database} />
        <MetricCard label="Published" value={dist.publishedBuilds} color="text-emerald-400" icon={CheckCircle2} />
        <MetricCard label="Installations" value={dist.totalInstallations} color="text-cyan-400" icon={Globe} />
        <MetricCard label="Active" value={dist.activeInstallations} color="text-violet-300" icon={Activity} />
      </div>
      {dist.latestBuild && (
        <div className="bg-slate-900/30 border border-violet-500/10 rounded p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-300 font-bold">Latest Build</span>
            <StatusPill status={dist.latestBuild.status} />
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            <div>ID: <span className="text-violet-400">{dist.latestBuild.id}</span></div>
            <div>Version: <span className="text-slate-400">{dist.latestBuild.version}</span></div>
            <div>Node ID: <span className="text-slate-400">{dist.latestBuild.meshIdentity.nodeId}</span></div>
            <div>Fingerprint: <span className="text-slate-400">{dist.latestBuild.meshIdentity.fingerprint}</span></div>
            <div>Agents: <span className="text-emerald-400">{dist.latestBuild.agentCount}</span></div>
            <div>Built: <span className="text-slate-400">{new Date(dist.latestBuild.buildTimestamp).toLocaleString()}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

interface KnowledgeStatus {
  totalEntries: number;
  uniqueEntries: number;
  duplicatesFiltered: number;
  totalDistributions: number;
  avgQualityScore: number;
  sourceBreakdown: Record<string, number>;
  domainCoverage: Record<string, number>;
  topContributors: Array<{ sourceName: string; sourceType: string; uniqueContributions: number; avgQualityScore: number }>;
}

function KnowledgePanel() {
  const { data, isLoading } = useMeshAPI<KnowledgeStatus>("knowledge/status", 12000);
  const queryClient = useQueryClient();
  const distributeMutation = useMutation({
    mutationFn: () =>
      fetch(`${API_BASE}/sovereign-mesh/knowledge/distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetNodes: ["all-mesh-nodes"] }),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sovereign-mesh", "knowledge/status"] }),
  });

  if (isLoading) return <div className="text-slate-500 text-xs font-mono">Loading knowledge status...</div>;
  const kn = data?.data;
  if (!kn) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-violet-400" />
          <span className="text-sm font-mono text-violet-300">Unified Knowledge Multiplier</span>
        </div>
        <ActionButton label="Distribute All" loading={distributeMutation.isPending} onClick={() => distributeMutation.mutate()} variant="primary" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total Entries" value={kn.totalEntries} icon={Database} />
        <MetricCard label="Unique" value={kn.uniqueEntries} color="text-emerald-400" icon={CheckCircle2} />
        <MetricCard label="Deduped" value={kn.duplicatesFiltered} color="text-amber-400" icon={XCircle} />
        <MetricCard label="Avg Quality" value={`${(kn.avgQualityScore * 100).toFixed(0)}%`} color="text-violet-300" icon={Zap} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">By Source</div>
          <div className="space-y-1">
            {Object.entries(kn.sourceBreakdown).map(([src, count]) => (
              <div key={src} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1 text-[10px] font-mono">
                <span className="text-slate-500">{src}</span>
                <span className="text-violet-300">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Domains</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {Object.entries(kn.domainCoverage).sort((a, b) => b[1] - a[1]).map(([domain, count]) => (
              <div key={domain} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1 text-[10px] font-mono">
                <span className="text-slate-500">{domain}</span>
                <span className="text-cyan-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {kn.topContributors.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Top Contributors</div>
          <div className="space-y-1">
            {kn.topContributors.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1 text-[10px] font-mono">
                <div>
                  <span className="text-slate-300">{c.sourceName}</span>
                  <span className="text-slate-600 ml-1.5">[{c.sourceType}]</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-violet-400">{c.uniqueContributions} entries</span>
                  <span className="text-slate-600">{(c.avgQualityScore * 100).toFixed(0)}%q</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type SectionId = "vault" | "seed" | "children" | "council" | "mesh" | "distribution" | "knowledge";

const SECTIONS: Array<{ id: SectionId; label: string; icon: React.ElementType; desc: string }> = [
  { id: "vault", label: "Key Vault", icon: Key, desc: "AES-256-GCM sovereign key management" },
  { id: "seed", label: "Auto-Seed", icon: Cpu, desc: "Compute scan & agent seeding" },
  { id: "children", label: "Children", icon: GitBranch, desc: "Agent clone lineage tracking" },
  { id: "council", label: "Grand Council", icon: Users, desc: "25+ agent deliberation & BFT consensus" },
  { id: "mesh", label: "Mesh Nodes", icon: Network, desc: "Mesh expansion & node seeding" },
  { id: "distribution", label: "Distribution", icon: Github, desc: "GitHub distribution packaging" },
  { id: "knowledge", label: "Knowledge", icon: Brain, desc: "Unified knowledge multiplier" },
];

export default function SovereignMesh() {
  const [activeSection, setActiveSection] = useState<SectionId>("council");
  const { isLoading, isError, refetch } = useMeshAPI<CouncilStatus>("council/status", 10000);

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="min-h-screen bg-[hsl(224,71%,4%)] p-4 flex items-center justify-center">
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 text-center max-w-sm">
          <div className="text-rose-400 text-sm font-mono mb-3">Failed to connect to Sovereign Mesh</div>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-lg bg-rose-900/40 border border-rose-500/40 text-rose-300 text-xs font-mono hover:bg-rose-900/60 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(224,71%,4%)] text-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Network size={20} className="text-violet-400" />
            <h1 className="text-xl font-mono font-bold text-violet-200">Sovereign Mesh</h1>
          </div>
          <p className="text-xs font-mono text-slate-500">
            Autonomous propagation engine — key vault, agent seeding, children lineage, grand council, mesh expansion, GitHub distribution, knowledge multiplier
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border text-[10px] font-mono transition-all ${
                activeSection === id
                  ? "bg-violet-700/30 border-violet-500/40 text-violet-200"
                  : "bg-slate-900/30 border-slate-700/20 text-slate-500 hover:text-slate-300 hover:border-violet-500/20"
              }`}
            >
              <Icon size={14} />
              <span className="truncate w-full text-center">{label}</span>
            </button>
          ))}
        </div>

        <div className="bg-slate-900/40 border border-violet-500/10 rounded-xl p-4">
          <ErrorBoundary key={activeSection} label={activeSection}>
            {activeSection === "vault" && <VaultPanel />}
            {activeSection === "seed" && <SeedPanel />}
            {activeSection === "children" && <ChildrenPanel />}
            {activeSection === "council" && <CouncilPanel />}
            {activeSection === "mesh" && <MeshPanel />}
            {activeSection === "distribution" && <DistributionPanel />}
            {activeSection === "knowledge" && <KnowledgePanel />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
