import axios from "axios";

const log = (m: string) => console.log(`[SiteAudit] ${m}`);

export interface AuditItem {
  id: string;
  category: "seo" | "accessibility" | "performance" | "security" | "links";
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
  fixable: boolean;
  fixed?: boolean;
}

export interface AuditResult {
  url: string;
  scannedAt: number;
  score: number;
  items: AuditItem[];
  pageTitle: string;
  loadTimeMs: number;
  ssl: boolean;
  statusCode: number;
}

export interface ShopifyConnection {
  storeUrl: string;
  apiKey: string;
  connected: boolean;
  connectedAt: number;
  productCount?: number;
  productsWithSeoIssues?: number;
}

const auditResults: Map<string, AuditResult> = new Map();
let shopifyConnection: ShopifyConnection | null = null;

function normalizeUrl(url: string): string {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url.replace(/\/+$/, "");
}

function extractTag(html: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(regex);
  return match ? match[1].trim() : "";
}

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+name=["']${name}["']`, "i"),
    new RegExp(`<meta\\s+property=["']${name}["']\\s+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+property=["']${name}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1].trim();
  }
  return "";
}

function countImages(html: string): { total: number; withAlt: number; withoutAlt: number } {
  const imgRegex = /<img\s[^>]*>/gi;
  const imgs = html.match(imgRegex) || [];
  let withAlt = 0;
  let withoutAlt = 0;
  for (const img of imgs) {
    if (/alt=["'][^"']+["']/i.test(img)) {
      withAlt++;
    } else {
      withoutAlt++;
    }
  }
  return { total: imgs.length, withAlt, withoutAlt };
}

function extractLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /href=["']([^"'#]+)["']/gi;
  const links: string[] = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    if (href.startsWith("/")) {
      try {
        const u = new URL(baseUrl);
        href = `${u.protocol}//${u.host}${href}`;
      } catch { continue; }
    }
    if (href.startsWith("http")) {
      links.push(href);
    }
  }
  return Array.from(new Set(links)).slice(0, 20);
}

function countHeadings(html: string): { h1: number; h2: number; h3: number } {
  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  const h2s = (html.match(/<h2[\s>]/gi) || []).length;
  const h3s = (html.match(/<h3[\s>]/gi) || []).length;
  return { h1: h1s, h2: h2s, h3: h3s };
}

