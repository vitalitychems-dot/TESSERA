/**
 * Studio page: 3D floor by default, 2D task wall as a toggle.
 * Clean-room board. No Minecraft client.
 */
import { createServer, request as httpRequest } from "node:http";
import { connect as netConnect } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createCivic, presentWorld } from "./civic.mjs";
import { loadCivic, saveCivic } from "./civic-store.mjs";
import { floorMarkup, studioView } from "./floor.mjs";
import { acceptWebSocket, liveMessages, textFrame } from "./live.mjs";
import { applyShip } from "./ship.mjs";
import { createForeman } from "./task-graph.mjs";
import { createMonitor } from "./worker-stream.mjs";
import { buildWorld, readBuildLog } from "./world.mjs";
import { handleBrain } from "../brain/http.mjs";
import { reviewRequest } from "../hyb011-denylist.mjs";
import { dispatch, mountPath, readSession } from "../../../gitai/src/server.mjs";
import { seedDemo } from "../../../gitai/src/seed.mjs";
import { createLiveFeed } from "../../../gitai/src/ws.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function createStudio() {
  const foreman = createForeman();
  const goals = [];
  return {
    foreman,
    postGoal(goal) {
      const text = String(goal ?? "").trim();
      if (!text) throw new Error("goal required");
      const n = goals.length + 1;
      goals.push(text);
      const plan = foreman.addTask({ id: `g${n}-plan`, title: `Plan: ${text}` });
      const work = foreman.addTask({ id: `g${n}-work`, title: `Work: ${text}`, dependsOn: [plan.id] });
      return { goal: text, tasks: [plan, work] };
    },
    runNext() {
      const next = foreman.snapshot().tasks.find((item) => item.status === "pending");
      if (!next) return null;
      return foreman.start(next.id);
    },
    finishRunning() {
      const running = foreman.snapshot().tasks.find((item) => item.status === "running");
      if (!running) return null;
      return foreman.complete(running.id);
    },
    state() {
      const snap = foreman.snapshot();
      const busy = snap.tasks.some((task) => task.status === "running" || task.status === "pending");
      return {
        goals,
        tasks: snap.tasks,
        decisions: snap.decisions,
        desks: [
          { id: "tessera", role: "lead", lamp: "idle" },
          { id: "worker", role: "worker", lamp: busy ? "busy" : "idle" },
        ],
      };
    },
  };
}

export function defaultBuildLogPath() {
  return join(HERE, "../../../../docs/v2/BUILD-LOG.md");
}

export function threeBuildDir() {
  const candidates = [
    join(HERE, "../../node_modules/three/build"),
    join(HERE, "../../../../node_modules/three/build"),
    join(HERE, "../../../../node_modules/.pnpm"),
  ];
  for (const dir of candidates.slice(0, 2)) {
    if (existsSync(join(dir, "three.module.js"))) return dir;
  }
  return null;
}

function loadLog(path) {
  try {
    return readBuildLog(readFileSync(path, "utf8"));
  } catch {
    return [];
  }
}

function latestMemory(civic, id) {
  const entity = (civic.graph?.entities ?? []).find((item) => item.name === id);
  const observations = entity?.observations ?? [];
  return observations[observations.length - 1] ?? "";
}

