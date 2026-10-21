import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG } from "./catalog-pass.ts";
import { countByHome, filterCatalog, lookupCatalog, memoryWebText } from "./memory-web.ts";

test("catalog pass matches the 2026-10-08 resolution", () => {
  const counts = countByHome();
  assert.equal(counts.total, 272);
  assert.equal(counts.present, 224);
  assert.equal(counts.missing, 48);
  assert.equal(counts.homes.tool, 8);
  assert.equal(counts.homes.held, 17);
  assert.equal(lookupCatalog("freqtrade/freqtrade")?.home, "held");
  assert.equal(lookupCatalog("topics/agi")?.home, "not-a-repo");
  assert.equal(lookupCatalog("collink1007/fleet-moss-monarch-rapid")?.home, "vitality");
  assert.equal(lookupCatalog("Panniantong/Agent-Reach")?.home, "tool");
  assert.equal(filterCatalog("tessera", "live").some((row) => row.name === "vitalitychems-dot/TESSERA"), true);
  assert.equal(memoryWebText().includes("SESSION_SECRET"), false);
  assert.equal(JSON.stringify(CATALOG).includes("SESSION_SECRET"), false);
});
