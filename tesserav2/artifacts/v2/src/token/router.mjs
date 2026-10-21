import { countTokens } from "./meter.mjs";

export const SMALL_MODEL = "sim-small";
export const LEAD_MODEL = "sim-lead";

export function routeModel(task) {
  if (task.kind === "classify") return SMALL_MODEL;
  return LEAD_MODEL;
}

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const FENCED_BLOCK = /^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm;
const FENCE_OPENER = /^```[A-Za-z0-9_+-]+/;
const FENCE_LANG_LINE = /^```[A-Za-z0-9_+-]+[ \t]*$/gm;
const MD_IMAGE = /!\[([^\]]*)\]\(([^)\n]*)\)/g;
const MD_LINK = /\[([^\]]*)\]\(([^)\n]*)\)/g;

function linkDestination(raw) {
  const token = String(raw).trim().split(/\s+/)[0] ?? "";
  return token.replace(/^<|>$/g, "");
}

function isUrlToken(raw) {
  const dest = linkDestination(raw);
  if (!dest) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(dest)) return true;
  if (dest.startsWith("#") || dest.startsWith("/") || dest.startsWith(".")) return true;
  return dest.includes("/");
}

function stripMarkup(segment) {
  return segment
    .replace(MD_IMAGE, (full, alt, dest) => (isUrlToken(dest) ? alt : full))
    .replace(MD_LINK, (full, text, dest) => (isUrlToken(dest) ? text : full));
}

function softenFence(block) {
  return block.replace(FENCE_OPENER, "```");
}

export function compressPrompt(text) {
  const source = String(text).replace(HTML_COMMENT, " ");
  let out = "";
  let last = 0;
  FENCED_BLOCK.lastIndex = 0;
  for (const match of source.matchAll(FENCED_BLOCK)) {
    out += stripMarkup(source.slice(last, match.index));
    out += softenFence(match[0]);
    last = match.index + match[0].length;
  }
  out += stripMarkup(source.slice(last)).replace(FENCE_LANG_LINE, "```");
  return out.replace(/\s+/g, " ").trim();
}

export function compressedTokens(text) {
  return countTokens(compressPrompt(text));
}