function renderCivic(civic) {
  const agents = Object.values(civic.agents ?? {});
  const total = agents.length || 1;
  const proposals = (civic.proposals ?? [])
    .map((proposal) => {
      const yes = Object.values(proposal.votes ?? {}).filter((vote) => vote === "yes").length;
      return `<li class="proposal" data-status="${escapeHtml(proposal.status)}" data-proposal="${escapeHtml(proposal.id)}"><span class="proposal-title">${escapeHtml(proposal.title)}</span> <span class="tally">${yes}/${total}</span> <span class="proposal-status">${escapeHtml(proposal.status)}</span></li>`;
    })
    .join("");
  const rules = (civic.rules ?? []).map((rule) => `<li class="rule">${escapeHtml(rule)}</li>`).join("");
  const neighborhoods = Object.values(civic.neighborhoods ?? {})
    .map((hood) => {
      const names = (hood.members ?? []).map((id) => civic.agents?.[id]?.name ?? id);
      const lives = (hood.members ?? [])
        .map((id) => {
          const agent = civic.agents?.[id];
          if (!agent) return "";
          const memory = latestMemory(civic, id);
          return `<p class="life" data-agent="${escapeHtml(id)}">${escapeHtml(agent.name)} · level ${agent.home.level} · ${escapeHtml(agent.life.now)} · ${escapeHtml(agent.life.activity)}</p>${memory ? `<p class="memory">${escapeHtml(memory)}</p>` : ""}`;
        })
        .join("");
      return `<article class="neighborhood" data-neighborhood="${escapeHtml(hood.id)}"><h3>${escapeHtml(hood.name)}</h3><p>${escapeHtml(names.join(", "))}</p>${lives}</article>`;
    })
    .join("");
  const shipments = (civic.shipments ?? [])
    .map((shipment) => {
      const proposalId = String(shipment.proposalId ?? "");
      const objectId = String(shipment.objectId ?? "");
      const taskId = String(shipment.taskId ?? "");
      const branch = String(shipment.branch ?? "");
      const status = taskId ? `real task ${taskId}` : String(shipment.status ?? "approved");
      const tests = shipment.testsPassed === true ? "tests passed" : shipment.testsPassed === false ? "tests pending" : "";
      const prTitle = String(shipment.prDraft?.title ?? "");
      const prBlock = prTitle
        ? `<span class="shipment-pr">${escapeHtml(prTitle)} · ${escapeHtml(branch)} · draft</span>`
        : branch
          ? `<span class="shipment-pr">${escapeHtml(branch)} · draft</span>`
          : "";
      return `<li class="shipment" data-shipment="${escapeHtml(proposalId)}"><span class="shipment-object">${escapeHtml(objectId)}</span> <span class="shipment-status">${escapeHtml(status)}</span> <span class="shipment-tests">${escapeHtml(tests)}</span> ${prBlock} <button type="button" class="shipment-retry" data-retry="${escapeHtml(proposalId)}">Retry</button></li>`;
    })
    .join("");
  return `<section id="vote-panel"><h2>Votes</h2><p id="vote-rule">A change passes with a two-thirds vote. Tessera may veto. Father may override.</p><ul id="proposals">${proposals}</ul><h3>Rules</h3><ul id="rules">${rules}</ul></section><section id="shipments"><h2>Shipped</h2><ul id="shipment-list">${shipments}</ul></section><section id="community"><h2>Community</h2>${neighborhoods}</section>`;
}

