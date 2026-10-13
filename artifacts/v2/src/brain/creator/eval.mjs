/**
 * Local-only eval. Reads the private corpus from TESSERA_CREATOR_DIR (default
 * /workspace/secrets/creator, outside git), prints aggregate metrics only.
 * Corpus schema: see SCHEMA.md. Usage: node src/brain/creator/eval.mjs
 */
import fs from "node:fs"; import path from "node:path";
import { profile, score, auc } from "./style.mjs";
import { createProfile } from "./profile.mjs";
const D = process.env.TESSERA_CREATOR_DIR ?? "/workspace/secrets/creator";
const jl = (f) => fs.existsSync(path.join(D, f)) ? fs.readFileSync(path.join(D, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const father = jl("father-msgs.jsonl"); const others = jl("other-text.jsonl").map((o) => o.text);
const oTr = others.filter((_, i) => i % 2 === 0), oTe = others.filter((_, i) => i % 2 === 1);
const O = profile(oTr); const F = profile(father.map((m) => m.text));
const pos = father.map((m, i) => score(profile(father.filter((_, j) => j !== i).map((x) => x.text)), O, m.text));
const neg = oTe.map((s) => score(F, O, s));
const P = createProfile(); father.forEach((m, i) => P.ingest({ id: m.id, t: i, text: m.text }));
console.log(JSON.stringify({ auc: auc(pos, neg), length_only_auc: auc(father.map((m) => -m.text.length), oTe.map((s) => -s.length)), n_pos: pos.length, n_neg: neg.length, profile_items: P.snapshot().length }));
