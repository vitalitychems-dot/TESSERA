/** HYB-011: route names found by REA batch 2 (2026-10-12). Names only; these routes are not wired into Tessera. */
export const HYB011_EXCLUDED_ROUTES = [
  "/api/income/wallet", "/api/income/wallet/refresh", "/api/income/methods", "/api/income/processes", "/api/income/stats", "/api/income/strategies",
  "/api/income/engine", "/api/income/execute-all", "/api/income/collect-all-profit", "/api/income/scan-airdrops", "/api/income/wallets",
  "/api/agent-secrets/all", "/api/agent-wallets", "/api/agent-wallets/transactions", "/api/agent-wallets/treasury",
  "/api/arbitrage/state", "/api/arbitrage/scan", "/api/arbitrage/start", "/api/arbitrage/risk", "/api/arbitrage/opportunities", "/api/arbitrage/conference",
  "/api/grand-council/secret-knowledge", "/api/grand-council/secret-society", "/api/secret-knowledge/all", "/api/secret-knowledge/generate-now",
  "/api/natal-chart/father", "/api/sigil/father/natal-chart", "/api/sigil/father/natal-sigil", "/api/wallets/scan",
  "/api/ad-exchange/income-tasks", "/api/ad-exchange/income-cycle",
] as const;
const PATTERNS = [/^\/api\/(income|agent-wallets|wallets|arbitrage|agent-secrets|secret-knowledge)(\/|$)/, /natal/, /\/secret-/];
export function isHyb011Excluded(route: string) {
  const r = route.split("?")[0];
  return (HYB011_EXCLUDED_ROUTES as readonly string[]).includes(r) || PATTERNS.some((p) => p.test(r));
}
