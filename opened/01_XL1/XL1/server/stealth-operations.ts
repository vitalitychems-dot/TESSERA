interface Browser {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

interface Page {
  setUserAgent(ua: string): Promise<void>;
  setViewport(viewport: { width: number; height: number }): Promise<void>;
  setExtraHTTPHeaders(headers: Record<string, string>): Promise<void>;
  authenticate(credentials: { username: string; password: string }): Promise<void>;
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  content(): Promise<string>;
  evaluate<T>(fn: (...args: unknown[]) => T, ...args: unknown[]): Promise<T>;
  close(): Promise<void>;
}

const LOG_PREFIX = "[StealthOps]";

interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

interface DisposableEmail {
  address: string;
  login: string;
  domain: string;
  provider: "mailtm" | "tempmail_lol" | "1secmail" | "guerrillamail";
  sessionId?: string;
  accountId?: string;
  jwtToken?: string;
  password?: string;
}

interface EmailMessage {
  id: number | string;
  from: string;
  subject: string;
  date: string;
  body?: string;
}

interface TemporaryPhone {
  number: string;
  country: string;
  provider: string;
}

interface SMSMessage {
  from: string;
  message: string;
  date: string;
}

interface CaptchaSolution {
  id: string;
  solution: string;
  cost?: string;
}

const STEALTH_HEADERS: Record<string, string> = {
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
};

const HEADERS_TO_STRIP = [
  "x-forwarded-for",
  "x-real-ip",
  "x-client-ip",
  "via",
  "forwarded",
  "x-originating-ip",
  "x-remote-addr",
  "x-cluster-client-ip",
];

let proxyList: ProxyConfig[] = [];
let currentProxyIndex = 0;

function stripIdentifyingHeaders(headers: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!HEADERS_TO_STRIP.includes(key.toLowerCase())) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

async function stealthFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = stripIdentifyingHeaders({
    ...STEALTH_HEADERS,
    ...(options.headers as Record<string, string> || {}),
  });

  const proxy = proxyList.length > 0 ? proxyList[currentProxyIndex % proxyList.length] : null;
  if (proxy) {
    currentProxyIndex++;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    signal: controller.signal,
  };

  try {
    if (proxy) {
      const proxyUrl = proxy.username
        ? `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
        : `http://${proxy.host}:${proxy.port}`;
      const { HttpsProxyAgent } = await import("https-proxy-agent") as any;
      (fetchOptions as any).agent = new HttpsProxyAgent(proxyUrl);
    }
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeout);
    return response;
  } catch (error) {
    console.log(`${LOG_PREFIX} Fetch error for ${url}: ${(error as Error).message}`);
    throw error;
  }
}

