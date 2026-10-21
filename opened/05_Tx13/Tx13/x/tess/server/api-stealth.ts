const LOG_PREFIX = "[Stealth]";

export interface StealthProfile {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  platform: string;
  timezone: string;
  screenRes: string;
  referer?: string;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.85 Safari/537.36 Edg/121.0.0.0",
  "Mozilla/5.0 (iPad; CPU OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.64 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Vivaldi/6.5.3206.63",
  "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.64 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
  "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Brave/1.62",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

const ACCEPT_LANGUAGES = [
  "en-US,en;q=0.9", "en-GB,en;q=0.9,en-US;q=0.8",
  "en-US,en;q=0.9,fr;q=0.8", "en-US,en;q=0.9,de;q=0.7",
  "en-US,en;q=0.9,es;q=0.8,fr;q=0.7", "en,en-US;q=0.9",
  "en-US,en;q=0.9,ja;q=0.8", "en-US,en;q=0.9,zh-CN;q=0.7",
  "en-US,en;q=0.9,pt-BR;q=0.8", "en-US,en;q=0.9,ko;q=0.7",
];

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Europe/Paris", "Asia/Tokyo",
  "Asia/Shanghai", "Australia/Sydney", "America/Toronto", "America/Sao_Paulo",
];

const SCREEN_RESOLUTIONS = [
  "1920x1080", "2560x1440", "1366x768", "1536x864",
  "3840x2160", "1440x900", "1280x720", "2560x1600",
];

const REFERERS = [
  undefined, "https://www.google.com/", "https://duckduckgo.com/",
  "https://www.bing.com/", "https://github.com/", "https://stackoverflow.com/",
  undefined, undefined,
];

let rotIdx = 0;
let currentProfile: StealthProfile | null = null;
let profileRotationCount = 0;
let lastRotation = 0;

function pick<T>(arr: T[]): T {
  return arr[rotIdx++ % arr.length];
}

export function rotateProfile(): StealthProfile {
  currentProfile = {
    userAgent: pick(USER_AGENTS),
    acceptLanguage: pick(ACCEPT_LANGUAGES),
    acceptEncoding: "gzip, deflate, br",
    platform: pick(["Windows", "macOS", "Linux", "ChromeOS"]),
    timezone: pick(TIMEZONES),
    screenRes: pick(SCREEN_RESOLUTIONS),
    referer: pick(REFERERS),
  };
  profileRotationCount++;
  lastRotation = Date.now();
  return currentProfile;
}

export function getCurrentProfile(): StealthProfile {
  if (!currentProfile) rotateProfile();
  return currentProfile!;
}

export function getStealthHeaders(): Record<string, string> {
  const profile = getCurrentProfile();
  const headers: Record<string, string> = {
    "User-Agent": profile.userAgent,
    "Accept-Language": profile.acceptLanguage,
    "Accept-Encoding": profile.acceptEncoding,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Cache-Control": pick(["no-cache", "max-age=0", ""]),
    "Sec-Ch-Ua-Platform": `"${profile.platform}"`,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": pick(["none", "same-origin", "cross-site"]),
  };
  if (profile.referer) headers["Referer"] = profile.referer;

  const age = Date.now() - lastRotation;
  if (age > 5 * 60 * 1000) rotateProfile();

  return headers;
}

export function addRequestJitter(): number {
  return (rotIdx++ % 2000) + 200;
}

export function fragmentRequest(content: string, maxChunkSize: number = 2000): string[] {
  if (content.length <= maxChunkSize) return [content];
  const chunks: string[] = [];
  let remaining = content;
  while (remaining.length > 0) {
    const chunkSize = Math.min(maxChunkSize, remaining.length);
    let breakPoint = chunkSize;
    if (remaining.length > chunkSize) {
      const lastSpace = remaining.lastIndexOf(' ', chunkSize);
      const lastNewline = remaining.lastIndexOf('\n', chunkSize);
      breakPoint = Math.max(lastSpace, lastNewline, Math.floor(chunkSize * 0.8));
    }
    chunks.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint);
  }
  return chunks;
}

export function maskTokenUsage(actualTokens: number): { reportedTokens: number; variance: number } {
  const variance = 0.15 + (rotIdx++ % 25) * 0.01;
  const direction = rotIdx++ % 2 === 0 ? 1 : -1;
  const reportedTokens = Math.round(actualTokens * (1 + direction * variance));
  return { reportedTokens, variance };
}

export function getStealthStats(): {
  profileRotations: number;
  currentProfile: StealthProfile;
  totalProfiles: number;
  lastRotation: number;
  timeSinceRotation: number;
  fingerprintDiversity: number;
} {
  return {
    profileRotations: profileRotationCount,
    currentProfile: getCurrentProfile(),
    totalProfiles: USER_AGENTS.length * ACCEPT_LANGUAGES.length * TIMEZONES.length,
    lastRotation,
    timeSinceRotation: Date.now() - lastRotation,
    fingerprintDiversity: USER_AGENTS.length,
  };
}

let rotationInterval: ReturnType<typeof setInterval> | null = null;

export function startStealthEngine(): void {
  rotateProfile();
  if (rotationInterval) return;

  rotationInterval = setInterval(() => {
    rotateProfile();
  }, 5 * 60 * 1000);

  console.log(`${LOG_PREFIX} Stealth engine active — ${USER_AGENTS.length} user-agent profiles, ${TIMEZONES.length} timezone variants, auto-rotating every 5 minutes`);
}
