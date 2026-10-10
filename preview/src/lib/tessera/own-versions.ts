import { CATALOG } from "./catalog-pass.ts";
import { readCheckouts } from "./checkout-steps.ts";
import { connect, LOCAL_REPOS } from "./stride.ts";

const CARDS = [
  "activepieces/activepieces",
  "adamgallas/FireFly-v1",
  "adamgallas/FireFly-v2",
  "adamgallas/SpinalDLA",
  "0x0funky/agent-sprite-forge",
  "appwrite/appwrite",
  "ggerganov/llama.cpp",
  "ollama/ollama",
] as const;

export function ownVersion(name: string) {
  const q = name.trim().toLowerCase();
  const short = q.split("/").pop() ?? q;
  const local = LOCAL_REPOS.find((repo) => repo.name.toLowerCase() === short);
  if (local) return { owned: true as const, text: connect(local) };
  const row = CATALOG.find((item) => item.name.toLowerCase() === q || item.name.toLowerCase().endsWith(`/${short}`));
  if (!row) return { owned: false as const, text: `${name} is not in the catalog.` };
  return { owned: false as const, text: `No local version. ${row.name} is ${row.home}.` };
}

export function ownFromQuestion(question: string) {
  const q = question.toLowerCase();
  for (const repo of LOCAL_REPOS) {
    if (new RegExp(`\\b${repo.name.toLowerCase()}\\b`).test(q)) return ownVersion(repo.name);
  }
  for (const row of CATALOG) {
    const short = row.name.split("/").pop()?.toLowerCase() ?? "";
    if (short.length < 6) continue;
    const escaped = short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(q)) return ownVersion(row.name);
  }
  return null;
}

export function trainCatalog() {
  const localPass = LOCAL_REPOS.every((repo) => ownVersion(repo.name).owned);
  const cardPass = CARDS.every((name) => {
    const hit = ownVersion(name);
    return !hit.owned && hit.text.startsWith("No local version.");
  });
  const read = readCheckouts();
  const proved = localPass && cardPass && read.proved && CATALOG.length === 272 && LOCAL_REPOS.length === 8;
  return {
    proved,
    catalog: CATALOG.length,
    local: LOCAL_REPOS.length,
    cards: CATALOG.filter((row) => row.home === "card").length,
    said: proved
      ? `I am Tessera. The catalog has ${CATALOG.length} names. ${LOCAL_REPOS.length} have a local note. ${CATALOG.filter((row) => row.home === "card").length} are cards. I do not have our own program for a card. ${read.said} The other ${CATALOG.length - LOCAL_REPOS.length} names are not on disk.`
      : "The catalog training missed.",
  };
}
