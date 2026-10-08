import fs from "fs";
import path from "path";
import crypto from "crypto";

const hlog = (m: string) => console.log(`[HumanAction] ${m}`);

export interface HumanAction {
  id: string;
  type: "login" | "2fa" | "signature" | "approval" | "captcha" | "oauth" | "verification";
  service: string;
  title: string;
  description: string;
  url?: string;
  fields: ActionField[];
  status: "pending" | "in_progress" | "completed" | "expired" | "failed";
  priority: "critical" | "high" | "medium" | "low";
  createdAt: number;
  completedAt?: number;
  expiresAt?: number;
  result?: Record<string, string>;
  savedCredential?: string;
  autoRetryable: boolean;
  requiredBy: string;
}

export interface ActionField {
  name: string;
  label: string;
  type: "text" | "password" | "code" | "url" | "select" | "checkbox";
  placeholder?: string;
  required: boolean;
  value?: string;
  options?: string[];
}

export interface SavedCredential {
  id: string;
  service: string;
  label: string;
  fields: Record<string, string>;
  cookies?: string;
  fingerprint?: string;
  lastUsed: number;
  createdAt: number;
  usageCount: number;
}

const QUEUE_FILE = path.join(process.cwd(), "server/human-action-queue.json");
const CREDS_FILE = path.join(process.cwd(), "server/saved-credentials.enc.json");
const ENCRYPTION_KEY = (() => {
  const secret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "";
  if (secret.length < 16) {
    return crypto.createHash("sha256").update(
      `tesseract-${process.env.REPL_ID || "local"}-${process.env.REPL_OWNER || "owner"}`
    ).digest("hex").slice(0, 32);
  }
  return crypto.createHash("sha256").update(secret).digest("hex").slice(0, 32);
})();

let actionQueue: HumanAction[] = [];
let savedCredentials: SavedCredential[] = [];

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text: string): string {
  try {
    const parts = text.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}

function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      actionQueue = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf-8"));
    }
  } catch { actionQueue = []; }
}

function saveQueue() {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(actionQueue, null, 2), "utf-8");
  } catch {}
}

