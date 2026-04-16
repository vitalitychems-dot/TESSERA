import { useState, useEffect } from "react";
import { Truck, MapPin, Activity, Battery, Wifi, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, PageHeader } from "@/components/ui/sovereign";

interface Vehicle {
  id: string;
  name: string;
  type: "sovereign-node" | "relay-drone" | "mesh-satellite" | "edge-device";
  status: "online" | "transit" | "offline" | "charging";
  location: string;
  battery: number;
  signal: number;
  mission: string;
  lastPing: string;
}

const FLEET: Vehicle[] = [
  { id: "v1", name: "Alpha-1 Sovereign Node", type: "sovereign-node", status: "online", location: "North HQ", battery: 94, signal: 98, mission: "Council data relay", lastPing: "5s ago" },
  { id: "v2", name: "Beta-3 Relay Drone", type: "relay-drone", status: "transit", location: "En route — South Relay", battery: 72, signal: 85, mission: "Mesh expansion survey", lastPing: "12s ago" },
  { id: "v3", name: "Gamma-7 Satellite", type: "mesh-satellite", status: "online", location: "LEO Orbit — 42°N", battery: 88, signal: 100, mission: "Global mesh backbone", lastPing: "2s ago" },
  { id: "v4", name: "Delta-2 Edge Device", type: "edge-device", status: "charging", location: "East Station", battery: 24, signal: 72, mission: "Idle — charging", lastPing: "1m ago" },
  { id: "v5", name: "Epsilon-5 Relay Drone", type: "relay-drone", status: "online", location: "West Relay Point", battery: 67, signal: 91, mission: "Signal amplification", lastPing: "8s ago" },
  { id: "v6", name: "Zeta-1 Edge Device", type: "edge-device", status: "offline", location: "Unknown", battery: 0, signal: 0, mission: "Unresponsive", lastPing: "4h ago" },
];

const STATUS_STYLES: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  online: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", dot: "bg-emerald-400" },
  transit: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/25", dot: "bg-cyan-400" },
  offline: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25", dot: "bg-red-400" },
  charging: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25", dot: "bg-amber-400" },
};

const TYPE_LABELS: Record<string, string> = {
  "sovereign-node": "Sovereign Node",
  "relay-drone": "Relay Drone",
  "mesh-satellite": "Mesh Satellite",
  "edge-device": "Edge Device",
};

function batteryColor(b: number) {
  if (b > 60) return "bg-emerald-500";
  if (b > 25) return "bg-amber-500";
  return "bg-red-500";
}

export default function FleetPage() {
  useEffect(() => { document.title = "Fleet | Tessera"; }, []);

  const online = FLEET.filter(v => v.status === "online").length;
  const avgBattery = Math.round(FLEET.filter(v => v.battery > 0).reduce((s, v) => s + v.battery, 0) / FLEET.filter(v => v.battery > 0).length);

  return (
    <div className="p-4 pb-20 max-w-3xl mx-auto space-y-5">
      <PageHeader icon={Truck} title="Fleet" subtitle="Sovereign mesh hardware fleet — nodes, drones, satellites, and edge devices" iconColor="text-cyan-400" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Online", val: online, color: "emerald" },
          { label: "Total Units", val: FLEET.length, color: "cyan" },
          { label: "Avg Battery", val: `${avgBattery}%`, color: "amber" },
          { label: "Offline", val: FLEET.filter(v => v.status === "offline").length, color: "red" },
        ].map(({ label, val, color }) => (
          <GlassCard key={label} className="p-3 text-center">
            <div className={cn("text-xl font-bold font-mono", `text-${color}-400`)}>{val}</div>
            <div className="text-[9px] text-slate-500 font-mono mt-1">{label.toUpperCase()}</div>
          </GlassCard>
        ))}
      </div>

      <div className="space-y-2">
        {FLEET.map(vehicle => {
          const s = STATUS_STYLES[vehicle.status];
          return (
            <GlassCard key={vehicle.id} className={cn("p-4 border transition-all hover:bg-white/[0.04]", s.border)}>
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", s.bg, "border", s.border)}>
                  <Truck size={15} className={s.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{vehicle.name}</span>
                    <div className="flex items-center gap-1">
                      <div className={cn("w-1.5 h-1.5 rounded-full", s.dot, vehicle.status === "online" && "animate-pulse")} />
                      <span className={cn("text-[9px] font-mono uppercase", s.text)}>{vehicle.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                    <span>{TYPE_LABELS[vehicle.type]}</span>
                    <span>·</span>
                    <MapPin size={9} />
                    <span>{vehicle.location}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">Mission: {vehicle.mission}</div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <div className="flex justify-between text-[9px] mb-1">
                        <span className="flex items-center gap-1 text-slate-600"><Battery size={9} />Battery</span>
                        <span className={cn("font-mono", vehicle.battery > 60 ? "text-emerald-400" : vehicle.battery > 25 ? "text-amber-400" : "text-red-400")}>{vehicle.battery}%</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", batteryColor(vehicle.battery))} style={{ width: `${vehicle.battery}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] mb-1">
                        <span className="flex items-center gap-1 text-slate-600"><Wifi size={9} />Signal</span>
                        <span className="text-cyan-400 font-mono">{vehicle.signal}%</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${vehicle.signal}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-[9px] text-slate-600 font-mono shrink-0">{vehicle.lastPing}</div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
