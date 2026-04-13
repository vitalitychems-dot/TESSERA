import { useMesh, type MeshHealth } from "@/lib/meshContext";
import { useAdmin } from "@/lib/adminContext";
import { useLocation } from "wouter";
import { Network, Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function healthDotColor(health: MeshHealth): string {
  switch (health) {
    case "entangled": return "bg-violet-400 animate-pulse";
    case "isolated": return "bg-amber-400";
    case "connecting": return "bg-blue-400 animate-pulse";
    case "degraded": return "bg-red-400";
    default: return "bg-slate-600";
  }
}

export default function MeshStatusBadge() {
  const { isAdmin } = useAdmin();
  const { health, peerCount, isRegistered } = useMesh();
  const [, setLocation] = useLocation();

  if (!isAdmin) return null;

  return (
    <button
      onClick={() => setLocation("/mesh")}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all",
        "bg-white/5 hover:bg-white/10 border border-white/10",
        health === "entangled" ? "border-violet-500/40" : ""
      )}
      title="Network Mesh status"
    >
      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", healthDotColor(health))} />
      <span className={cn(
        "hidden sm:inline",
        health === "entangled" ? "text-violet-300" : "text-muted-foreground"
      )}>
        {health === "connecting" ? "Connecting" :
         health === "entangled" ? `${peerCount + 1} sessions` :
         health === "isolated" ? "Solo" :
         health === "degraded" ? "Degraded" : "Offline"}
      </span>
      <Network className={cn(
        "w-3 h-3",
        health === "entangled" ? "text-violet-400" : "text-muted-foreground/60"
      )} />
    </button>
  );
}