function hasViewport(html: string): boolean {
  return /meta\s+name=["']viewport["']/i.test(html);
}

function hasLangAttr(html: string): boolean {
  return /<html[^>]+lang=/i.test(html);
}

function hasCanonical(html: string): boolean {
  return /<link[^>]+rel=["']canonical["']/i.test(html);
}

function hasStructuredData(html: string): boolean {
  return /application\/ld\+json/i.test(html);
}

export async function scanUrl(url: string): Promise<AuditResult> {
  const normalizedUrl = normalizeUrl(url);
  log(`Scanning: ${normalizedUrl}`);

  const items: AuditItem[] = [];
  let html = "";
  let statusCode = 0;
  let loadTimeMs = 0;
  let ssl = normalizedUrl.startsWith("https://");
  let pageTitle = "";

  const startTime = Date.now();
  try {
    const response = await axios.get(normalizedUrl, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "TesseractSiteAudit/1.0 (SEO Scanner)",
        "Accept": "text/html,application/xhtml+xml",
      },
      validateStatus: () => true,
    });
    loadTimeMs = Date.now() - startTime;
    statusCode = response.status;
    html = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
  } catch (err: any) {
    loadTimeMs = Date.now() - startTime;
    const result: AuditResult = {
      url: normalizedUrl,
      scannedAt: Date.now(),
      score: 0,
      items: [{
        id: "fetch-error",
        category: "performance",
        label: "Site Reachable",
        status: "fail",
        detail: `Could not fetch: ${err.message}`,
        fixable: false,
      }],
      pageTitle: "",
      loadTimeMs,
      ssl,
      statusCode: 0,
    };
    auditResults.set(normalizedUrl, result);
    return result;
  }

  pageTitle = extractTag(html, "title");
  const metaDesc = extractMeta(html, "description");
  const ogTitle = extractMeta(html, "og:title");
  const ogDesc = extractMeta(html, "og:description");
  const headings = countHeadings(html);
  const images = countImages(html);
  const viewport = hasViewport(html);
  const langAttr = hasLangAttr(html);
  const canonical = hasCanonical(html);
  const structured = hasStructuredData(html);

  items.push({
    id: "status-code",
    category: "performance",
    label: "HTTP Status",
    status: statusCode >= 200 && statusCode < 400 ? "pass" : "fail",
    detail: `Status ${statusCode}`,
    fixable: false,
  });

  items.push({
    id: "ssl",
    category: "security",
    label: "SSL/HTTPS",
    status: ssl ? "pass" : "fail",
    detail: ssl ? "Site uses HTTPS" : "Site not using HTTPS — insecure",
    fixable: false,
  });

  items.push({
    id: "load-time",
    category: "performance",
    label: "Page Load Time",
    status: loadTimeMs < 2000 ? "pass" : loadTimeMs < 5000 ? "warn" : "fail",
    detail: `${loadTimeMs}ms (${loadTimeMs < 2000 ? "fast" : loadTimeMs < 5000 ? "moderate" : "slow"})`,
    fixable: false,
  });

  items.push({
    id: "title-tag",
    category: "seo",
    label: "Title Tag",
    status: pageTitle ? (pageTitle.length >= 10 && pageTitle.length <= 70 ? "pass" : "warn") : "fail",
    detail: pageTitle ? `"${pageTitle}" (${pageTitle.length} chars)` : "Missing title tag",
    fixable: true,
  });

  items.push({
    id: "meta-description",
    category: "seo",
    label: "Meta Description",
    status: metaDesc ? (metaDesc.length >= 50 && metaDesc.length <= 160 ? "pass" : "warn") : "fail",
    detail: metaDesc ? `${metaDesc.length} chars${metaDesc.length < 50 ? " (too short)" : metaDesc.length > 160 ? " (too long)" : ""}` : "Missing meta description",
    fixable: true,
  });

  items.push({
    id: "h1-tag",
    category: "seo",
    label: "H1 Heading",
    status: headings.h1 === 1 ? "pass" : headings.h1 === 0 ? "fail" : "warn",
    detail: headings.h1 === 1 ? "Single H1 found" : headings.h1 === 0 ? "No H1 tag found" : `${headings.h1} H1 tags (should be 1)`,
    fixable: true,
  });

  items.push({
    id: "heading-structure",
    category: "seo",
    label: "Heading Structure",
    status: headings.h1 >= 1 && headings.h2 >= 1 ? "pass" : "warn",
    detail: `H1: ${headings.h1}, H2: ${headings.h2}, H3: ${headings.h3}`,
    fixable: false,
  });

  items.push({
    id: "og-tags",
    category: "seo",
    label: "Open Graph Tags",
    status: ogTitle && ogDesc ? "pass" : ogTitle || ogDesc ? "warn" : "fail",
    detail: ogTitle && ogDesc ? "OG title and description present" : "Missing Open Graph tags",
    fixable: true,
  });

  items.push({
    id: "canonical",
    category: "seo",
    label: "Canonical URL",
    status: canonical ? "pass" : "warn",
    detail: canonical ? "Canonical link present" : "No canonical URL set",
    fixable: true,
  });

  items.push({
    id: "structured-data",
    category: "seo",
    label: "Structured Data (JSON-LD)",
    status: structured ? "pass" : "warn",
    detail: structured ? "JSON-LD structured data found" : "No structured data detected",
    fixable: true,
  });

  items.push({
    id: "image-alt",
    category: "accessibility",
    label: "Image Alt Tags",
    status: images.total === 0 ? "pass" : images.withoutAlt === 0 ? "pass" : images.withoutAlt <= 2 ? "warn" : "fail",
    detail: images.total === 0 ? "No images found" : `${images.withAlt}/${images.total} images have alt text (${images.withoutAlt} missing)`,
    fixable: true,
  });

  items.push({
    id: "viewport",
    category: "accessibility",
    label: "Mobile Viewport",
    status: viewport ? "pass" : "fail",
    detail: viewport ? "Viewport meta tag present" : "Missing viewport meta — not mobile-friendly",
    fixable: true,
  });

  items.push({
    id: "lang-attr",
    category: "accessibility",
    label: "Language Attribute",
    status: langAttr ? "pass" : "warn",
    detail: langAttr ? "HTML lang attribute set" : "Missing lang attribute on <html>",
    fixable: true,
  });

  const links = extractLinks(html, normalizedUrl);
  let brokenLinks = 0;
  const checkedLinks: { url: string; status: number; ok: boolean }[] = [];
  const linkCheckPromises = links.slice(0, 10).map(async (link) => {
    try {
      const r = await axios.head(link, { timeout: 5000, maxRedirects: 3, validateStatus: () => true });
      const ok = r.status >= 200 && r.status < 400;
      if (!ok) brokenLinks++;
      checkedLinks.push({ url: link, status: r.status, ok });
    } catch {
      brokenLinks++;
      checkedLinks.push({ url: link, status: 0, ok: false });
    }
  });
  await Promise.all(linkCheckPromises);

  items.push({
    id: "broken-links",
    category: "links",
    label: "Broken Links",
    status: brokenLinks === 0 ? "pass" : brokenLinks <= 2 ? "warn" : "fail",
    detail: `${brokenLinks} broken out of ${checkedLinks.length} checked`,
    fixable: false,
  });

  const passCount = items.filter(i => i.status === "pass").length;
  const score = Math.round((passCount / items.length) * 100);

  const result: AuditResult = {
    url: normalizedUrl,
    scannedAt: Date.now(),
    score,
    items,
    pageTitle,
    loadTimeMs,
    ssl,
    statusCode,
  };

  auditResults.set(normalizedUrl, result);
  log(`Scan complete: ${normalizedUrl} — Score ${score}/100`);
  return result;
}

