import { CATALOG } from "./catalog-pass.ts";
import { assignAgent } from "./craft.ts";
import { recognizeEmpathy } from "./empath.ts";

const CLOSED = new Set(["tool", "held", "gap"]);

/** One walk across the catalog, the desk, and the pattern labels. It does not fetch a repository. */
export function joinAsk(text: string) {
  const agent = assignAgent(text);
  const pattern = recognizeEmpathy(text)[0]?.label ?? "none";
  const q = text.toLowerCase();
  const row = CATALOG.find((item) => {
    const short = item.name.split("/").pop()?.toLowerCase() ?? "";
    return short.length > 6 && q.includes(short);
  });
  if (!row) {
    return {
      connected: false,
      name: "",
      home: "",
      agent: agent.agent,
      pattern,
      line: `JOIN: no catalog name in the question. ${agent.agent} answers. Pattern: ${pattern}. Nothing was fetched.`,
    };
  }
  if (CLOSED.has(row.home) || row.state === "missing") {
    return {
      connected: false,
      name: row.name,
      home: row.home,
      agent: agent.agent,
      pattern,
      line: `JOIN: ${row.name} stays ${row.home}. It was not connected and not cloned.`,
    };
  }
  return {
    connected: true,
    name: row.name,
    home: row.home,
    agent: agent.agent,
    pattern,
    line: `JOIN: ${row.name} is already at ${row.home}. Use that home. Do not copy it again.`,
  };
}