export async function createStealthBrowser(options: {
  proxy?: ProxyConfig;
  headless?: boolean;
} = {}): Promise<{ browser: Browser; page: Page }> {
  console.log(`${LOG_PREFIX} Creating stealth browser instance...`);

  try {
    const puppeteer = (await import("puppeteer-extra")).default;
    const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;

    puppeteer.use(StealthPlugin());

    const launchArgs: string[] = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1920,1080",
    ];

    if (options.proxy) {
      launchArgs.push(`--proxy-server=${options.proxy.host}:${options.proxy.port}`);
    }

    const browser = await puppeteer.launch({
      headless: options.headless !== false,
      args: launchArgs,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.setViewport({ width: 1920, height: 1080 });

    await page.setExtraHTTPHeaders(stripIdentifyingHeaders(STEALTH_HEADERS));

    if (options.proxy?.username && options.proxy?.password) {
      await page.authenticate({
        username: options.proxy.username,
        password: options.proxy.password,
      });
    }

    console.log(`${LOG_PREFIX} Stealth browser created successfully`);
    return { browser, page };
  } catch (error) {
    console.log(`${LOG_PREFIX} Failed to create stealth browser: ${(error as Error).message}`);
    throw error;
  }
}

export async function createDisposableEmail(): Promise<DisposableEmail> {
  console.log(`${LOG_PREFIX} Creating disposable email...`);

  try {
    const domainResp = await fetch("https://api.mail.tm/domains", { signal: AbortSignal.timeout(10000) });
    if (!domainResp.ok) throw new Error("mail.tm domains failed");
    const domainData = await domainResp.json() as any;
    const activeDomain = domainData["hydra:member"]?.find((d: any) => d.isActive)?.domain;
    if (!activeDomain) throw new Error("No active mail.tm domain");

    const login = `tessera${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const address = `${login}@${activeDomain}`;
    const password = `Tx${Date.now().toString(36)}!${Math.random().toString(36).slice(2, 8)}`;

    const createResp = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
      signal: AbortSignal.timeout(10000),
    });
    if (!createResp.ok) throw new Error(`mail.tm account creation failed: ${createResp.status}`);
    const account = await createResp.json() as any;

    const tokenResp = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResp.ok) throw new Error("mail.tm token failed");
    const tokenData = await tokenResp.json() as any;

    console.log(`${LOG_PREFIX} Disposable email created via mail.tm: ${address}`);
    return {
      address,
      login,
      domain: activeDomain,
      provider: "mailtm",
      accountId: account.id,
      jwtToken: tokenData.token,
      password,
    };
  } catch (primaryError) {
    console.log(`${LOG_PREFIX} mail.tm failed: ${(primaryError as Error).message}, trying TempMail.lol...`);

    try {
      const response = await fetch("https://api.tempmail.lol/generate", { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("TempMail.lol failed");
      const data = await response.json() as { address: string; token: string };
      const [login, domain] = data.address.split("@");
      console.log(`${LOG_PREFIX} Disposable email created via TempMail.lol: ${data.address}`);
      return {
        address: data.address,
        login,
        domain,
        provider: "tempmail_lol",
        sessionId: data.token,
      };
    } catch (fallbackError) {
      console.log(`${LOG_PREFIX} All email providers failed: ${(fallbackError as Error).message}`);
      throw new Error("Failed to create disposable email from all providers");
    }
  }
}

export async function checkEmailInbox(email: DisposableEmail): Promise<EmailMessage[]> {
  console.log(`${LOG_PREFIX} Checking inbox for ${email.address}...`);

  try {
    if (email.provider === "mailtm" && email.jwtToken) {
      const response = await fetch("https://api.mail.tm/messages", {
        headers: { Authorization: `Bearer ${email.jwtToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json() as any;
        const messages = data["hydra:member"] || [];
        console.log(`${LOG_PREFIX} Found ${messages.length} messages in mail.tm inbox`);
        return messages.map((m: any) => ({
          id: m.id,
          from: m.from?.address || m.from?.name || "unknown",
          subject: m.subject || "(no subject)",
          date: m.createdAt || m.date || new Date().toISOString(),
          body: m.intro || m.text || "",
        }));
      }
    } else if (email.provider === "tempmail_lol" && email.sessionId) {
      const response = await fetch(`https://api.tempmail.lol/auth/${email.sessionId}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json() as { email: Array<{ from: string; subject: string; date: string; body: string; html: string }> };
        const messages = data.email || [];
        console.log(`${LOG_PREFIX} Found ${messages.length} messages in TempMail.lol inbox`);
        return messages.map((m, i) => ({
          id: `tm-${i}-${Date.now()}`,
          from: m.from || "unknown",
          subject: m.subject || "(no subject)",
          date: m.date || new Date().toISOString(),
          body: m.body || m.html || "",
        }));
      }
    } else if (email.provider === "1secmail") {
      const response = await stealthFetch(
        `https://www.1secmail.com/api/v1/?action=getMessages&login=${encodeURIComponent(email.login)}&domain=${encodeURIComponent(email.domain)}`
      );
      if (response.ok) {
        const messages = (await response.json()) as Array<{ id: number; from: string; subject: string; date: string }>;
        return messages.map((m) => ({ id: m.id, from: m.from, subject: m.subject, date: m.date }));
      }
    } else if (email.provider === "guerrillamail" && email.sessionId) {
      const response = await stealthFetch(
        `https://api.guerrillamail.com/ajax.php?f=check_email&sid_token=${encodeURIComponent(email.sessionId)}&seq=0`
      );
      if (response.ok) {
        const data = (await response.json()) as { list: Array<{ mail_id: string; mail_from: string; mail_subject: string; mail_date: string; mail_body: string }> };
        return (data.list || []).map((m) => ({ id: m.mail_id, from: m.mail_from, subject: m.mail_subject, date: m.mail_date, body: m.mail_body }));
      }
    }

    return [];
  } catch (error) {
    console.log(`${LOG_PREFIX} Failed to check inbox: ${(error as Error).message}`);
    return [];
  }
}