export function renderStudio(state, options = {}) {
  const view = studioView(options);
  const civic = options.civic ?? createCivic().snapshot();
  const cards = state.tasks
    .map(
      (task) =>
        `<article class="task-card" data-status="${escapeHtml(task.status)}"><h3>${escapeHtml(task.title)}</h3><p class="status">${escapeHtml(task.status)}</p></article>`,
    )
    .join("");
  const desks = state.desks
    .map(
      (desk) =>
        `<article class="desk" data-desk="${escapeHtml(desk.id)}"><span class="lamp" data-lamp="${escapeHtml(desk.lamp)}"></span><p>${escapeHtml(desk.id)}</p></article>`,
    )
    .join("");
  const toggle =
    view === "3d"
      ? `<a id="view-toggle" href="/?view=2d">2D wall</a>`
      : `<a id="view-toggle" href="/">3D floor</a>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Tessera studio</title>
  <style>
    body { font-family: Georgia, serif; margin: 0; background: #f4f0e6; color: #1c1915; }
    body[data-mode="3d"] { display: grid; grid-template-columns: 320px 1fr; min-height: 100vh; }
    main { padding: 16px; }
    form { display: flex; gap: 8px; flex-wrap: wrap; }
    #task-wall, #desks { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
    .task-card, .desk { background: #fffdf8; border: 1px solid #d9d0c1; padding: 12px; min-width: 140px; }
    .lamp { display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #7d9a72; }
    .lamp[data-lamp="busy"] { background: #e0a045; }
    .studio-tabs { display: flex; gap: 16px; align-items: center; margin-top: 12px; }
    .studio-tabs a, #view-toggle { color: #6b3e22; }
    #vote-panel, #community, #shipments { margin-top: 16px; }
    #vote-panel h2, #community h2, #shipments h2, #vote-panel h3 { font-size: 1.05rem; margin: 0 0 8px; }
    .proposal, .neighborhood, .rule, .shipment { background: #fffdf8; border: 1px solid #d9d0c1; padding: 8px; margin: 6px 0; }
    .shipment-object { font-weight: 700; }
    .shipment-status, .shipment-tests, .shipment-pr { color: #4a4036; font-size: 0.9rem; }
    .shipment-retry { border: 1px solid #d9d0c1; background: #f4f0e6; padding: 2px 8px; cursor: pointer; }
    .life, .memory, #vote-rule { margin: 4px 0; color: #4a4036; }
    #stage { min-height: 100vh; background: #d7cbb8; }
    #floor-3d { width: 100%; height: 100vh; display: block; }
  </style>
</head>
<body data-mode="${view}">
  <main>
  <h1>${view === "3d" ? "Studio floor" : "Task wall"}</h1>
  <nav class="studio-tabs"><a id="gitai-tab" href="/gitai">GitAI</a>${toggle}</nav>
  ${renderCivic(civic)}
  <form id="goal-form">
    <label for="goal">Goal</label>
    <input id="goal" name="goal" required />
    <button id="post-goal" type="submit">Post goal</button>
  </form>
  <section id="task-wall">${cards}</section>
  <h2>Desks</h2>
  <section id="desks">${desks}</section>
  </main>
  <div id="stage">
  ${floorMarkup({ view })}
  </div>
  <script>
    const form = document.querySelector("#goal-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const goal = new FormData(form).get("goal");
      await fetch("/goals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal }) });
      const state = await (await fetch("/state")).json();
      const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      document.querySelector("#task-wall").innerHTML = state.tasks.map((task) =>
        '<article class="task-card" data-status="' + escapeHtml(task.status) + '"><h3>' + escapeHtml(task.title) + '</h3><p class="status">' + escapeHtml(task.status) + '</p></article>'
      ).join("");
      document.querySelector("#desks").innerHTML = state.desks.map((desk) =>
        '<article class="desk" data-desk="' + escapeHtml(desk.id) + '"><span class="lamp" data-lamp="' + escapeHtml(desk.lamp) + '"></span><p>' + escapeHtml(desk.id) + '</p></article>'
      ).join("");
    });
    document.querySelector("#shipment-list")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-retry]");
      if (!button) return;
      await fetch("/civic/shipments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: button.dataset.retry }),
      });
    });
  </script>
</body>
</html>`;
}

function proxyGitAi(req, res, upstream, suffix) {
  const target = new URL(upstream);
  const headers = { ...req.headers, host: target.host };
  delete headers.connection;
  const out = httpRequest(
    {
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: suffix,
      headers,
    },
    (up) => {
      const responseHeaders = { ...up.headers };
      delete responseHeaders["transfer-encoding"];
      delete responseHeaders.connection;
      res.writeHead(up.statusCode ?? 502, responseHeaders);
      up.pipe(res);
    },
  );
  out.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end("GitAI backend is not answering.");
    }
  });
  req.pipe(out);
}

