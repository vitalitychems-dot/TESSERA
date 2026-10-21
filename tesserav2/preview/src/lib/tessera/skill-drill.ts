import { directSkill } from "./skill-use.ts";
import { answerInContext } from "./skill-context.ts";

/** She runs the follow-ups herself. The lines are the function results. */

export function addedLines(previous: readonly string[], next: readonly string[]) {
  return next.filter((line) => line && !previous.includes(line));
}

export function drillText(added: readonly string[]) {
  return added.length ? added.join("\n") : "Nothing changed.";
}

export function skillDrill() {
  const none = answerInContext("", "again");
  const sorted = directSkill("sort zeta, alpha");
  const added = answerInContext("sort zeta, alpha", "and beta");
  const repeated = answerInContext(added?.ask ?? "", "again");
  const quoted = answerInContext("quote Our Lady of Fátima is a title. The rest stays.", "again");
  const leftAlone = answerInContext("sort zeta, alpha", "help");
  const lines = [
    none?.answer ?? "",
    sorted?.answer ?? "",
    added?.answer.split("\n")[0] ?? "",
    repeated?.ask ?? "",
    quoted?.answer.split("\n")[0] ?? "",
    leftAlone === null ? "help stays help" : "help was rewritten",
  ];
  const ok =
    none?.answer === "There is no last skill." &&
    sorted?.answer === "alpha, zeta" &&
    added?.answer.startsWith("alpha, beta, zeta") &&
    repeated?.ask === "sort zeta, alpha, beta" &&
    quoted?.skill === "quote" &&
    (quoted?.answer.startsWith("Our Lady of Fátima is a title.") ?? false) &&
    leftAlone === null;
  return { ok, lines, text: lines.filter(Boolean).join("\n") };
}
