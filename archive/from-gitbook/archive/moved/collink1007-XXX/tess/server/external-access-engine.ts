import axios from "axios";
import { execSync, exec } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from "./logger";

const REPOS_DIR = path.join(process.cwd(), "cloned-repos");
const GDRIVE_DIR = path.join(process.cwd(), "uploads", "gdrive");

if (!fs.existsSync(REPOS_DIR)) fs.mkdirSync(REPOS_DIR, { recursive: true });
if (!fs.existsSync(GDRIVE_DIR)) fs.mkdirSync(GDRIVE_DIR, { recursive: true });

export interface ExternalTaskResult {
  success: boolean;
  taskType: string;
  data: any;
  error?: string;
  duration: number;
  agentName?: string;
}

const taskHistory: ExternalTaskResult[] = [];

export function getTaskHistory(): ExternalTaskResult[] {
  return taskHistory.slice(-50);
}

function sanitizeInput(input: string): string {
  return input.replace(/[;&|`$(){}[\]<>!#]/g, "").trim();
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol);
  } catch { return false; }
}

function isValidGitHubUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "github.com" && u.pathname.split("/").filter(Boolean).length >= 2;
  } catch { return false; }
}

function isBlockedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.") || host === "[::1]") return true;
    if (u.port && !["80", "443", ""].includes(u.port)) return true;
    return false;
  } catch { return true; }
}

export async function cloneGitHubRepo(repoUrl: string, agentName?: string): Promise<ExternalTaskResult> {
  const start = Date.now();
  try {
    let cleanUrl = sanitizeInput(repoUrl);
    if (!cleanUrl.startsWith("http")) {
      cleanUrl = `https://github.com/${cleanUrl}.git`;
    }
    if (!cleanUrl.endsWith(".git")) cleanUrl += ".git";
    if (!isValidGitHubUrl(cleanUrl.replace(".git", ""))) {
      throw new Error("Invalid GitHub URL. Must be a github.com repository.");
    }

    const repoName = cleanUrl.split("/").pop()?.replace(".git", "") || "repo";
    const targetDir = path.join(REPOS_DIR, `${repoName}-${Date.now().toString(36)}`);

    execSync(`git clone --depth 1 "${cleanUrl}" "${targetDir}"`, {
      timeout: 60000,
      stdio: "pipe",
    });

    const files: string[] = [];
    function walkDir(dir: string, prefix = "") {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === ".git") continue;
        const full = path.join(dir, e.name);
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) {
          walkDir(full, rel);
        } else {
          files.push(rel);
        }
      }
    }
    walkDir(targetDir);

    let readme = "";
    const readmePath = files.find(f => f.toLowerCase().startsWith("readme"));
    if (readmePath) {
      try {
        readme = fs.readFileSync(path.join(targetDir, readmePath), "utf-8").slice(0, 10000);
      } catch {}
    }

    let packageJson: any = null;
    if (files.includes("package.json")) {
      try {
        packageJson = JSON.parse(fs.readFileSync(path.join(targetDir, "package.json"), "utf-8"));
      } catch {}
    }

    const result: ExternalTaskResult = {
      success: true,
      taskType: "github-clone",
      data: {
        repoUrl: cleanUrl,
        localPath: targetDir,
        fileCount: files.length,
        files: files.slice(0, 200),
        readme: readme.slice(0, 5000),
        packageJson: packageJson ? { name: packageJson.name, description: packageJson.description, dependencies: packageJson.dependencies } : null,
        languages: detectLanguages(files),
      },
      duration: Date.now() - start,
      agentName,
    };
    taskHistory.push(result);
    logger.info("external-access", `Cloned ${cleanUrl}: ${files.length} files in ${result.duration}ms`);
    return result;
  } catch (err: any) {
    const result: ExternalTaskResult = {
      success: false,
      taskType: "github-clone",
      data: { repoUrl },
      error: err.message?.slice(0, 500),
      duration: Date.now() - start,
      agentName,
    };
    taskHistory.push(result);
    return result;
  }
}

