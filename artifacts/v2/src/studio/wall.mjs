/**
 * Web 2D studio: task wall, desks, and status lamps.
 * Clean-room board. No 3D and no Minecraft client.
 */
import { createServer } from "node:http";
import { floorMarkup } from "./floor.mjs";
import { createForeman } from "./task-graph.mjs";

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
    postGoal(goal) {
      const text = String(goal ?? "").trim();
      if (!text) throw new Error("goal required");
      const n = goals.length + 1;
      goals.push(text);
      const plan = foreman.addTask({ id: `g${n}-plan`, title: `Plan: ${text}` });
      const work = foreman.addTask({ id: `g${n}-work`, title: `Work: ${text}`, dependsOn: [plan.id] });
      return { goal: text, tasks: [plan, work] };
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

export function renderStudio(state) {
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
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Tessera studio</title>
  <style>
    body { font-family: Georgia, serif; margin: 24px; background: #f4f0e6; color: #1c1915; }
    form { display: flex; gap: 8px; }
    #task-wall, #desks { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
    .task-card, .desk { background: #fffdf8; border: 1px solid #d9d0c1; padding: 12px; min-width: 180px; }
    .lamp { display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #9a9a9a; }
    .lamp[data-lamp="busy"] { background: #c47b2b; }
  </style>
</head>
<body>
  <h1>Task wall</h1>
  <form id="goal-form">
    <label for="goal">Goal</label>
    <input id="goal" name="goal" required />
    <button id="post-goal" type="submit">Post goal</button>
  </form>
  <section id="task-wall">${cards}</section>
  <h2>Desks</h2>
  <section id="desks">${desks}</section>
  ${floorMarkup()}
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
    });
  </script>
</body>
</html>`;
}

export function listenStudio(studio = createStudio()) {
  const server = createServer(async (req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderStudio(studio.state()));
      return;
    }
    if (req.method === "GET" && req.url === "/state") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(studio.state()));
      return;
    }
    if (req.method === "POST" && req.url === "/goals") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      let body = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "bad json" }));
        return;
      }
      try {
        const posted = studio.postGoal(body.goal);
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
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}
