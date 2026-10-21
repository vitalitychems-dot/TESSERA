import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = (m: string) => console.log(`[OrchestratorConfig] ${m}`);

interface RateLimitSpec {
  rpm: number;
  rpd?: number;
  concurrent?: number;
}

interface ProviderSpec {
  id: string;
  name: string;
  url: string;
  model: string;
  format: "openai" | "gemini" | "anthropic" | "puter";
  maxTokens: number;
  rateLimit: RateLimitSpec;
  strengths: string[];
  tier: "free" | "paid";
}

interface DataSourceSpec {
  id: string;
  name: string;
  type: "api" | "scrape";
  url: string;
  rateLimit: RateLimitSpec;
  domains: string[];
  auth?: string;
}

interface DomainRateLimit {
  rpm: number;
  concurrent: number;
}

interface OrchestratorConfigData {
  version: string;
  name: string;
  providers: ProviderSpec[];
  freeProviders: ProviderSpec[];
  paidProviders: ProviderSpec[];
  dataSources: DataSourceSpec[];
  domainRateLimits: Map<string, DomainRateLimit>;
  userAgents: string[];
}

let _config: OrchestratorConfigData | null = null;

function parseProviders(raw: { free?: Array<Record<string, unknown>>; paid?: Array<Record<string, unknown>> }): { free: ProviderSpec[]; paid: ProviderSpec[] } {
  const mapProvider = (p: Record<string, unknown>, tier: "free" | "paid"): ProviderSpec => ({
    id: String(p.id || ""),
    name: String(p.name || ""),
    url: String(p.url || ""),
    model: String(p.model || ""),
    format: (p.format as ProviderSpec["format"]) || "openai",
    maxTokens: Number(p.maxTokens) || 4096,
    rateLimit: p.rateLimit as RateLimitSpec || { rpm: 10 },
    strengths: (p.strengths as string[]) || [],
    tier,
  });

  const free = (raw.free || []).map(p => mapProvider(p, "free"));
  const paid = (raw.paid || []).map(p => mapProvider(p, "paid"));
  return { free, paid };
}

function parseDataSources(raw: Array<Record<string, unknown>>): DataSourceSpec[] {
  return (raw || []).map(ds => ({
    id: String(ds.id || ""),
    name: String(ds.name || ""),
    type: (ds.type as "api" | "scrape") || "api",
    url: String(ds.url || ""),
    rateLimit: ds.rateLimit as RateLimitSpec || { rpm: 5 },
    domains: (ds.domains as string[]) || [],
    auth: ds.auth ? String(ds.auth) : undefined,
  }));
}

function parseDomainRateLimits(raw: Record<string, { rpm?: number; concurrent?: number }>): Map<string, DomainRateLimit> {
  const result = new Map<string, DomainRateLimit>();
  for (const [domain, spec] of Object.entries(raw || {})) {
    result.set(domain, {
      rpm: spec.rpm || 5,
      concurrent: spec.concurrent || 2,
    });
  }
  return result;
}

export function loadOrchestratorConfig(): OrchestratorConfigData {
  if (_config) return _config;

  const yamlPath = path.join(__dirname, "orchestrator.yaml");
  if (!fs.existsSync(yamlPath)) {
    throw new Error(`Orchestrator config not found: ${yamlPath}`);
  }

  const raw = YAML.parse(fs.readFileSync(yamlPath, "utf-8"));

  const { free, paid } = parseProviders(raw.providers || {});
  const dataSources = parseDataSources(raw.dataSources || []);
  const domainRateLimits = parseDomainRateLimits(raw.domainRateLimits || {});
  const userAgents: string[] = raw.userAgents || [];

  _config = {
    version: raw.version || "1.0",
    name: raw.name || "Sovereign Orchestrator",
    providers: [...free, ...paid],
    freeProviders: free,
    paidProviders: paid,
    dataSources,
    domainRateLimits,
    userAgents,
  };

  log(`Loaded ${_config.providers.length} providers (${free.length} free, ${paid.length} paid), ${dataSources.length} data sources, ${domainRateLimits.size} domain rate limits, ${userAgents.length} user agents`);
  return _config;
}

export function getProvider(providerId: string): ProviderSpec | undefined {
  const cfg = loadOrchestratorConfig();
  return cfg.providers.find(p => p.id === providerId);
}

export function getProvidersByStrength(strength: string): ProviderSpec[] {
  const cfg = loadOrchestratorConfig();
  return cfg.providers.filter(p => p.strengths.includes(strength));
}

export function getFreeProviders(): ProviderSpec[] {
  return loadOrchestratorConfig().freeProviders;
}

export function getPaidProviders(): ProviderSpec[] {
  return loadOrchestratorConfig().paidProviders;
}

export function getDataSource(sourceId: string): DataSourceSpec | undefined {
  const cfg = loadOrchestratorConfig();
  return cfg.dataSources.find(ds => ds.id === sourceId);
}

export function getDataSourcesByDomain(domain: string): DataSourceSpec[] {
  const cfg = loadOrchestratorConfig();
  return cfg.dataSources.filter(ds => ds.domains.includes(domain));
}

export function getDomainRateLimit(domain: string): DomainRateLimit {
  const cfg = loadOrchestratorConfig();
  return cfg.domainRateLimits.get(domain) || { rpm: 5, concurrent: 2 };
}

export function getRandomUserAgent(): string {
  const cfg = loadOrchestratorConfig();
  return cfg.userAgents[Math.floor(Math.random() * cfg.userAgents.length)] || "TesseraSovereign/1.0";
}

export function reloadConfig(): OrchestratorConfigData {
  _config = null;
  return loadOrchestratorConfig();
}

export type { ProviderSpec, DataSourceSpec, DomainRateLimit, OrchestratorConfigData, RateLimitSpec };
