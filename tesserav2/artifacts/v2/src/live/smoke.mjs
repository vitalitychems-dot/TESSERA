// Optional live smoke: node src/live/smoke.mjs [ids...]  (default: 3 sources). Writes to a temp cache.
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { createShepherd, httpTransport, newKeys } from "./shepherd.mjs";
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ["usgs-quakes", "wikipedia", "open-meteo"];
const sh = createShepherd({ transport: httpTransport(), cacheDir: mkdtempSync(join(tmpdir(), "shep-")), keys: newKeys() });
for (const r of await sh.runOnce(ids)) console.log(JSON.stringify(r));
