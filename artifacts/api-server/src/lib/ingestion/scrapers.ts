import { htmlToText } from "./pipeline";
import { safeFetch } from "../safe-fetch";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Tessera-Bot/1.0 (research; +https://tessera.app)",
];

let userAgentIndex = 0;
function nextUserAgent(): string {
  const ua = USER_AGENTS[userAgentIndex % USER_AGENTS.length];
  userAgentIndex++;
  return ua;
}

const domainRateLimits: Map<string, number> = new Map();
const RATE_LIMIT_MS = 2000;

async function waitForRateLimit(url: string): Promise<void> {
  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  const lastFetch = domainRateLimits.get(domain) || 0;
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastFetch);
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
  domainRateLimits.set(domain, Date.now());
}

export async function rateLimitedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  await waitForRateLimit(url);

  const result = await safeFetch(url, {
    ...options,
    headers: {
      "User-Agent": nextUserAgent(),
      "Accept": "application/json, text/html, application/xml, */*",
      "Accept-Language": "en-US,en;q=0.9",
      ...(options.headers || {}),
    },
    timeoutMs: 15000,
    providerId: "scraper",
    providerName: "Tessera Scraper",
  });

  const body = result.data;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status: result.status });
}

export async function fetchJson<T = unknown>(url: string, headers: Record<string, string> = {}): Promise<T> {
  await waitForRateLimit(url);

  const { safeFetchJson } = await import("../safe-fetch");
  return safeFetchJson<T>(url, {
    headers: {
      "User-Agent": nextUserAgent(),
      "Accept": "application/json",
      ...headers,
    },
    timeoutMs: 15000,
    providerId: "scraper",
    providerName: "Tessera Scraper",
  });
}

export async function fetchText(url: string): Promise<string> {
  await waitForRateLimit(url);

  const { safeFetchText } = await import("../safe-fetch");
  return safeFetchText(url, {
    headers: {
      "User-Agent": nextUserAgent(),
      "Accept": "text/html, application/xml, */*",
    },
    timeoutMs: 15000,
    providerId: "scraper",
    providerName: "Tessera Scraper",
  });
}

export async function fetchAndParse(url: string): Promise<string> {
  const html = await fetchText(url);
  return htmlToText(html);
}