export async function readEmailMessage(email: DisposableEmail, msgId: string): Promise<any> {
  try {
    if (email.provider === "mailtm" && email.jwtToken) {
      const resp = await fetch(`https://api.mail.tm/messages/${msgId}`, {
        headers: { Authorization: `Bearer ${email.jwtToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        return { body: data.text || data.html?.[0] || data.intro || "", subject: data.subject, from: data.from?.address || "unknown", date: data.createdAt };
      }
    } else if (email.provider === "tempmail_lol" && email.sessionId) {
      const resp = await fetch(`https://api.tempmail.lol/auth/${email.sessionId}`, { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const data = await resp.json() as any;
        const messages = data.email || [];
        const msg = messages.find((_: any, i: number) => msgId === `tm-${i}-${msgId.split("-").pop()}`);
        if (msg) return { body: msg.body || msg.html || "", subject: msg.subject, from: msg.from, date: msg.date };
        if (messages.length > 0) return { body: messages[0].body || messages[0].html || "", subject: messages[0].subject, from: messages[0].from, date: messages[0].date };
      }
    } else if (email.provider === "1secmail") {
      const resp = await fetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${encodeURIComponent(email.login)}&domain=${encodeURIComponent(email.domain)}&id=${encodeURIComponent(msgId)}`, { signal: AbortSignal.timeout(10000) });
      if (resp.ok) return await resp.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function getTemporaryPhone(): Promise<TemporaryPhone> {
  console.log(`${LOG_PREFIX} Getting temporary phone number...`);

  try {
    const response = await stealthFetch("https://receive-smss.com/");

    if (response.ok) {
      const html = await response.text();
      const phoneMatch = html.match(/\+\d{10,15}/);
      if (phoneMatch) {
        console.log(`${LOG_PREFIX} Temporary phone obtained: ${phoneMatch[0]}`);
        return {
          number: phoneMatch[0],
          country: "US",
          provider: "receive-smss",
        };
      }
    }

    console.log(`${LOG_PREFIX} Primary SMS provider unavailable, using fallback`);
    return {
      number: "+10000000000",
      country: "US",
      provider: "fallback-pending",
    };
  } catch (error) {
    console.log(`${LOG_PREFIX} Failed to get temporary phone: ${(error as Error).message}`);
    return {
      number: "+10000000000",
      country: "US",
      provider: "fallback-pending",
    };
  }
}

export async function checkSMSMessages(phone: TemporaryPhone): Promise<SMSMessage[]> {
  console.log(`${LOG_PREFIX} Checking SMS messages for ${phone.number}...`);

  try {
    const cleanNumber = phone.number.replace(/\+/g, "");
    const response = await stealthFetch(
      `https://receive-smss.com/sms/${cleanNumber}/`
    );

    if (response.ok) {
      const html = await response.text();
      const messages: SMSMessage[] = [];

      const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
      let match;
      while ((match = rowRegex.exec(html)) !== null) {
        const from = match[1].replace(/<[^>]*>/g, "").trim();
        const message = match[2].replace(/<[^>]*>/g, "").trim();
        const date = match[3].replace(/<[^>]*>/g, "").trim();
        if (from && message) {
          messages.push({ from, message, date });
        }
      }

      console.log(`${LOG_PREFIX} Found ${messages.length} SMS messages`);
      return messages;
    }

    return [];
  } catch (error) {
    console.log(`${LOG_PREFIX} Failed to check SMS messages: ${(error as Error).message}`);
    return [];
  }
}

export async function solveCaptcha(options: {
  siteKey: string;
  pageUrl: string;
  type?: "recaptcha" | "hcaptcha" | "image";
  imageBase64?: string;
}): Promise<CaptchaSolution> {
  const apiKey = process.env.TWOCAPTCHA_API_KEY;
  if (!apiKey) {
    throw new Error("TWOCAPTCHA_API_KEY environment variable is not set");
  }

  console.log(`${LOG_PREFIX} Solving CAPTCHA (type: ${options.type || "recaptcha"})...`);

  try {
    let submitUrl: string;

    if (options.type === "image" && options.imageBase64) {
      submitUrl = `https://2captcha.com/in.php?key=${apiKey}&method=base64&body=${encodeURIComponent(options.imageBase64)}&json=1`;
    } else if (options.type === "hcaptcha") {
      submitUrl = `https://2captcha.com/in.php?key=${apiKey}&method=hcaptcha&sitekey=${encodeURIComponent(options.siteKey)}&pageurl=${encodeURIComponent(options.pageUrl)}&json=1`;
    } else {
      submitUrl = `https://2captcha.com/in.php?key=${apiKey}&method=userrecaptcha&googlekey=${encodeURIComponent(options.siteKey)}&pageurl=${encodeURIComponent(options.pageUrl)}&json=1`;
    }

    const submitResponse = await stealthFetch(submitUrl);
    const submitData = (await submitResponse.json()) as {
      status: number;
      request: string;
    };

    if (submitData.status !== 1) {
      throw new Error(`CAPTCHA submit failed: ${submitData.request}`);
    }

    const captchaId = submitData.request;
    console.log(`${LOG_PREFIX} CAPTCHA submitted, ID: ${captchaId}. Polling for solution...`);

    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const resultResponse = await stealthFetch(
        `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`
      );
      const resultData = (await resultResponse.json()) as {
        status: number;
        request: string;
      };

      if (resultData.status === 1) {
        console.log(`${LOG_PREFIX} CAPTCHA solved successfully`);
        return {
          id: captchaId,
          solution: resultData.request,
        };
      }

      if (resultData.request !== "CAPCHA_NOT_READY") {
        throw new Error(`CAPTCHA solve failed: ${resultData.request}`);
      }
    }

    throw new Error("CAPTCHA solve timed out after max attempts");
  } catch (error) {
    console.log(`${LOG_PREFIX} CAPTCHA solving failed: ${(error as Error).message}`);
    throw error;
  }
}

export function rotateProxy(proxies?: ProxyConfig[]): ProxyConfig | null {
  if (proxies && proxies.length > 0) {
    proxyList = proxies;
  }

  if (proxyList.length === 0) {
    console.log(`${LOG_PREFIX} No proxies available for rotation`);
    return null;
  }

  currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
  const proxy = proxyList[currentProxyIndex];
  console.log(`${LOG_PREFIX} Rotated to proxy ${currentProxyIndex + 1}/${proxyList.length}: ${proxy.host}:${proxy.port}`);
  return proxy;
}

export function init() {
  console.log(`${LOG_PREFIX} Stealth Operations Engine initialized`);
  console.log(`${LOG_PREFIX} Capabilities: anonymous browsing, CAPTCHA solving, proxy rotation, disposable email, temporary SMS`);
  console.log(`${LOG_PREFIX} 2Captcha API key: ${process.env.TWOCAPTCHA_API_KEY ? "configured" : "not set"}`);
  console.log(`${LOG_PREFIX} Proxy pool: ${proxyList.length} proxies loaded`);
}

init();
