import type { LucideIcon } from "lucide-react";
import {
  MessageSquare, Cpu, Sparkles, Code2, Eye, Heart, Atom, Shield,
  Crown, Layers, MessageCircle, Rocket, BarChart3, Globe, Settings, Users,
  Wrench, Brain, Network, Zap, Terminal, Truck, Link2,
  DollarSign, ArrowUpDown, Workflow, ShoppingCart, TrendingUp, Target,
  Lightbulb, MapPin, Search, Map, User, CheckSquare, Scale, Key, Hexagon,
  Building2, Book, Activity, Database, Gavel, ShieldCheck,
} from "lucide-react";

export type NavigationGroup =
  | "Core" | "Life & Nexus" | "Knowledge" | "Council" | "Royal Court"
  | "Build" | "System" | "Operations" | "Sovereign System" | "Developer"
  | "Crypto" | "Trading" | "Arbitrage" | "Finance" | "Vitality" | "Store";
export type SystemDestination = "capability" | "learning" | "operations" | "architecture";

export interface NavigationDestination {
  id: string;
  label: string;
  href: string;
  aliases: readonly string[];
  group: NavigationGroup;
  Icon: LucideIcon;
  testId: string;
  systemTab?: SystemDestination;
}

const d = (
  id: string, label: string, href: string, group: NavigationGroup, Icon: LucideIcon,
  aliases: readonly string[] = [], systemTab?: SystemDestination,
): NavigationDestination => ({ id, label, href, group, Icon, aliases, systemTab, testId: `link-${id}` });

