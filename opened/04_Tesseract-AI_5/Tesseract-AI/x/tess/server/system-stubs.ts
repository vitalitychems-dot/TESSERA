export const getCostOptimizationReport = () => ({ totalSaved: 0, optimizations: [], timestamp: Date.now() });

export const getEdgeComputeStats = () => ({ nodes: 0, active: 0, requests: 0 });
export const edgeKeys = () => [];

const deploymentConfigs: Record<string, any> = {};
export const getDeploymentConfigs = () => Object.keys(deploymentConfigs).map(k => ({ name: k, ...deploymentConfigs[k] }));
export const getDeploymentConfig = (name: string) => deploymentConfigs[name] || null;
export const getDeploymentConfigFull = (name: string) => deploymentConfigs[name] || null;

export const getUncachableGitHubClient = () => ({
  repos: { listForUser: async () => ({ data: [] }) },
  search: { repos: async () => ({ data: { items: [] } }) },
});

export const fetchTSRTPrice = async () => ({ price: 0, source: "unavailable" });
export const getTSRTMarketData = () => ({ price: 0, volume: 0, marketCap: 0 });
export const getTSRTPriceHistory = () => [];
export const getTSRTContract = () => ({ address: "", network: "solana" });

const emergentPatterns: any[] = [];
export const getEmergentMonitorState = () => ({ patterns: emergentPatterns.length, scanning: true });
export const getEmergentPatterns = () => emergentPatterns.slice(-20);
export const runEmergentScan = () => ({ scanned: true, patternsFound: 0, timestamp: Date.now() });
export const detectCoordinationPattern = (_agents: string[]) => ({ detected: false });
export const recordBehaviorMetric = (_agentId: string, _metric: any) => {};
export const detectSpecializationEmergence = (_agentId: string) => null;

let _counter = 0;
export const generateId = (prefix = "id") => `${prefix}-${Date.now()}-${++_counter}`;
export const getRealSystemMetrics = () => ({
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  cpu: process.cpuUsage(),
  timestamp: Date.now(),
});
export const logAgentActivity = (agentId: string, activity: string) => {
  console.log(`[AgentActivity] ${agentId}: ${activity}`);
};

const TESSERA_SOVEREIGN_DOMAIN = "tessera.sov";
const TESSERA_FALLBACK_HOST = process.env.PUBLISHED_APP_URL
  ? new URL(process.env.PUBLISHED_APP_URL).host
  : (process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000");
export const getSovereignDomain = () => TESSERA_FALLBACK_HOST;
export const getTesseraSovDomain = () => TESSERA_SOVEREIGN_DOMAIN;
export const getLatticeUrl = (path = "") => `https://${getSovereignDomain()}${path}`;
export const getExternalUrl = (path = "") => getLatticeUrl(path);
export const getSovereignProtocol = () => "tess";
export const getTessUri = (domain: string, path = "") => `tess://${domain}${path}`;