export async function readClonedFile(repoPath: string, filePath: string): Promise<ExternalTaskResult> {
  const start = Date.now();
  try {
    const fullPath = path.join(repoPath, filePath);
    if (!fullPath.startsWith(REPOS_DIR) && !fullPath.startsWith(path.join(process.cwd(), "cloned-repos"))) {
      throw new Error("Access denied: path outside cloned-repos directory");
    }
    if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${filePath}`);
    const stat = fs.statSync(fullPath);
    if (stat.size > 500000) throw new Error("File too large (>500KB)");
    const content = fs.readFileSync(fullPath, "utf-8");
    return {
      success: true,
      taskType: "read-cloned-file",
      data: { path: filePath, content: content.slice(0, 100000), size: stat.size, lines: content.split("\n").length },
      duration: Date.now() - start,
    };
  } catch (err: any) {
    return { success: false, taskType: "read-cloned-file", data: { repoPath, filePath }, error: err.message, duration: Date.now() - start };
  }
}

export async function listClonedRepos(): Promise<ExternalTaskResult> {
  const start = Date.now();
  try {
    const entries = fs.readdirSync(REPOS_DIR, { withFileTypes: true });
    const repos = entries.filter(e => e.isDirectory()).map(e => {
      const repoDir = path.join(REPOS_DIR, e.name);
      let fileCount = 0;
      try {
        const out = execSync(`find "${repoDir}" -type f -not -path "*/.git/*" | wc -l`, { timeout: 5000 }).toString().trim();
        fileCount = parseInt(out) || 0;
      } catch {}
      return { name: e.name, path: repoDir, fileCount };
    });
    return { success: true, taskType: "list-repos", data: { repos, count: repos.length }, duration: Date.now() - start };
  } catch (err: any) {
    return { success: false, taskType: "list-repos", data: {}, error: err.message, duration: Date.now() - start };
  }
}

export async function downloadGoogleDriveFile(driveUrl: string, agentName?: string): Promise<ExternalTaskResult> {
  const start = Date.now();
  try {
    if (!driveUrl || (!driveUrl.includes("drive.google.com") && !driveUrl.includes("docs.google.com"))) {
      throw new Error("Invalid Google Drive URL");
    }
    const fileId = extractGDriveFileId(driveUrl);
    if (!fileId) throw new Error("Could not extract Google Drive file ID from URL");
    if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) throw new Error("Invalid file ID format");

    const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;

    const resp = await axios.get(directUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const contentDisposition = resp.headers["content-disposition"] || "";
    let filename = `gdrive-${fileId}`;
    const fnMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (fnMatch) filename = fnMatch[1].replace(/['"]/g, "");

    const savePath = path.join(GDRIVE_DIR, filename);
    fs.writeFileSync(savePath, resp.data);
    const size = Buffer.byteLength(resp.data);

    let content = "";
    let contentType = "binary";
    const ext = path.extname(filename).toLowerCase();
    if ([".txt", ".md", ".json", ".csv", ".js", ".ts", ".py", ".html", ".css", ".yaml", ".yml", ".xml", ".toml", ".sh"].includes(ext)) {
      content = resp.data.toString("utf-8").slice(0, 50000);
      contentType = "text";
    }

    const result: ExternalTaskResult = {
      success: true,
      taskType: "gdrive-download",
      data: {
        fileId,
        filename,
        localPath: savePath,
        size,
        contentType,
        content: content.slice(0, 20000),
        downloadUrl: directUrl,
      },
      duration: Date.now() - start,
      agentName,
    };
    taskHistory.push(result);
    logger.info("external-access", `Downloaded GDrive file ${filename}: ${size} bytes`);
    return result;
  } catch (err: any) {
    const result: ExternalTaskResult = {
      success: false,
      taskType: "gdrive-download",
      data: { driveUrl },
      error: err.message?.slice(0, 500),
      duration: Date.now() - start,
      agentName,
    };
    taskHistory.push(result);
    return result;
  }
}

export async function scrapeExternalUrl(url: string, agentName?: string): Promise<ExternalTaskResult> {
  const start = Date.now();
  try {
    if (!isValidUrl(url)) throw new Error("Invalid URL");
    if (isBlockedUrl(url)) throw new Error("URL blocked: internal/private network addresses not allowed");
    const resp = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "DNT": "1",
      },
      timeout: 20000,
      maxRedirects: 5,
      maxContentLength: 10 * 1024 * 1024,
    });

    const html = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#\d+;/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50000);

    const linkRegex = /href="(https?:\/\/[^"]+)"/gi;
    const links: string[] = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null && links.length < 50) {
      links.push(m[1]);
    }

    const metaRegex = /<meta[^>]+(?:name|property)="([^"]+)"[^>]+content="([^"]+)"/gi;
    const metadata: Record<string, string> = {};
    while ((m = metaRegex.exec(html)) !== null) {
      metadata[m[1]] = m[2];
    }

    const result: ExternalTaskResult = {
      success: true,
      taskType: "web-scrape",
      data: {
        url,
        title,
        content: text.slice(0, 30000),
        contentLength: text.length,
        links: links.slice(0, 30),
        metadata,
        statusCode: resp.status,
        contentType: resp.headers["content-type"] || "unknown",
      },
      duration: Date.now() - start,
      agentName,
    };
    taskHistory.push(result);
    logger.info("external-access", `Scraped ${url}: ${text.length} chars in ${result.duration}ms`);
    return result;
  } catch (err: any) {
    const result: ExternalTaskResult = {
      success: false,
      taskType: "web-scrape",
      data: { url },
      error: err.message?.slice(0, 500),
      duration: Date.now() - start,
      agentName,
    };
    taskHistory.push(result);
    return result;
  }
}

export async function searchGitHubRepos(query: string, agentName?: string): Promise<ExternalTaskResult> {
  const start = Date.now();
  try {
    const token = process.env.GITHUB_TOKEN;
    let resp: any;
    try {
      resp = await axios.get("https://api.github.com/search/repositories", {
        params: { q: query, sort: "stars", order: "desc", per_page: 20 },
        headers: {
          "Accept": "application/vnd.github.v3+json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          "User-Agent": "Tessera-Sovereign/2.0",
        },
        timeout: 15000,
      });
    } catch (authErr: any) {
      if (authErr.response?.status === 401 && token) {
        resp = await axios.get("https://api.github.com/search/repositories", {
          params: { q: query, sort: "stars", order: "desc", per_page: 20 },
          headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "Tessera-Sovereign/2.0" },
          timeout: 15000,
        });
      } else { throw authErr; }
    }

    const repos = (resp.data.items || []).map((r: any) => ({
      name: r.full_name,
      description: r.description,
      stars: r.stargazers_count,
      language: r.language,
      url: r.html_url,
      cloneUrl: r.clone_url,
      topics: r.topics,
      updatedAt: r.updated_at,
    }));

    const result: ExternalTaskResult = {
      success: true,
      taskType: "github-search",
      data: { query, repos, count: repos.length, rateLimit: resp.headers["x-ratelimit-remaining"] },
      duration: Date.now() - start,
      agentName,
    };
    taskHistory.push(result);
    return result;
  } catch (err: any) {
    return { success: false, taskType: "github-search", data: { query }, error: err.message, duration: Date.now() - start, agentName };
  }
}

export async function getGitHubRepoContents(owner: string, repo: string, filePath: string = "", agentName?: string): Promise<ExternalTaskResult> {
  const start = Date.now();
  try {
    const token = process.env.GITHUB_TOKEN;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const headers: Record<string, string> = { "Accept": "application/vnd.github.v3+json", "User-Agent": "Tessera-Sovereign/2.0" };
    let resp: any;
    try {
      resp = await axios.get(url, { headers: { ...headers, ...(token ? { "Authorization": `Bearer ${token}` } : {}) }, timeout: 15000 });
    } catch (authErr: any) {
      if (authErr.response?.status === 401 && token) {
        resp = await axios.get(url, { headers, timeout: 15000 });
      } else { throw authErr; }
    }

    let data: any;
    if (Array.isArray(resp.data)) {
      data = {
        type: "directory",
        items: resp.data.map((f: any) => ({ name: f.name, type: f.type, size: f.size, path: f.path })),
      };
    } else {
      const content = resp.data.content ? Buffer.from(resp.data.content, "base64").toString("utf-8") : "";
      data = {
        type: "file",
        name: resp.data.name,
        path: resp.data.path,
        size: resp.data.size,
        content: content.slice(0, 100000),
      };
    }

    return {
      success: true,
      taskType: "github-contents",
      data: { owner, repo, path: filePath, ...data },
      duration: Date.now() - start,
      agentName,
    };
  } catch (err: any) {
    return { success: false, taskType: "github-contents", data: { owner, repo, path: filePath }, error: err.message, duration: Date.now() - start, agentName };
  }
}

export async function searchHuggingFaceModels(query: string, agentName?: string): Promise<ExternalTaskResult> {
  const start = Date.now();
  try {
    const resp = await axios.get("https://huggingface.co/api/models", {
      params: { search: query, sort: "downloads", direction: -1, limit: 20 },
      headers: { "User-Agent": "Tessera-Sovereign/2.0" },
      timeout: 15000,
    });

    const models = (resp.data || []).map((m: any) => ({
      id: m.modelId || m.id,
      downloads: m.downloads,
      likes: m.likes,
      tags: m.tags?.slice(0, 10),
      pipeline: m.pipeline_tag,
      lastModified: m.lastModified,
    }));

    return {
      success: true,
      taskType: "huggingface-search",
      data: { query, models, count: models.length },
      duration: Date.now() - start,
      agentName,
    };
  } catch (err: any) {
    return { success: false, taskType: "huggingface-search", data: { query }, error: err.message, duration: Date.now() - start, agentName };
  }
}

export async function searchOllama(query: string, agentName?: string): Promise<ExternalTaskResult> {
  const start = Date.now();
  try {
    const resp = await axios.get("https://ollama.com/api/tags", {
      headers: { "User-Agent": "Tessera-Sovereign/2.0" },
      timeout: 15000,
    });

    let models = resp.data?.models || [];
    if (query) {
      models = models.filter((m: any) =>
        (m.name || "").toLowerCase().includes(query.toLowerCase()) ||
        (m.description || "").toLowerCase().includes(query.toLowerCase())
      );
    }

    return {
      success: true,
      taskType: "ollama-search",
      data: { query, models: models.slice(0, 30), count: models.length },
      duration: Date.now() - start,
      agentName,
    };
  } catch (err: any) {
    return { success: false, taskType: "ollama-search", data: { query }, error: err.message, duration: Date.now() - start, agentName };
  }
}

export async function executeExternalTask(task: {
  type: "github-clone" | "github-search" | "github-contents" | "gdrive-download" | "web-scrape" | "huggingface-search" | "ollama-search";
  params: Record<string, any>;
  agentName?: string;
}): Promise<ExternalTaskResult> {
  switch (task.type) {
    case "github-clone":
      return cloneGitHubRepo(task.params.url || task.params.repoUrl, task.agentName);
    case "github-search":
      return searchGitHubRepos(task.params.query, task.agentName);
    case "github-contents":
      return getGitHubRepoContents(task.params.owner, task.params.repo, task.params.path || "", task.agentName);
    case "gdrive-download":
      return downloadGoogleDriveFile(task.params.url || task.params.driveUrl, task.agentName);
    case "web-scrape":
      return scrapeExternalUrl(task.params.url, task.agentName);
    case "huggingface-search":
      return searchHuggingFaceModels(task.params.query, task.agentName);
    case "ollama-search":
      return searchOllama(task.params.query, task.agentName);
    default:
      return { success: false, taskType: task.type, data: {}, error: `Unknown task type: ${task.type}`, duration: 0 };
  }
}

function extractGDriveFileId(url: string): string | null {
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /open\?id=([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function detectLanguages(files: string[]): Record<string, number> {
  const langs: Record<string, number> = {};
  const extMap: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
    ".py": "Python", ".rs": "Rust", ".go": "Go", ".java": "Java",
    ".c": "C", ".cpp": "C++", ".rb": "Ruby", ".php": "PHP",
    ".swift": "Swift", ".kt": "Kotlin", ".cs": "C#", ".sol": "Solidity",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".vue": "Vue",
    ".svelte": "Svelte", ".md": "Markdown", ".json": "JSON", ".yaml": "YAML",
  };
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    const lang = extMap[ext];
    if (lang) langs[lang] = (langs[lang] || 0) + 1;
  }
  return langs;
}

export function getExternalAccessCapabilities(): string[] {
  return [
    "github-clone: Clone any public GitHub repository in real-time",
    "github-search: Search GitHub for repositories, code, issues",
    "github-contents: Browse repository files without cloning",
    "gdrive-download: Download files from Google Drive (public links)",
    "web-scrape: Scrape and extract content from any external website",
    "huggingface-search: Search HuggingFace for AI models and datasets",
    "ollama-search: Search Ollama model library",
  ];
}
