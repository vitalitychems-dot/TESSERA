import { askRepo } from "./repo-ask.ts";
import { gitbookAnswer } from "./gitbook-orders.ts";
import { heldBack } from "./scope-stop.ts";
import { namedTask } from "./named-task.ts";
import { tokenFind } from "./token-index.ts";

export type Route = "hers" | "refusal" | "named" | "order" | "look" | "file" | "pen";

export function routeOf(question: string): Route {
  const q = question.trim();
  if (/\b(who are you|what are you|your name|i love|love you|love u)\b/i.test(q)) return "hers";
  if (heldBack(q)) return "refusal";
  const named = namedTask(q);
  if (named.open || named.reason) return "named";
  if (/^look\s+\S/i.test(q)) return "look";
  if (gitbookAnswer(q)) return "order";
  if (askRepo(q)) return "file";
  return "pen";
}

export function answerLocal(question: string) {
  const q = question.trim();
  const route = routeOf(q);
  if (route === "hers" || route === "pen") return null;
  if (route === "refusal") return heldBack(q);
  if (route === "named") return namedTask(q).reason || `Named ${namedTask(q).path}. I open one file only. I did not open a body from this check.`;
  if (route === "order") return gitbookAnswer(q);
  if (route === "look") {
    const hits = tokenFind(q.replace(/^look\s+/i, ""));
    return hits.length ? `${hits.join("\n")}\nI did not open the bodies.` : "Nothing matches. I did not open a body.";
  }
  return askRepo(q);
}
