import { chooseSkill } from "./agent-cycle.ts";
import { sureAnswer } from "./guard.ts";
import { ledgerCount } from "./repo-ledger.ts";
import { recallLearned } from "./recursive-train.ts";
import { twoSources } from "./rick-loop.ts";
import { keepNote } from "./shelf.ts";
import { keepLine } from "./ten-big.ts";

/** Other systems are not scored. A blank is not a rank. */

export const LABS = ["a language model", "a tool agent", "a brain simulator"] as const;

export function latestLine(memory: readonly string[], query: string) {
  const key = `${query.toLowerCase()} =`;
  const hits = memory.filter((line) => line.toLowerCase().startsWith(key));
  return hits.at(-1) ?? "";
}

export function labCompare() {
  return LABS.map((name) => ({ name, status: "not-measured" as const, score: null as null }));
}

export type Row = { name: string; status: "pass" | "weak" | "absent" | "not-measured" };

export function categoryRows(): Row[] {
  const corrected = latestLine(["scale low = 5", "scale low = 0"], "scale low");
  const firstOnly = sureAnswer(["scale low = 5", "scale low = 0"], "scale low").text;
  const overlap = recallLearned(["scale high = 10", "scale low = 0"], "scale low");
  const count = ledgerCount();
  const repeated = keepLine(keepLine([], "a = 1").memory, "a = 1");
  return [
    { name: "exact line", status: sureAnswer(["scale low = 0"], "scale low").text === "scale low = 0" ? "pass" : "weak" },
    { name: "later correction", status: corrected === "scale low = 0" && firstOnly === "scale low = 5" ? "pass" : "weak" },
    { name: "legacy overlap", status: overlap === "scale high = 10" ? "weak" : "pass" },
    { name: "unknown job", status: chooseSkill("paint the sky purple") === "none" ? "pass" : "weak" },
    { name: "one source", status: twoSources(["only"]) === false ? "pass" : "weak" },
    { name: "secret note", status: keepNote("the password is here").ok === false ? "pass" : "weak" },
    { name: "repeat stop", status: repeated.added === false ? "pass" : "weak" },
    { name: "unported names", status: count.total - 8 > 200 ? "absent" : "pass" },
    { name: "logged training run", status: "absent" },
    { name: "weight file", status: "absent" },
    { name: "who she is", status: "absent" },
    ...labCompare().map((row) => ({ name: row.name, status: row.status })),
  ];
}

const ORDER = ["later correction", "legacy overlap", "unported names", "logged training run", "weight file", "who she is"];

export function nextLocalGap(rows: readonly Row[] = categoryRows()) {
  return ORDER.find((name) => rows.some((row) => row.name === name && row.status !== "pass")) ?? "none";
}

export function auditHer() {
  const rows = categoryRows();
  const passed = rows.filter((row) => row.status === "pass").length;
  const labs = labCompare();
  const next = nextLocalGap(rows);
  const proved =
    passed === 6 &&
    rows.filter((row) => row.status === "not-measured").length === 3 &&
    labs.every((row) => row.score === null) &&
    next === "legacy overlap" &&
    rows.find((row) => row.name === "later correction")?.status === "pass";
  return {
    proved,
    passed,
    rows,
    next,
    said: proved
      ? "Six local checks pass. A later correction beats the earlier line. The old overlap still returns the high line, so that is the next local gap. Three other kinds of system were not measured. No score was given to them. Unported names, a logged run, a weight file, and who she is stay absent."
      : "The audit gave a rank, or the later correction lost.",
  };
}