function loadCredentials() {
  try {
    if (fs.existsSync(CREDS_FILE)) {
      const raw = fs.readFileSync(CREDS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      savedCredentials = parsed.map((c: any) => ({
        ...c,
        fields: JSON.parse(decrypt(c.encryptedFields)),
        encryptedFields: undefined,
      }));
    }
  } catch { savedCredentials = []; }
}

function saveCredentials() {
  try {
    const toSave = savedCredentials.map(c => ({
      id: c.id,
      service: c.service,
      label: c.label,
      encryptedFields: encrypt(JSON.stringify(c.fields)),
      cookies: c.cookies ? encrypt(c.cookies) : undefined,
      fingerprint: c.fingerprint,
      lastUsed: c.lastUsed,
      createdAt: c.createdAt,
      usageCount: c.usageCount,
    }));
    fs.writeFileSync(CREDS_FILE, JSON.stringify(toSave, null, 2), "utf-8");
  } catch {}
}

loadQueue();
loadCredentials();

export function createAction(action: Omit<HumanAction, "id" | "createdAt" | "status">): HumanAction {
  const existing = actionQueue.find(
    a => a.service === action.service && a.type === action.type && a.status === "pending"
  );
  if (existing) return existing;

  const savedCred = savedCredentials.find(c => c.service === action.service);
  if (savedCred && action.autoRetryable) {
    hlog(`Auto-completing ${action.service} using saved credentials`);
    const completed: HumanAction = {
      ...action,
      id: `ha-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: "completed",
      createdAt: Date.now(),
      completedAt: Date.now(),
      result: savedCred.fields,
      savedCredential: savedCred.id,
    };
    savedCred.lastUsed = Date.now();
    savedCred.usageCount++;
    saveCredentials();
    return completed;
  }

  const newAction: HumanAction = {
    ...action,
    id: `ha-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: "pending",
    createdAt: Date.now(),
  };
  actionQueue.push(newAction);
  saveQueue();
  hlog(`New action queued: ${action.type} for ${action.service} (${action.priority})`);
  return newAction;
}

export function getPendingActions(): HumanAction[] {
  return actionQueue.filter(a => a.status === "pending" || a.status === "in_progress");
}

export function getAllActions(limit = 50): HumanAction[] {
  return actionQueue.slice(-limit).reverse();
}

export function getAction(id: string): HumanAction | undefined {
  return actionQueue.find(a => a.id === id);
}

type CredentialCallback = (service: string, fields: Record<string, string>) => void;
const credentialCallbacks: CredentialCallback[] = [];

export function onCredentialSaved(cb: CredentialCallback) {
  credentialCallbacks.push(cb);
}

export function completeAction(id: string, result: Record<string, string>, saveForLater = true): HumanAction | null {
  const action = actionQueue.find(a => a.id === id);
  if (!action) return null;

  action.status = "completed";
  action.completedAt = Date.now();
  action.result = result;

  if (saveForLater) {
    const existingCred = savedCredentials.find(c => c.service === action.service);
    if (existingCred) {
      existingCred.fields = { ...existingCred.fields, ...result };
      existingCred.lastUsed = Date.now();
      existingCred.usageCount++;
    } else {
      savedCredentials.push({
        id: `cred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        service: action.service,
        label: action.title,
        fields: result,
        lastUsed: Date.now(),
        createdAt: Date.now(),
        usageCount: 1,
      });
    }
    saveCredentials();
    hlog(`Credentials saved for ${action.service} — will auto-complete next time`);

    for (const cb of credentialCallbacks) {
      try { cb(action.service, result); } catch {}
    }
  }

  saveQueue();
  hlog(`Action completed: ${action.type} for ${action.service}`);
  return action;
}

export function dismissAction(id: string): boolean {
  const action = actionQueue.find(a => a.id === id);
  if (!action) return false;
  action.status = "expired";
  saveQueue();
  return true;
}

export function getSavedServices(): Array<{ service: string; label: string; lastUsed: number; usageCount: number }> {
  return savedCredentials.map(c => ({
    service: c.service,
    label: c.label,
    lastUsed: c.lastUsed,
    usageCount: c.usageCount,
  }));
}

export function deleteSavedCredential(service: string): boolean {
  const idx = savedCredentials.findIndex(c => c.service === service);
  if (idx === -1) return false;
  savedCredentials.splice(idx, 1);
  saveCredentials();
  return true;
}

export function hasCredentialFor(service: string): boolean {
  return savedCredentials.some(c => c.service === service);
}

export function getCredentialFor(service: string): Record<string, string> | null {
  const cred = savedCredentials.find(c => c.service === service);
  if (!cred) return null;
  cred.lastUsed = Date.now();
  cred.usageCount++;
  saveCredentials();
  return cred.fields;
}

export function queueInitialActions() {
  const needsShopifyToken = !process.env.SHOPIFY_ACCESS_TOKEN;
  const needsPaypal = !hasCredentialFor("paypal");

  if (needsShopifyToken) {
    createAction({
      type: "login",
      service: "shopify",
      title: "Connect Shopify Store",
      description: "Log in to Shopify Admin to generate an access token. This lets Tessera publish blog posts and manage products on vitalitysupply.net automatically.",
      url: "https://admin.shopify.com/?organization_id=153866786",
      fields: [
        { name: "access_token", label: "Shopify Access Token", type: "password", placeholder: "shpat_...", required: true },
      ],
      priority: "critical",
      autoRetryable: true,
      requiredBy: "Blog Engine / VitalitySupply SEO",
    });
  }

  if (needsPaypal) {
    createAction({
      type: "login",
      service: "paypal",
      title: "Connect PayPal",
      description: "Log in to PayPal to enable real payment processing and withdrawal of earnings.",
      url: "https://www.paypal.com/signin",
      fields: [
        { name: "email", label: "PayPal Email", type: "text", placeholder: "your-email@example.com", required: true },
        { name: "session_cookie", label: "Session Cookie (after login)", type: "password", placeholder: "Paste cookie value", required: false },
      ],
      priority: "high",
      autoRetryable: true,
      requiredBy: "Income Engine / Withdrawals",
    });
  }

  if (!hasCredentialFor("klaviyo")) {
    createAction({
      type: "login",
      service: "klaviyo",
      title: "Connect Klaviyo Email Marketing",
      description: "Set up the welcome email flow and audience capture for VitalitySupply customers.",
      url: "https://www.klaviyo.com/onboarding/grow-your-audience?taskSlug=create-welcome-flow-email",
      fields: [
        { name: "api_key", label: "Klaviyo API Key", type: "password", placeholder: "pk_...", required: true },
      ],
      priority: "high",
      autoRetryable: true,
      requiredBy: "Email Marketing / Conversion",
    });
  }

  if (!hasCredentialFor("google_search_console")) {
    createAction({
      type: "oauth",
      service: "google_search_console",
      title: "Connect Google Search Console",
      description: "Submit sitemap and monitor organic search traffic for vitalitysupply.net blog posts.",
      url: "https://search.google.com/search-console",
      fields: [
        { name: "verified", label: "Site Verified?", type: "checkbox", required: true },
        { name: "sitemap_submitted", label: "Sitemap URL Submitted?", type: "checkbox", required: false },
      ],
      priority: "medium",
      autoRetryable: false,
      requiredBy: "SEO / Organic Traffic",
    });
  }

  if (!hasCredentialFor("google_analytics")) {
    createAction({
      type: "login",
      service: "google_analytics",
      title: "Set Up Google Analytics",
      description: "Add GA4 tracking to VitalitySupply to measure real traffic from AI-generated blog posts.",
      url: "https://analytics.google.com/",
      fields: [
        { name: "measurement_id", label: "GA4 Measurement ID", type: "text", placeholder: "G-XXXXXXXXXX", required: true },
      ],
      priority: "medium",
      autoRetryable: true,
      requiredBy: "Traffic Analytics",
    });
  }

  if (!hasCredentialFor("google_adsense")) {
    createAction({
      type: "login",
      service: "google_adsense",
      title: "Set Up Google AdSense",
      description: "Enable display ads on the blog to generate revenue from organic traffic.",
      url: "https://www.google.com/adsense/",
      fields: [
        { name: "publisher_id", label: "AdSense Publisher ID", type: "text", placeholder: "ca-pub-XXXXXXXXXX", required: true },
      ],
      priority: "medium",
      autoRetryable: true,
      requiredBy: "Ad Revenue",
    });
  }

  if (!hasCredentialFor("product_hunt")) {
    createAction({
      type: "login",
      service: "product_hunt",
      title: "Launch on Product Hunt",
      description: "Submit the Tesseract as a product launch to drive awareness and early adopters.",
      url: "https://www.producthunt.com/posts/new",
      fields: [
        { name: "submitted", label: "Product Submitted?", type: "checkbox", required: true },
        { name: "launch_url", label: "Product Hunt URL", type: "url", placeholder: "https://producthunt.com/posts/...", required: false },
      ],
      priority: "low",
      autoRetryable: false,
      requiredBy: "Growth / Community",
    });
  }

  const pending = getPendingActions();
  if (pending.length > 0) {
    hlog(`${pending.length} actions require human attention`);
  }
}

hlog("Human Action Queue initialized");
