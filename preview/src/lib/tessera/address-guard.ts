import { vowCheck } from "./learning.ts";

function partNumber(part: string) {
  if (/^0[0-7]+$/.test(part)) return Number.parseInt(part, 8);
  if (/^\d+$/.test(part)) return Number(part);
  return Number.NaN;
}

function dotted(n: number) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

function expandHost(host: string) {
  if (/^0x[0-9a-f]+$/i.test(host)) {
    const n = Number(host);
    return n >= 0 && n <= 0xffffffff ? dotted(n) : host;
  }
  const parts = host.split(".");
  if (!parts.length || parts.some((part) => Number.isNaN(partNumber(part)))) return host;
  const nums = parts.map(partNumber);
  if (nums.length === 1 && nums[0] >= 0 && nums[0] <= 0xffffffff) return dotted(nums[0]);
  if (nums.length === 2 && nums[1] <= 0xffffff) return dotted((nums[0] << 24) + nums[1]);
  if (nums.length === 3 && nums[2] <= 0xffff) return dotted((nums[0] << 24) + (nums[1] << 16) + nums[2]);
  if (nums.length === 4 && nums.every((n) => n >= 0 && n <= 255)) return nums.join(".");
  return host;
}

export function isPrivateHost(host: string) {
  const h = expandHost(host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, ""));
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "::1") return true;
  if (h.includes(":") && (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80"))) return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function allowFetch(now: number, prior: number[], limit = 30) {
  const recent = prior.filter((stamp) => now - stamp < 60 * 60 * 1000);
  if (recent.length >= limit) return { ok: false as const, count: recent.length };
  return { ok: true as const, count: recent.length + 1, next: [...recent, now] };
}

export function fetchHeading(source: string, at: string, bytes: number) {
  return `Source: ${source}. ${at}. ${bytes} bytes.`;
}

export function mayKeepReading(text: string) {
  if (/session_secret|api[_ ]?key|private key/i.test(text)) return { ok: false as const, reason: "The passage looked like a secret." };
  const vow = vowCheck(text);
  if (!vow.ok) return { ok: false as const, reason: vow.reason };
  return { ok: true as const, reason: "Kept." };
}
