import { readFileSync } from "node:fs";
import { chooseSkill, skillNames } from "./agent-cycle.ts";
import { sortNames } from "./agent-skills.ts";
import { evolve } from "./evolve.ts";
import { sureAnswer } from "./guard.ts";
import { examNames } from "./improve-loop.ts";
import { moltbookLine } from "./moltbook-link.ts";
import { fileFor, ledgerCount } from "./repo-ledger.ts";
import { spend } from "./rick-loop.ts";
import { remember } from "./root-skills.ts";
import { NOTE_CAP } from "./shelf.ts";
import { runDesk } from "./sovereign-desk.ts";

/** Twenty more. The ledger numbers are counted, not typed in as a wish. */

export function wave3() {
  const count = ledgerCount();
  const sum = count.picked + count.empty + count.missing + count.held + count.nota;
  const book = readFileSync("data/school/republic-excerpt.txt", "utf8");
  const books = book.split("\n").filter((line) => /^ BOOK [IVX]+\./.test(line)).length;
  return [
    count.total,
    count.picked,
    count.empty,
    count.missing,
    count.held,
    count.nota,
    sum === count.total,
    moltbookLine(401, null).includes("not attached"),
    evolve().lines,
    examNames().length,
    skillNames().length,
    NOTE_CAP,
    fileFor("appwrite").includes("mongo-init.js"),
    books,
    runDesk().rank,
    remember(2, ["a", "b"], "c").kept.length,
    sortNames(["zeta", "alpha", "alpha"]).length,
    spend(9, 2, 10).used,
    sureAnswer([], "price of tea").ok,
    chooseSkill("paint the sky purple"),
  ];
}

export function wave3ok() {
  const rows = wave3();
  const expect = [272, 81, 126, 37, 17, 11, true, true, 3, 32, 20, 100000, true, 10, "consciousness", 2, 2, 9, false, "none"];
  return rows.length === 20 && rows.every((row, index) => row === expect[index]);
}