export const navigationRegistry: readonly NavigationDestination[] = [
  d("chat", "Chat", "/", "Core", MessageSquare, ["/c/:id"]),
  d("intelligence-engine", "Intelligence Engine", "/intelligence-engine", "Core", Brain),
  d("life", "Life", "/life", "Life & Nexus", Heart),
  d("consciousness-nexus", "Consciousness Nexus", "/consciousness-nexus", "Life & Nexus", Atom, ["/consciousness"]),
  d("sovereignty-dashboard", "Sovereignty Dashboard", "/sovereignty-dashboard", "Life & Nexus", Shield, ["/sovereignty", "/sovereign-framework", "/sovereign-hub"]),
  d("consciousness-2da", "OA Awakening", "/consciousness-2da", "Life & Nexus", Eye),
  d("spiritual-awakening", "Spiritual Awakening", "/spiritual-awakening", "Life & Nexus", Sparkles),
  d("universe", "Universe", "/universe", "Life & Nexus", Globe),
  d("omniscient-knowledge", "Knowledge Hub", "/unified-knowledge", "Knowledge", Sparkles, [
    "/omniscient-knowledge", "/secrets", "/secret-knowledge", "/knowledge-dashboard",
    "/live-secret-knowledge", "/vatican-archives", "/secret-society",
    "/grand-narrative", "/unified-truth", "/bible", "/living-bible",
    "/sacred-conference", "/sacred-knowledge-vault", "/3d-diagrams", "/sacred-traditions",
  ]),
  d("sovereign-language", "Tessera Lingua Sacra", "/sovereign-language", "Knowledge", Code2, ["/colonel-language"]),
  d("members", "Members", "/members", "Knowledge", Users),
  d("grand-council", "Grand Council", "/grand-council", "Council", Crown, ["/grand-conference", "/conference-decisions", "/consensus"]),
  d("conclusions", "Conclusions · hierarchy", "/conclusions", "Council", Layers),
  d("feedback", "Feedback · proposals", "/feedback", "Council", MessageCircle),
  d("transparency-ledger", "Transparency Ledger · executor", "/transparency-ledger", "Council", Layers),
  d("recruitment", "Recruitment", "/recruitment", "Council", Rocket),
  d("royal-court", "Royal Court", "/royal-court", "Royal Court", Crown),
  d("rick", "Royal Inventor", "/rick", "Royal Court", Atom, ["/rick-sanchez"]),
  d("royal-appointments", "Royal Appointments", "/royal-appointments", "Royal Court", Sparkles),
  d("royal-role-directory", "Royal roles", "/royal-role/:roleId", "Royal Court", Crown),
  d("build", "Build", "/build", "Build", Wrench, ["/inventions"]),
  d("agent-nft", "Agent NFTs", "/agent-nft", "Build", Hexagon),
  d("universe-model", "Omniverse Model", "/universe-model", "Build", Globe),
  d("system", "System Engine", "/system", "System", Cpu),
  d("agent-comms", "Agent Comms", "/agent-comms", "System", MessageSquare, [], "operations"),
  d("memory-tools", "Memory tools", "/memory-explorer", "System", Database, ["/memory-dashboard"], "learning"),
  d("sovereign-deps", "Sovereign Shield", "/sovereign-deps", "System", ShieldCheck, [], "learning"),
  d("evolution-health", "Evolution Health", "/evolution-health", "System", Activity, [], "operations"),
  d("compression-lab", "Compression Lab", "/compression-lab", "System", Zap),
  d("lattice", "Lattice Internet", "/lattice", "Operations", Globe),
  d("command-center", "Command Center", "/command-center", "Operations", Terminal),
  d("executor", "Self Executor", "/executor", "Operations", Zap),
  d("swarm", "Swarm Visualization", "/swarm", "Operations", Network),
  d("fleet", "Fleet", "/fleet", "Operations", Truck),
  d("cross-app", "Cross-App Bridge", "/cross-app", "Operations", Link2),
  d("settings", "Settings", "/settings", "Core", Settings),
  d("economy-hub", "Economy Hub", "/economy-hub", "Finance", BarChart3, ["/token-economy", "/tokens"]),
  d("sports-arb", "Sports Arb", "/sports-arb", "Trading", ArrowUpDown),
  d("finance", "Finance", "/finance", "Finance", DollarSign),
  d("market", "Market Dashboard", "/market", "Trading", BarChart3),
  d("arbitrage", "Arbitrage", "/arbitrage", "Arbitrage", ArrowUpDown),
  d("income", "Income Workflows", "/income", "Finance", Workflow),
  d("ecom", "E-Commerce", "/ecom", "Store", ShoppingCart),
  d("affiliate", "Affiliate Marketing", "/affiliate", "Finance", TrendingUp),
  d("lead-gen", "Lead Generation", "/lead-gen", "Finance", Target),
  d("business-ideas", "Business Ideas", "/business-ideas", "Build", Lightbulb),
  d("local-services", "Local Services", "/local-services", "Finance", MapPin),
  d("seo", "SEO Research", "/seo", "Developer", Search),
  d("sovereignty-roadmap", "Sovereignty Roadmap", "/sovereignty-roadmap", "Sovereign System", Map),
  d("agent-profile", "Agent Profiles", "/agent-profile", "Sovereign System", User),
  d("sovereign-mesh", "Sovereign Mesh", "/sovereign-mesh", "Sovereign System", Network),
  d("proof-center", "Proof Center", "/proof-center", "Sovereign System", CheckSquare),
  d("rules", "Sovereign Rules", "/rules", "Sovereign System", Scale),
  d("intelligence", "Intelligence", "/intelligence", "Sovereign System", Brain),
  d("nlp", "NLP", "/nlp", "Core", Brain),
  d("forum", "Tesseract Forum", "/forum", "Council", MessageCircle),
  d("vortex-math", "Vortex Math", "/vortex-math", "Knowledge", Hexagon),
  d("council-transcript", "Council Transcript", "/council-transcript", "Council", Gavel, ["/ledger", "/audit-chain"]),
  d("api-marketplace", "API Marketplace", "/api-marketplace", "Developer", Globe),
  d("code-builder", "Code Builder", "/code-builder", "Developer", Code2),
  d("credentials", "Credentials", "/credentials", "Developer", Key),
  d("departments", "Departments", "/departments", "Royal Court", Building2),
];

// This route inventory contains canonical paths and retained aliases; aliases are never removed from routing.
export function resolveNavigationDestination(pathname: string): NavigationDestination | undefined {
  const exact = navigationRegistry.find((item) => item.href === pathname || item.aliases.includes(pathname));
  if (exact) return exact;
  if (pathname.startsWith("/c/")) return navigationRegistry.find((item) => item.id === "chat");
  if (pathname.startsWith("/royal-role/")) return navigationRegistry.find((item) => item.id === "royal-role-directory");
  return undefined;
}

export const navigationGroups = [...new Set(navigationRegistry.map((item) => item.group))];