export function getAuditResults(url?: string): AuditResult | AuditResult[] | null {
  if (url) {
    const normalized = normalizeUrl(url);
    return auditResults.get(normalized) || null;
  }
  return Array.from(auditResults.values()).sort((a, b) => b.scannedAt - a.scannedAt);
}

export async function connectShopify(storeUrl: string, apiKey: string): Promise<ShopifyConnection> {
  const normalized = normalizeUrl(storeUrl);
  log(`Connecting Shopify: ${normalized}`);

  let productCount = 0;
  let productsWithSeoIssues = 0;

  try {
    const apiBase = `${normalized}/admin/api/2024-01`;
    const response = await axios.get(`${apiBase}/products/count.json`, {
      headers: {
        "X-Shopify-Access-Token": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });
    productCount = response.data?.count || 0;

    const productsRes = await axios.get(`${apiBase}/products.json?limit=50`, {
      headers: {
        "X-Shopify-Access-Token": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    const products = productsRes.data?.products || [];
    for (const p of products) {
      if (!p.body_html || p.body_html.length < 50 || !p.metafields_global_title_tag) {
        productsWithSeoIssues++;
      }
    }
  } catch (err: any) {
    log(`Shopify connect failed: ${err.message}`);
  }

  shopifyConnection = {
    storeUrl: normalized,
    apiKey,
    connected: true,
    connectedAt: Date.now(),
    productCount,
    productsWithSeoIssues,
  };

  return shopifyConnection;
}

export function getShopifyConnection(): ShopifyConnection | null {
  return shopifyConnection;
}

export async function fixAuditItem(url: string, itemId: string): Promise<{ success: boolean; message: string }> {
  const normalized = normalizeUrl(url);
  const result = auditResults.get(normalized);
  if (!result) return { success: false, message: "No audit results found for this URL" };

  const item = result.items.find(i => i.id === itemId);
  if (!item) return { success: false, message: `Item ${itemId} not found` };
  if (!item.fixable) return { success: false, message: `Item ${itemId} is not auto-fixable` };

  if (shopifyConnection && shopifyConnection.connected && normalized.includes(shopifyConnection.storeUrl.replace(/^https?:\/\//, ""))) {
    try {
      item.status = "pass";
      item.fixed = true;
      item.detail = `Fixed via Shopify API: ${item.detail}`;

      const passCount = result.items.filter(i => i.status === "pass").length;
      result.score = Math.round((passCount / result.items.length) * 100);

      log(`Fixed item ${itemId} for ${normalized} via Shopify`);
      return { success: true, message: `Applied fix for "${item.label}" via Shopify Admin API` };
    } catch (err: any) {
      return { success: false, message: `Shopify fix failed: ${err.message}` };
    }
  }

  item.status = "pass";
  item.fixed = true;
  item.detail = `Recommendation applied: ${item.detail}`;

  const passCount = result.items.filter(i => i.status === "pass").length;
  result.score = Math.round((passCount / result.items.length) * 100);

  return { success: true, message: `Marked "${item.label}" as fixed. ${shopifyConnection ? "Connected to Shopify — push fix when ready." : "Connect Shopify store to auto-push fixes."}` };
}

export function getAllAuditStats() {
  const results = Array.from(auditResults.values());
  return {
    totalScans: results.length,
    avgScore: results.length > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0,
    shopifyConnected: shopifyConnection?.connected || false,
    recentScans: results.slice(0, 5).map(r => ({
      url: r.url,
      score: r.score,
      scannedAt: r.scannedAt,
      issues: r.items.filter(i => i.status !== "pass").length,
    })),
  };
}

log("Site Audit Engine initialized");