function proxyUpgrade(req, socket, head, upstream, path) {
  const target = new URL(upstream);
  const out = netConnect(Number(target.port), target.hostname, () => {
    const lines = [`GET ${path} HTTP/1.1`, `Host: ${target.host}`];
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === "host") continue;
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) lines.push(`${key}: ${item}`);
    }
    lines.push("", "");
    out.write(lines.join("\r\n"));
    if (head?.length) out.write(head);
    socket.pipe(out);
    out.pipe(socket);
  });
  out.on("error", () => socket.destroy());
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function listenStudio(studio = createStudio(), options = {}) {
  const monitor = options.monitor ?? createMonitor();
  const logPath = options.buildLogPath === null ? null : options.buildLogPath ?? defaultBuildLogPath();
  const civicPath = options.civicPath ?? null;
  const civic = options.civic ?? createCivic(civicPath ? loadCivic(civicPath) : null);
  const clients = new Set();

  function persist() {
    if (civicPath) saveCivic(civic.snapshot(), civicPath);
  }

  const shipRepoDir = options.shipRepoDir ?? null;
  const shipRunner = options.shipRunner ?? null;
  const shipForeman = studio.foreman ?? options.foreman ?? null;
  const gitaiUpstream = options.gitaiUpstream ?? process.env.GITAI_UPSTREAM ?? "";
  let gitai = options.gitai ?? null;
  let gitaiFeed = null;

  function gitaiBackend() {
    if (!gitai) gitai = seedDemo();
    if (!gitaiFeed) gitaiFeed = createLiveFeed();
    return { gitai, feed: gitaiFeed };
  }

  async function materializeShip(proposalId) {
    if (!shipRepoDir) throw new Error("shipping is not configured");
    if (!shipForeman) throw new Error("shipping is not configured");
    const proposal = civic.snapshot().proposals.find((item) => item.id === proposalId);
    if (!proposal) throw new Error("missing proposal");
    if (proposal.kind !== "ship") throw new Error("not a ship proposal");
    if (proposal.status !== "applied") throw new Error("ship is not applied");
    const existing = civic.snapshot().shipments.find((item) => item.proposalId === proposalId && item.taskId);
    if (existing) return existing;
    const worktree = await import("./worktree.mjs");
    const shipment = applyShip({
      proposal,
      foreman: shipForeman,
      repoDir: shipRepoDir,
      tools: {
        createTaskWorktree: worktree.createTaskWorktree,
        git: worktree.git,
        ...(shipRunner ? { runTestFile: shipRunner } : {}),
      },
    });
    return civic.recordShipment(shipment);
  }

  function world() {
    const state = studio.state();
    return presentWorld(
      buildWorld({
        desks: state.desks,
        tasks: state.tasks,
        events: monitor.list(),
        log: logPath ? loadLog(logPath) : [],
      }),
      civic.snapshot(),
    );
  }

  function pushLive() {
    if (!clients.size) return;
    let messages = [];
    try {
      messages = liveMessages(studio.state(), monitor.list());
    } catch {
      return;
    }
    for (const message of messages) {
      const frame = textFrame(JSON.stringify(message));
      for (const socket of clients) socket.write(frame);
    }
  }

  const server = createServer(async (req, res) => {
    const gate = reviewRequest({ url: req.url ?? "/", method: req.method });
    if (!gate.allowed) {
      res.writeHead(gate.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: gate.reason, match: gate.match }));
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/brain" || url.pathname === "/brain.js" || url.pathname.startsWith("/brain/")) { if (handleBrain(req, res, url)) return; }
    const mounted = mountPath(url.pathname, "/gitai");
    if (mounted) {
      const suffix = `${mounted}${url.search}`;
      if (gitaiUpstream && req.method === "GET" && mounted === "/") {
        const src = gitaiUpstream.replace(/\/$/, "");
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>GitAI</title><style>html,body,iframe{margin:0;height:100%;width:100%;border:0}</style></head><body><iframe id="gitai-frame" title="GitAI" src="${src}/"></iframe></body></html>`,
        );
        return;
      }
      if (gitaiUpstream) {
        proxyGitAi(req, res, gitaiUpstream, suffix);
        return;
      }
      const raw = req.method === "GET" || req.method === "HEAD" ? "" : await readBody(req);
      const backend = gitaiBackend();
      const result = dispatch(backend.gitai, {
        method: req.method,
        url: suffix,
        raw,
        form: new URLSearchParams(String(req.headers["content-type"] ?? "").includes("json") ? "" : raw),
        contentType: req.headers["content-type"] ?? "",
        session: readSession(req.headers.cookie) || req.headers["x-gitai-handle"] || null,
        base: "/gitai",
      });
      if (req.method !== "GET" && req.method !== "HEAD" && result.status < 400) backend.feed.broadcast(backend.gitai.view());
      res.writeHead(result.status, result.headers);
      res.end(result.body);
      return;
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const view = url.searchParams.get("view") === "2d" ? "2d" : "3d";
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderStudio(studio.state(), { view, civic: civic.snapshot() }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/civic") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(civic.snapshot()));
      return;
    }
    if (req.method === "GET" && url.pathname === "/floor.js") {
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      res.end(readFileSync(join(HERE, "floor-client.js")));
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/vendor/")) {
      const build = threeBuildDir();
      const file = normalize(join(build ?? "", url.pathname.slice("/vendor/".length)));
      if (!build || !file.startsWith(build.endsWith(sep) ? build : build + sep) || !existsSync(file)) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      res.end(readFileSync(file));
      return;
    }
    if (req.method === "GET" && url.pathname === "/state") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(studio.state()));
      return;
    }
    if (req.method === "GET" && url.pathname === "/world") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(world()));
      return;
    }
    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ events: monitor.list() }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/civic/shipments") {
      let body = {};
      try {
        body = JSON.parse((await readBody(req)) || "{}");
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "bad json" }));
        return;
      }
      try {
        const recorded = await materializeShip(String(body.proposalId ?? ""));
        persist();
        pushLive();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(recorded));
      } catch (error) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }
    if (req.method === "POST" && url.pathname.startsWith("/civic/")) {
      let body = {};
      try {
        body = JSON.parse((await readBody(req)) || "{}");
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "bad json" }));
        return;
      }
      try {
        let result;
        if (url.pathname === "/civic/proposals") result = civic.propose(body.agentId, body);
        else if (url.pathname === "/civic/votes") result = civic.vote(body.agentId, body.proposalId, body.choice);
        else if (url.pathname === "/civic/veto") result = civic.veto(body.actorId, body.proposalId);
        else if (url.pathname === "/civic/override") result = civic.override(body.actorId, body.proposalId, body.decision);
        else {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "not found" }));
          return;
        }
        if (result?.kind === "ship" && result?.status === "applied") {
          try {
            await materializeShip(result.id);
          } catch {
            // The floor stays up; the approved placeholder remains and /civic/shipments can retry.
          }
        }
        persist();
        pushLive();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/goals") {
      let body = {};
      try {
        body = JSON.parse((await readBody(req)) || "{}");
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "bad json" }));
        return;
      }
      try {
        const posted = studio.postGoal(body.goal);
        pushLive();
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify(posted));
      } catch (error) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.on("upgrade", (req, socket, head) => {
    const path = (req.url ?? "").split("?")[0];
    if (!reviewRequest({ url: req.url ?? "/" }).allowed) {
      socket.destroy();
      return;
    }
    if (path === "/gitai/api/live") {
      if (gitaiUpstream) {
        proxyUpgrade(req, socket, head, gitaiUpstream, "/api/live");
        return;
      }
      const backend = gitaiBackend();
      if (!backend.feed.accept(req, socket, backend.gitai)) socket.destroy();
      return;
    }
    if (path !== "/live" || !acceptWebSocket(req, socket)) {
      socket.destroy();
      return;
    }
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));
    pushLive();
  });

  function pulse() {
    try {
      civic.tick({ tasks: studio.state().tasks, events: monitor.list() });
      persist();
    } catch {
      // The floor stays up if one tick fails.
    }
    pushLive();
  }

  const timer = setInterval(pulse, 1000);
  timer.unref();
  const closeServer = server.close.bind(server);
  server.close = (callback) => {
    clearInterval(timer);
    for (const socket of clients) socket.destroy();
    clients.clear();
    gitaiFeed?.close();
    return closeServer(callback);
  };

  const port = options.port ?? 0;
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/`, monitor });
    });
  });
}
