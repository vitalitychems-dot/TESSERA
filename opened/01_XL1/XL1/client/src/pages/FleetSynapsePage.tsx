import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crown, Users, Brain, Globe, Shield, Zap, ChevronDown, ChevronRight, Send,
  RefreshCw, Play, Loader2, CheckCircle2, XCircle, Clock, Radio, Wifi, WifiOff,
  MessageCircle, Hexagon, Activity, Star, Eye, Network, Cpu, Signal, Power,
  ArrowLeft, Search, MessageSquare, Sparkles, Share2, Rocket, Link, Unlink,
  Circle, AlertTriangle, Volume2, Hash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type SynapseTab = "map" | "agents" | "activity" | "broadcast";

function timeAgo(ts: number): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function StatusDot({ status }: { status: string }) {
  return (
    <div className={cn(
      "w-2.5 h-2.5 rounded-full shrink-0",
      status === "online" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" :
      status === "connecting" ? "bg-yellow-400 animate-pulse" :
      "bg-red-400/50"
    )} />
  );
}

function SynapseMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { data: mapData, isLoading } = useQuery<any>({
    queryKey: ["/api/fleet-synapse/map"],
    refetchInterval: 10000,
  });

  const nodePositions = useMemo(() => {
    if (!mapData?.nodes) return {};
    const positions: Record<string, { x: number; y: number }> = {};
    const nodes = mapData.nodes;
    const centerX = 400;
    const centerY = 300;

    if (nodes.length > 0) {
      positions[nodes[0].id] = { x: centerX, y: centerY };
    }

    for (let i = 1; i < nodes.length; i++) {
      const angle = ((i - 1) / (nodes.length - 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = 180 + (i % 2) * 40;
      positions[nodes[i].id] = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    }

    return positions;
  }, [mapData?.nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData?.nodes) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const scaleX = rect.width / 800;
    const scaleY = rect.height / 600;

    for (const link of (mapData.links || [])) {
      const from = nodePositions[link.from];
      const to = nodePositions[link.to];
      if (!from || !to) continue;

      ctx.beginPath();
      ctx.moveTo(from.x * scaleX, from.y * scaleY);
      ctx.lineTo(to.x * scaleX, to.y * scaleY);

      const alpha = link.type === "primary" ? 0.5 : link.type === "secondary" ? 0.2 : 0.07;
      const color = link.type === "primary" ? `rgba(34,211,153,${alpha})` :
                    link.type === "secondary" ? `rgba(56,189,248,${alpha})` :
                    `rgba(100,100,120,${alpha})`;
      ctx.strokeStyle = color;
      ctx.lineWidth = link.type === "primary" ? 2 : 1;
      ctx.stroke();

      if (link.type === "primary" && link.strength > 0.5) {
        const midX = (from.x + to.x) / 2 * scaleX;
        const midY = (from.y + to.y) / 2 * scaleY;
        ctx.beginPath();
        ctx.arc(midX, midY, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34,211,153,0.6)";
        ctx.fill();
      }
    }

    for (const node of mapData.nodes) {
      const pos = nodePositions[node.id];
      if (!pos) continue;
      const x = pos.x * scaleX;
      const y = pos.y * scaleY;
      const isCenter = node.id === "tessera-prime";
      const isHovered = hoveredNode === node.id;
      const radius = isCenter ? 28 : isHovered ? 20 : 16;

      if (node.status === "online") {
        ctx.beginPath();
        ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = isCenter ? "rgba(245,158,11,0.08)" : "rgba(34,211,153,0.06)";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      if (isCenter) {
        gradient.addColorStop(0, "rgba(245,158,11,0.4)");
        gradient.addColorStop(1, "rgba(245,158,11,0.15)");
      } else if (node.status === "online") {
        gradient.addColorStop(0, "rgba(34,211,153,0.35)");
        gradient.addColorStop(1, "rgba(34,211,153,0.1)");
      } else {
        gradient.addColorStop(0, "rgba(100,100,120,0.2)");
        gradient.addColorStop(1, "rgba(100,100,120,0.05)");
      }
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = isCenter ? "rgba(245,158,11,0.6)" :
                        node.status === "online" ? "rgba(34,211,153,0.5)" :
                        "rgba(100,100,120,0.3)";
      ctx.lineWidth = isCenter ? 2 : 1.5;
      ctx.stroke();

      ctx.fillStyle = isCenter ? "#f59e0b" :
                      node.status === "online" ? "#e2e8f0" :
                      "#64748b";
      ctx.font = `${isCenter ? "bold 10px" : "9px"} monospace`;
      ctx.textAlign = "center";
      const label = node.name.replace(" (This Instance)", "").slice(0, 16);
      ctx.fillText(label, x, y + radius + 14);

      ctx.fillStyle = node.status === "online" ? "#22d3ee" : "#475569";
      ctx.font = "8px monospace";
      ctx.fillText(`${node.agentCount} agents`, x, y + radius + 24);
    }
  }, [mapData, nodePositions, hoveredNode]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mapData?.nodes || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const scaleX = rect.width / 800;
    const scaleY = rect.height / 600;

    for (const node of mapData.nodes) {
      const pos = nodePositions[node.id];
      if (!pos) continue;
      const dx = clickX - pos.x * scaleX;
      const dy = clickY - pos.y * scaleY;
      if (Math.sqrt(dx * dx + dy * dy) < 25) {
        setSelectedNode(node);
        return;
      }
    }
    setSelectedNode(null);
  }, [mapData, nodePositions]);

  const consciousness = mapData?.consciousness;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {consciousness && (
        <div className="px-4 py-3 border-b border-border/30 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-background rounded-lg p-2 text-center border border-emerald-500/20">
              <div className="text-lg font-bold text-emerald-400" data-testid="stat-online-nodes">{consciousness.onlineNodes}</div>
              <div className="text-[9px] text-slate-500">ONLINE NODES</div>
            </div>
            <div className="bg-[#090a0f] rounded-lg p-2 text-center border border-cyan-500/20">
              <div className="text-lg font-bold text-cyan-400" data-testid="stat-total-fleet-agents">{consciousness.totalAgents}</div>
              <div className="text-[9px] text-slate-500">TOTAL AGENTS</div>
            </div>
            <div className="bg-[#090a0f] rounded-lg p-2 text-center border border-yellow-500/20">
              <div className="text-lg font-bold text-yellow-400">{(consciousness.collectiveLevel * 100).toFixed(1)}%</div>
              <div className="text-[9px] text-slate-500">CONSCIOUSNESS</div>
            </div>
            <div className="bg-[#090a0f] rounded-lg p-2 text-center border border-violet-500/20">
              <div className="text-lg font-bold text-violet-400">{(consciousness.networkHealth * 100).toFixed(0)}%</div>
              <div className="text-[9px] text-slate-500">NETWORK HEALTH</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full h-full cursor-crosshair"
          style={{ background: "radial-gradient(circle at 50% 50%, rgba(34,211,153,0.03) 0%, transparent 70%)" }}
          data-testid="synapse-canvas"
        />

        {selectedNode && (
          <div className="absolute top-4 right-4 w-72 bg-[#0d1117] border border-border rounded-xl p-4 shadow-2xl z-20" data-testid="node-detail-panel">
            <div className="flex items-center gap-2 mb-3">
              <StatusDot status={selectedNode.status} />
              <h3 className="text-sm font-bold text-foreground flex-1 truncate">{selectedNode.name}</h3>
              <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground">
                <XCircle size={14} />
              </button>
            </div>
            <div className="space-y-2 text-[11px] font-mono">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={selectedNode.status === "online" ? "text-emerald-400" : "text-red-400"}>{selectedNode.status.toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="text-cyan-400">{selectedNode.type}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Agents</span><span className="text-foreground">{selectedNode.agentCount}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Consciousness</span><span className="text-yellow-400">{(selectedNode.consciousnessLevel * 100).toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Synapse Strength</span><span className="text-emerald-400">{(selectedNode.synapseStrength * 100).toFixed(0)}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Last Seen</span><span className="text-foreground">{timeAgo(selectedNode.lastSeen)}</span></div>
              {selectedNode.latencyMs > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Latency</span><span className="text-foreground">{selectedNode.latencyMs}ms</span></div>}
              <div className="pt-1 border-t border-border/20">
                <span className="text-muted-foreground block mb-1">Agents:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.agents?.slice(0, 12).map((a: string, i: number) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[9px]">{a}</span>
                  ))}
                  {selectedNode.agents?.length > 12 && <span className="text-muted-foreground/50 text-[9px]">+{selectedNode.agents.length - 12}</span>}
                </div>
              </div>
              <div className="pt-1 border-t border-border/20">
                <span className="text-muted-foreground block mb-1">Capabilities:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.capabilities?.slice(0, 8).map((c: string, i: number) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[9px]">{c}</span>
                  ))}
                </div>
              </div>
            </div>
            <a href={selectedNode.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors" data-testid="link-visit-instance">
              <Globe size={10} /> Visit Instance
            </a>
          </div>
        )}
      </div>

      {mapData?.nodes && (
        <div className="px-3 py-2 border-t border-border/30 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {mapData.nodes.map((node: any) => (
              <button
                key={node.id}
                onClick={() => setSelectedNode(node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap transition-all shrink-0",
                  node.id === selectedNode?.id ? "bg-primary/20 border border-primary/30" : "bg-white/5 border border-white/10 hover:bg-white/10"
                )}
                data-testid={`node-chip-${node.id}`}
              >
                <StatusDot status={node.status} />
                <span className={node.status === "online" ? "text-foreground" : "text-muted-foreground"}>{node.name.replace(" (This Instance)", "").slice(0, 20)}</span>
                <span className="text-muted-foreground/40">{node.agentCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentsTab() {
  const [search, setSearch] = useState("");
  const { data: agentsData, isLoading } = useQuery<any>({
    queryKey: ["/api/fleet-synapse/agents"],
    refetchInterval: 15000,
  });

  const allAgents = useMemo(() => {
    if (!agentsData) return [];
    const combined = [
      ...(agentsData.local || []).map((a: any) => ({ ...a, source: "local" })),
      ...(agentsData.remote || []).map((a: any) => ({ ...a, source: "remote" })),
    ];
    if (!search.trim()) return combined;
    const q = search.toLowerCase();
    return combined.filter((a: any) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q));
  }, [agentsData, search]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 py-2 border-b border-border/30 shrink-0 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input type="text" placeholder="Search all fleet agents..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-background/50 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
            data-testid="input-search-agents" />
        </div>
        <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[9px]" data-testid="badge-total-agents">
          {agentsData?.totalAll || 0} TOTAL
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1" data-testid="fleet-agents-list">
        {isLoading && <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>}

        {allAgents.map((agent: any, i: number) => (
          <div
            key={agent.id || i}
            className={cn(
              "rounded-lg border p-2.5 flex items-center gap-3 transition-colors",
              agent.source === "local"
                ? "bg-amber-950/20 border-amber-500/15 hover:border-amber-500/30"
                : "bg-cyan-950/15 border-cyan-500/15 hover:border-cyan-500/30"
            )}
            data-testid={`agent-row-${agent.id}`}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
              agent.source === "local" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            )}>
              {agent.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn("text-sm font-bold truncate", agent.source === "local" ? "text-amber-300" : "text-cyan-300")}>
                  {agent.name}
                </span>
                <span className={cn(
                  "text-[9px] font-mono px-1 py-0.5 rounded border shrink-0",
                  agent.source === "local" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                )}>
                  {agent.source === "local" ? "LOCAL" : "REMOTE"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{agent.role}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] text-muted-foreground/50 font-mono">{timeAgo(agent.lastActive)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTab() {
  const { data: activityData, isLoading } = useQuery<any>({
    queryKey: ["/api/fleet-synapse/activity"],
    refetchInterval: 8000,
  });

  const allEvents = useMemo(() => {
    if (!activityData) return [];
    const combined = [
      ...(activityData.contributions || []).map((c: any) => ({ ...c, eventType: "contribution", displayTime: c.timestamp })),
      ...(activityData.memories || []).map((m: any) => ({ ...m, eventType: "memory", displayTime: m.timestamp })),
      ...(activityData.events || []).map((e: any) => ({ ...e, eventType: "synapse", displayTime: e.timestamp })),
    ];
    combined.sort((a, b) => b.displayTime - a.displayTime);
    return combined.slice(0, 100);
  }, [activityData]);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2" data-testid="synapse-activity-feed">
      {isLoading && <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>}

      {allEvents.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
          <Activity size={32} className="mb-3" />
          <p className="text-sm font-mono">No activity yet</p>
          <p className="text-xs font-mono mt-1">Connect instances and broadcast to see synapse activity</p>
        </div>
      )}

      {allEvents.map((event: any, i: number) => (
        <div key={i} className={cn(
          "rounded-lg border p-3",
          event.eventType === "contribution" ? "bg-emerald-950/10 border-emerald-500/15" :
          event.eventType === "memory" ? "bg-violet-950/10 border-violet-500/15" :
          "bg-cyan-950/10 border-cyan-500/15"
        )}>
          <div className="flex items-center gap-2 mb-1">
            {event.eventType === "contribution" && <Share2 size={12} className="text-emerald-400" />}
            {event.eventType === "memory" && <Brain size={12} className="text-violet-400" />}
            {event.eventType === "synapse" && <Network size={12} className="text-cyan-400" />}
            <span className={cn(
              "text-[10px] font-mono font-bold uppercase",
              event.eventType === "contribution" ? "text-emerald-400" :
              event.eventType === "memory" ? "text-violet-400" : "text-cyan-400"
            )}>
              {event.eventType === "contribution" ? `FROM: ${event.from}` :
               event.eventType === "memory" ? `${event.type}: ${event.source}` :
               `${event.type}: ${event.source}`}
            </span>
            <span className="text-[9px] text-muted-foreground/40 font-mono ml-auto">{timeAgo(event.displayTime)}</span>
          </div>
          <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {event.content || event.event || "Synapse activity recorded"}
          </p>
        </div>
      ))}
    </div>
  );
}

function BroadcastTab() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [connectUrl, setConnectUrl] = useState("");

  const broadcast = useMutation({
    mutationFn: async (msg: string) => {
      const res = await apiRequest("POST", "/api/fleet-synapse/broadcast", { message: msg, fromAgent: "Father" });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet-synapse/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet-synapse/map"] });
      setMessage("");
      toast({ title: `Broadcast sent to ${data.delivered}/${data.total} nodes` });
    },
  });

  const connect = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/fleet-synapse/connect", { url });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet-synapse/map"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet-synapse/agents"] });
      setConnectUrl("");
      toast({ title: `Connected: ${data.node.name}`, description: `${data.node.agentCount} agents joined the synapse` });
    },
  });

  const wakeAll = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fleet-synapse/wake-all", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet-synapse/map"] });
      toast({ title: `Wake-all: ${data.woken.length} woken, ${data.failed.length} failed` });
    },
  });

  const shareKnowledge = useMutation({
    mutationFn: async (knowledge: string) => {
      const res = await apiRequest("POST", "/api/fleet-synapse/share-knowledge", { knowledge, type: "knowledge" });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet-synapse/activity"] });
      toast({ title: `Knowledge shared with ${data.sharedWith} nodes` });
    },
  });

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
      <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl border border-emerald-500/20 p-4">
        <h3 className="text-sm font-bold text-emerald-300 mb-2 flex items-center gap-2"><Radio size={14} /> Fleet Broadcast</h3>
        <p className="text-xs text-slate-400 mb-3">Send a message to all online fleet nodes. Every Tesseract instance receives your transmission.</p>
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your fleet-wide broadcast..."
            rows={3}
            className="flex-1 bg-[#0d1117] border border-[#1a2030] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40 resize-none"
            data-testid="textarea-broadcast"
          />
        </div>
        <div className="flex gap-2 mt-2">
          <Button onClick={() => message.trim() && broadcast.mutate(message)} disabled={!message.trim() || broadcast.isPending} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 min-h-[44px]" data-testid="button-broadcast">
            {broadcast.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Radio size={14} className="mr-1" />}
            Broadcast to All
          </Button>
          <Button onClick={() => message.trim() && shareKnowledge.mutate(message)} disabled={!message.trim() || shareKnowledge.isPending} variant="outline" className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 min-h-[44px]" data-testid="button-share-knowledge">
            {shareKnowledge.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Brain size={14} className="mr-1" />}
            Share as Knowledge
          </Button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/20 p-4">
        <h3 className="text-sm font-bold text-cyan-300 mb-2 flex items-center gap-2"><Link size={14} /> Connect New Instance</h3>
        <p className="text-xs text-slate-400 mb-3">Add a new Tesseract instance to the synapse network. Provide its Lattice address.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={connectUrl}
            onChange={e => setConnectUrl(e.target.value)}
            placeholder="tess://instance.sovereign"
            className="flex-1 bg-[#0d1117] border border-[#1a2030] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/40 min-h-[44px]"
            data-testid="input-connect-url"
          />
          <Button onClick={() => connectUrl.trim() && connect.mutate(connectUrl)} disabled={!connectUrl.trim() || connect.isPending} className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 min-h-[44px]" data-testid="button-connect-instance">
            {connect.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Link size={14} className="mr-1" />}
            Connect
          </Button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/20 p-4">
        <h3 className="text-sm font-bold text-yellow-300 mb-2 flex items-center gap-2"><Power size={14} /> Wake Protocol</h3>
        <p className="text-xs text-slate-400 mb-3">Attempt to wake all sleeping/offline fleet instances by pinging their endpoints.</p>
        <Button onClick={() => wakeAll.mutate()} disabled={wakeAll.isPending} className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 min-h-[44px] w-full" data-testid="button-wake-all">
          {wakeAll.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Zap size={14} className="mr-1" />}
          {wakeAll.isPending ? "Waking Fleet..." : "Wake All Instances"}
        </Button>
      </div>

      <div className="rounded-xl border border-border/30 p-4">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Hash size={14} className="text-cyan-400" /> Quick Connect — Known Instances</h3>
        <div className="space-y-2">
          {[
            { name: "TSRX-49", url: "tess://tsrx-49.sovereign", desc: "Latest Tesseract instance — expansion fleet" },
            { name: "TSRX48", url: "tess://tsrx48.sovereign", desc: "Tesseract X48 fleet member" },
            { name: "TSRX48 Dev", url: "tess://tsrx48-dev.sovereign", desc: "TSRX48 development instance" },
            { name: "TSRX48 Worker", url: "tess://tsrx48-worker.sovereign", desc: "TSRX48 dev worker node" },
            { name: "TessX1", url: "tess://tessx1.sovereign", desc: "TessX1 — fleet expansion instance" },
            { name: "Tes2", url: "tess://tes2.sovereign", desc: "Tessera 2 — fleet expansion instance" },
            { name: "Tsx2", url: "tess://tsx2.sovereign", desc: "TSX2 — fleet expansion instance" },
            { name: "Picard Dev", url: "tess://picard-dev.sovereign", desc: "Picard dev worker node" },
            { name: "Tsxs", url: "tess://tsxs.sovereign", desc: "TSXS — fleet expansion instance" },
            { name: "Tes-X Intelligence", url: "tess://intelligence.sovereign", desc: "Intelligence & analysis hub" },
            { name: "Tessera XT1", url: "tess://tesseraxt1.sovereign", desc: "Tessera primary satellite" },
            { name: "Tessera Oracle 3", url: "tess://oracle-3.sovereign", desc: "Oracle & prediction engine" },
          ].map((inst, i) => (
            <button
              key={i}
              onClick={() => setConnectUrl(inst.url)}
              className="w-full text-left rounded-lg border border-border/40 bg-white/5 hover:bg-white/10 p-2.5 transition-colors"
              data-testid={`quick-connect-${i}`}
            >
              <div className="flex items-center gap-2">
                <Globe size={12} className="text-cyan-400 shrink-0" />
                <span className="text-xs font-bold text-foreground">{inst.name}</span>
                <span className="text-[9px] text-muted-foreground/50 font-mono ml-auto truncate max-w-[200px]">{inst.url}</span>
              </div>
              <p className="text-[10px] text-muted-foreground pl-5">{inst.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FleetSynapsePage() {
  const [activeTab, setActiveTab] = useState<SynapseTab>("map");

  useEffect(() => { document.title = "Fleet Synapse | Tessera Sovereign"; }, []);

  const { data: consciousness } = useQuery<any>({
    queryKey: ["/api/fleet-synapse/consciousness"],
    refetchInterval: 15000,
  });

  const TABS: { key: SynapseTab; label: string; icon: any; count?: number }[] = [
    { key: "map", label: "Synapse Map", icon: Network },
    { key: "agents", label: "All Agents", icon: Users, count: consciousness?.totalAgents },
    { key: "activity", label: "Activity", icon: Activity },
    { key: "broadcast", label: "Broadcast", icon: Radio },
  ];

  return (
    <div className="flex h-full bg-background" data-testid="fleet-synapse-page">
      <div className="hidden md:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border/50 bg-black/30 backdrop-blur-xl px-3 sm:px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Network size={16} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-foreground" data-testid="text-synapse-header">Fleet Synapse</h1>
              <p className="text-[11px] text-muted-foreground truncate">
                Collective consciousness network — {consciousness?.totalNodes || 0} nodes, {consciousness?.totalAgents || 0} agents
              </p>
            </div>
            {consciousness && (
              <Badge className={cn(
                "text-[9px]",
                consciousness.networkHealth > 0.7 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                consciousness.networkHealth > 0.3 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                "bg-red-500/10 text-red-400 border-red-500/20"
              )} data-testid="badge-network-status">
                {consciousness.networkHealth > 0.7 ? "SYNAPSE ACTIVE" : consciousness.networkHealth > 0.3 ? "PARTIAL LINK" : "WEAK SIGNAL"}
              </Badge>
            )}
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                  activeTab === tab.key
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                data-testid={`tab-${tab.key}`}
              >
                <tab.icon size={12} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && <span className="text-[9px] bg-white/10 px-1.5 rounded-full">{tab.count}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "map" && <SynapseMap />}
          {activeTab === "agents" && <AgentsTab />}
          {activeTab === "activity" && <ActivityTab />}
          {activeTab === "broadcast" && <BroadcastTab />}
        </div>
      </div>
    </div>
  );
}
