/** Rules taken from the TESSERA readme. A feed that is not fetched stays unfetched. */

export const PORTS = {
  web: 3000,
  api: 5000,
  sandbox: 5173,
  gitai: 4183,
  studio: 4173,
  preview: 4174,
  console: 4391,
  gitbook: 8787,
} as const;

export const NEXT = {
  ground: "#070b10",
  edge: "#7ef0d4",
  fracture: "#ff5c39",
  bone: "#f3efe6",
} as const;

const FACETS: Record<string, "water" | "fire" | "lightning" | "diamond" | "spiral"> = {
  cyan: "water",
  teal: "water",
  blue: "water",
  indigo: "water",
  purple: "spiral",
  rose: "fire",
  amber: "fire",
  green: "lightning",
  water: "water",
  fire: "fire",
  lightning: "lightning",
  diamond: "diamond",
  spiral: "spiral",
};

const SECRET_PATH = /(^|\/)(\.env|credentials|browser-profile|secrets)(\/|$)/i;

export function loopback(url: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/.test(url) && !/(\d{1,3}\.){3}\d{1,3}/.test(url.replace("127.0.0.1", ""));
  }
}

export function gateStatus(port: string) {
  return port.trim() ? 200 : 503;
}

export function syntheticChart(raw: string) {
  let body: { synthetic?: boolean };
  try {
    body = JSON.parse(raw) as { synthetic?: boolean };
  } catch {
    return false;
  }
  return body.synthetic === true && !/"name"\s*:/.test(raw);
}

export function buildMigrates() {
  return false;
}

export function sameCopies(copies: string[]) {
  return new Set(copies).size === 1;
}

export function facetOf(name: string) {
  return FACETS[name.toLowerCase()] ?? "water";
}

export function nextPort(start: number, taken: (port: number) => boolean) {
  for (let port = start; port < start + 10; port += 1) {
    if (!taken(port)) return port;
  }
  return null;
}

export function secretPath(path: string) {
  return SECRET_PATH.test(path);
}

export function gmailAuthor(email: string) {
  return email.toLowerCase().endsWith("@gmail.com");
}

export function codeownersHalt(authorIsOwner: boolean, touchesOwners: boolean) {
  return touchesOwners && !authorIsOwner;
}

export function creditsRedeemable() {
  return false;
}

export function evalBase(url = "http://localhost:5000") {
  return loopback(url) ? url : "";
}

export function rememberLine(text: string) {
  return { text, weights: false as const };
}

export function feed(name: "opensky" | "ais" | "nasa" | "cctv") {
  if (name === "cctv") return "refused";
  return "not fetched";
}

export function suiteLine() {
  const checks = [
    loopback("postgresql://localhost:5432/tessera_dev"),
    !loopback("postgresql://db.example.com:5432/tessera"),
    gateStatus("") === 503,
    syntheticChart('{"synthetic":true,"sun":0}'),
    !syntheticChart('{"synthetic":true,"name":"someone"}'),
    buildMigrates() === false,
    sameCopies(["a", "a", "a", "a", "a", "a", "a", "a"]),
    facetOf("rose") === "fire",
    facetOf("unknown") === "water",
    nextPort(5000, (port) => port < 5003) === 5003,
    secretPath("browser-profile/cookies"),
    gmailAuthor("person@gmail.com"),
    codeownersHalt(false, true),
    creditsRedeemable() === false,
    evalBase() === "http://localhost:5000",
    rememberLine("a lesson").weights === false,
    feed("cctv") === "refused",
    feed("opensky") === "not fetched",
    NEXT.ground === "#070b10",
    PORTS.console === 4391,
  ];
  return { passed: checks.filter(Boolean).length, total: checks.length };
}
