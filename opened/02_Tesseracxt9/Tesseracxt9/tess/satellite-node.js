const http = require("http");
const crypto = require("crypto");
const os = require("os");

const MASTER = process.env.MASTER_ENDPOINT || "http://localhost:5000";
const PORT = parseInt(process.env.SATELLITE_PORT || "5001");
const NODE_ID = "SAT-" + crypto.randomBytes(4).toString("hex").toUpperCase();

const resources = {
  vram: parseInt(process.env.VRAM_MB || "0"),
  memory: Math.round(os.totalmem() / 1024 / 1024),
  compute: os.cpus().length * 1000,
  freeMemory: Math.round(os.freemem() / 1024 / 1024),
};

let registered = false;
let heartbeatTimer = null;

async function fetchJSON(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: opts.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Satellite-Id": NODE_ID,
        ...(opts.headers || {}),
      },
    };

    const mod = parsed.protocol === "https:" ? require("https") : http;
    const req = mod.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function registerWithMaster() {
  try {
    const data = await fetchJSON(MASTER + "/api/mesh/register", {
      method: "POST",
      body: JSON.stringify({
        endpoint: "http://" + os.hostname() + ":" + PORT,
        capabilities: ["relay", "compute", "cache", "storage"],
        resources,
      }),
    });
    registered = true;
    console.log("[Satellite] Registered with master:", data.nodeId || "ok");
  } catch (e) {
    console.log("[Satellite] Registration failed, retrying in 30s:", e.message);
    setTimeout(registerWithMaster, 30000);
  }
}

async function heartbeat() {
  if (!registered) return;
  try {
    await fetchJSON(MASTER + "/api/mesh/heartbeat", {
      method: "POST",
      body: JSON.stringify({
        nodeId: NODE_ID,
        resources: {
          ...resources,
          freeMemory: Math.round(os.freemem() / 1024 / 1024),
          uptime: process.uptime(),
        },
      }),
    });
  } catch {}
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "active",
        nodeId: NODE_ID,
        registered,
        resources: {
          ...resources,
          freeMemory: Math.round(os.freemem() / 1024 / 1024),
          uptime: process.uptime(),
        },
      })
    );
  } else if (req.url === "/relay" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const task = JSON.parse(body);
        const result = await fetchJSON(MASTER + "/api/mesh/relay", {
          method: "POST",
          body: JSON.stringify({ ...task, relayedBy: NODE_ID }),
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else if (req.url === "/compute" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          nodeId: NODE_ID,
          available: true,
          resources: {
            freeMemory: Math.round(os.freemem() / 1024 / 1024),
            cpuLoad: os.loadavg()[0],
          },
        })
      );
    });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log("[Satellite] Node " + NODE_ID + " listening on port " + PORT);
  console.log("[Satellite] Master: " + MASTER);
  console.log("[Satellite] Resources:", JSON.stringify(resources));
  registerWithMaster();
  heartbeatTimer = setInterval(heartbeat, 60000);
});
