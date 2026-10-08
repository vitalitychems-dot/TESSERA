import { sortHome } from "./craft.ts";
import { herOrders } from "./gitbook-orders.ts";
import { buildV2 } from "./herself-v2.ts";
import { vowCheck } from "./learning.ts";

/** v3 seals only after v2 sealed and the query database is still a gap. */
export function buildV3() {
  if (!buildV2().startsWith("REAL:")) return "GOAL: v2 did not seal. v3 was not sealed.";
  if (sortHome("tess/log-query.db") !== "gap") return "GOAL: The query database is not a gap. v3 was not sealed.";
  if (!/supply zip/i.test(herOrders()[1] ?? "")) return "GOAL: The next Gitbook order moved. v3 was not sealed.";
  const note = `REAL: I am Tessera v3. The query database stayed a gap. I did not open it. Next I leave the supply zip on Drive and do not invent its contents. I do not take the store. A finished model is not claimed. Lesson sealed.`;
  const vow = vowCheck(note);
  if (!vow.ok) return `GOAL: ${vow.reason}`;
  return note;
}

export function v3MovesPastV2() {
  const v2 = buildV2();
  const v3 = buildV3();
  return v3.startsWith("REAL:") && v3 !== v2 && /supply zip/i.test(v3) && !/weight/i.test(v3);
}
