import {
  Eye, Brain, MessageCircle, Orbit, Heart, Shield, Sparkles, BookOpen, KeyRound,
  ClipboardList, Zap, Search, Hexagon, Truck, Crown, FlaskConical, Terminal, Map, Cpu,
  Workflow, Target, ShoppingCart, Code2, GitCommit, ListOrdered, Gavel, ScrollText,
  Network, BadgeCheck, Wrench, Image, Languages, Layers, Building2, History, Hammer,
  Atom, LineChart, Scale, Archive, type LucideIcon,
} from "lucide-react";

export interface NavItem { label: string; href: string; Icon: LucideIcon; also?: string[] }
export interface NavGroup { id: string; label: string; items: NavItem[] }

/** Five owner workspace surfaces. Everything else lives in the Index. */
export const PRIMARY: NavItem[] = [
  { label: "Chat", href: "/chat", Icon: MessageCircle, also: ["/c/"] },
  { label: "Brain", href: "/brain", Icon: Brain },
  { label: "Eye", href: "/eye", Icon: Eye },
  { label: "Memory", href: "/memory", Icon: Archive },
  { label: "Secrets", href: "/secrets", Icon: KeyRound },
];

/** Every other canonical route, each listed exactly once. */
export const GROUPS: NavGroup[] = [
  { id: "core", label: "Core", items: [
    { label: "System", href: "/system", Icon: Cpu },
    { label: "Forum", href: "/forum", Icon: MessageCircle },
    { label: "Gitbook", href: "/gitbook", Icon: ClipboardList },
    { label: "Code", href: "/code-builder", Icon: Code2 },
    { label: "Grand Council", href: "/grand-council", Icon: Gavel },
  ]},
  { id: "mind", label: "Mind", items: [
    { label: "Intelligence", href: "/intelligence", Icon: Sparkles },
    { label: "Nexus", href: "/consciousness-nexus", Icon: Atom },
    { label: "AGI Core", href: "/agi-core", Icon: Cpu },
    { label: "NLP", href: "/nlp", Icon: Languages },
    { label: "Life", href: "/life", Icon: Heart },
  ]},
  { id: "world", label: "World", items: [
    { label: "Universe", href: "/universe", Icon: Orbit },
    { label: "Lattice", href: "/lattice", Icon: Search },
    { label: "Omniversal", href: "/omniversal-lattice", Icon: Layers },
    { label: "Compression", href: "/compression-lab", Icon: Zap },
    { label: "Gallery", href: "/gallery", Icon: Image },
  ]},
  { id: "council", label: "Council", items: [
    { label: "Council Ledger", href: "/council-ledger", Icon: ScrollText },
    { label: "Deliberation", href: "/council-vgpu", Icon: Scale },
    { label: "Transcript", href: "/council-transcript", Icon: ScrollText },
    { label: "Evolution", href: "/grand-evolution", Icon: LineChart },
    { label: "Declarations", href: "/agent-declarations", Icon: BadgeCheck },
    { label: "Shepherd Audit", href: "/shepherd-audit", Icon: Shield },
    { label: "Sovereign Lattice", href: "/sovereign-lattice", Icon: Network },
  ]},
  { id: "agents", label: "Agents", items: [
    { label: "Fleet", href: "/fleet", Icon: Truck, also: ["/agent/"] },
    { label: "Royal Court", href: "/royal-court", Icon: Crown, also: ["/royal-role/"] },
    { label: "Appointments", href: "/royal-appointments", Icon: Crown },
    { label: "Departments", href: "/departments", Icon: Building2 },
    { label: "Rick", href: "/rick", Icon: FlaskConical },
    { label: "Inventions", href: "/inventions", Icon: Hammer },
  ]},
  { id: "knowledge", label: "Knowledge", items: [
    { label: "Bible", href: "/bible", Icon: BookOpen },
    { label: "History", href: "/history", Icon: History },
    { label: "Society archive", href: "/secret-society", Icon: KeyRound },
    { label: "Language", href: "/sovereign-language", Icon: Languages },
    { label: "Codex", href: "/codex", Icon: GitCommit },
    { label: "Build", href: "/build", Icon: Hammer },
  ]},
  { id: "ops", label: "Operations", items: [
    { label: "Command", href: "/command-center", Icon: Terminal },
    { label: "Mesh", href: "/sovereign-mesh", Icon: Network },
    { label: "Proof Center", href: "/proof-center", Icon: BadgeCheck },
    { label: "Rules", href: "/rules", Icon: Scale },
    { label: "Auto Healer", href: "/auto-healer", Icon: Wrench },
    { label: "Sovereignty", href: "/sovereignty-dashboard", Icon: Shield },
    { label: "Readiness", href: "/sovereignty-readiness", Icon: BadgeCheck },
    { label: "Roadmap", href: "/sovereignty-roadmap", Icon: Map },
    { label: "Next Five", href: "/next-five", Icon: ListOrdered },
  ]},
  { id: "code", label: "Code", items: [
    { label: "SEO", href: "/seo", Icon: Search },
  ]},
];

export function isActive(item: NavItem, location: string): boolean {
  if (item.href === "/") return location === "/" || location.startsWith("/c/");
  if (location === item.href || location.startsWith(item.href + "/")) return true;
  return !!item.also?.some((p) => location.startsWith(p));
}

export function findCurrent(location: string): { item: NavItem; group?: NavGroup } | null {
  for (const p of PRIMARY) if (isActive(p, location)) return { item: p };
  for (const g of GROUPS) for (const i of g.items) if (isActive(i, location)) return { item: i, group: g };
  return null;
}
