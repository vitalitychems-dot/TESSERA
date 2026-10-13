import { HANDLERS } from "./actions.mjs";

const state = {
  tab: "eye",
  eye: null,
  brain: null,
  bus: null,
  score: null,
  selected: null,
  recall: null,
  chat: [],
  chatError: "",
};

const $ = (id) => document.getElementById(id);

function read(id) {
  const el = $(id);
  return el ? el.value : "";
}

function write(id, value) {
  const el = $(id);
  if (el) el.value = value;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  return response.json();
}

const io = { fetchJson, paint, read, write, point: { x: 0, y: 0 } };

function paint(next = state) {
  for (const name of ["eye", "brain", "chat", "bus", "score"]) {
    const panel = document.querySelector(`[data-panel="${name}"]`);
    const tab = $(`tab-${name}`);
    const on = next.tab === name;
    if (panel) panel.hidden = !on;
    if (tab) tab.setAttribute("aria-current", on ? "true" : "false");
  }
  paintEye(next);
  paintBrain(next);
  paintChat(next);
  paintBus(next);
  paintScore(next);
}

function li(primary, kind, detail) {
  const item = document.createElement("li");
  const a = document.createElement("span");
  a.textContent = primary;
  const b = document.createElement("span");
  b.className = "kind";
  b.textContent = kind;
  const c = document.createElement("span");
  c.className = "detail";
  c.textContent = detail;
  item.append(a, b, c);
  return item;
}

function paintEye(next) {
  const list = $("eye-list");
  const summary = $("eye-summary");
  if (!list || !next.eye) return;
  const eye = next.eye;
  summary.textContent = `${eye.memoryFile} · bus ${eye.bus.total}/${eye.bus.capacity} · working observations ${eye.working.observations} · stored chats ${eye.storedInteractions}`;
  list.replaceChildren(...eye.events.map((event) => li(String(event.source), String(event.kind), `${event.text}${event.detail ? ` — ${event.detail}` : ""}`)));
}

function paintChat(next) {
  const log = $("chat-log");
  const error = $("chat-error");
  if (!log) return;
  log.replaceChildren(...next.chat.map((row) => li(row.role, row.instrument || "", row.text)));
  if (error) error.textContent = next.chatError || "";
}

function paintBus(next) {
  const list = $("bus-list");
  const summary = $("bus-summary");
  if (!list || !next.bus) return;
  const stats = next.bus.stats;
  summary.textContent = `${next.bus.source} · ${stats.total} messages · capacity ${stats.capacity} · avg novelty ${stats.avgNovelty} · goals ${next.bus.working.totalGoals}`;
  list.replaceChildren(...next.bus.messages.map((row) => li(row.from, row.topic, `attention ${row.attention} · novelty ${row.novelty}`)));
}

function paintScore(next) {
  const root = $("score-body");
  if (!root || !next.score) return;
  root.replaceChildren();
  const score = next.score;
  const grid = document.createElement("div");
  grid.className = "score-grid";
  const cards = [
    ["Dev top-1", `${score.router.dev.routerTop1}/${score.router.dev.n}`],
    ["Dev top-3", `${score.router.dev.routerTop3}/${score.router.dev.n}`],
    ["Test top-1", `${score.router.test.routerTop1}/${score.router.test.n}`],
    ["Test top-3", `${score.router.test.routerTop3}/${score.router.test.n}`],
  ];
  for (const [label, value] of cards) {
    const article = document.createElement("article");
    const name = document.createElement("span");
    name.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    article.append(name, strong);
    grid.append(article);
  }
  root.append(grid);
  const note = document.createElement("p");
  note.className = "lede";
  note.textContent = `${score.router.file}. ${score.router.note}`;
  root.append(note);
  const health = document.createElement("div");
  health.className = "score-grid";
  for (const row of score.health) {
    const article = document.createElement("article");
    const name = document.createElement("span");
    name.textContent = row.testName;
    const strong = document.createElement("strong");
    strong.textContent = String(row.score);
    const evidence = document.createElement("p");
    evidence.className = "detail";
    evidence.textContent = row.evidence;
    article.append(name, strong, evidence);
    health.append(article);
  }
  root.append(health);
  const dirs = document.createElement("p");
  dirs.className = "lede";
  dirs.textContent = score.directories.map((dir) => dir.present ? `${dir.path}: ${dir.files.join(", ") || "empty"}` : `${dir.path}: not in this tree`).join(" · ");
  root.append(dirs);
  const cases = document.createElement("p");
  cases.className = "lede";
  cases.textContent = `${score.cases.file}. ${score.cases.note}`;
  root.append(cases);
  const table = document.createElement("table");
  const head = document.createElement("tr");
  for (const label of ["Id", "Category", "Prompt"]) {
    const th = document.createElement("th");
    th.textContent = label;
    head.append(th);
  }
  table.append(head);
  for (const row of score.cases.rows) {
    const tr = document.createElement("tr");
    for (const value of [row.id, row.category, row.prompt]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    table.append(tr);
  }
  root.append(table);
}

function paintBrain(next) {
  const brain = next.brain;
  const canvas = $("brain-canvas");
  const slider = $("brain-time");
  const label = $("brain-label");
  const readout = $("brain-readout");
  if (!brain || !canvas) return;
  if (slider) {
    slider.max = String(Math.max(0, brain.events - 1));
    slider.value = String(brain.t);
  }
  if (label) label.textContent = `Time ${brain.t + 1}/${brain.events} · line ${brain.line}`;
  draw(canvas, brain, next.selected);
  if (!readout) return;
  readout.replaceChildren();
  const lines = [
    `${brain.source}`,
    `${brain.nodeCount} nodes · ${brain.relationCount} relations · ${brain.synapseCount} synapses`,
    `Showing ${brain.synapses.length} strongest synapses · ${brain.modules} modules`,
    `Hubs: ${brain.hubs.join(", ") || "none"}`,
    next.selected ? `Selected ${next.selected}` : "Click a node",
  ];
  if (next.recall?.ok) lines.push(`Recall: ${next.recall.recalled.join(", ") || "no neighbors"}`);
  if (next.recall && !next.recall.ok) lines.push(next.recall.error);
  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = line;
    readout.append(p);
  }
}

function draw(canvas, brain, selected) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#100e0a";
  ctx.fillRect(0, 0, w, h);
  const byId = new Map(brain.nodes.map((node) => [node.id, node]));
  const project = (node) => [w / 2 + node.x, h / 2 + node.y * 0.92];
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(224, 122, 61, 0.35)";
  for (const edge of brain.relations) {
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (!a || !b) continue;
    const [x1, y1] = project(a);
    const [x2, y2] = project(b);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(214, 255, 62, 0.85)";
  for (const edge of brain.synapses) {
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (!a || !b) continue;
    const [x1, y1] = project(a);
    const [x2, y2] = project(b);
    ctx.lineWidth = Math.max(0.6, Math.min(2.4, edge.w));
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  for (const node of brain.nodes) {
    const [x, y] = project(node);
    ctx.fillStyle = node.id === selected ? "#d6ff3e" : "#f4ecda";
    ctx.fillRect(x - 2.2, y - 2.2, 4.4, 4.4);
  }
}

function canvasPoint(event) {
  const canvas = $("brain-canvas");
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width) - canvas.width / 2;
  const y = ((event.clientY - rect.top) * (canvas.height / rect.height) - canvas.height / 2) / 0.92;
  return { x, y };
}

document.body.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.type === "submit") event.preventDefault();
  const action = button.dataset.action;
  if (action.startsWith("tab-")) history.replaceState(null, "", `#${action.slice(4)}`);
  const run = HANDLERS[action];
  if (run) void run(state, io);
});

document.body.addEventListener("input", (event) => {
  const input = event.target.closest("[data-action]");
  if (!input || input.tagName === "BUTTON") return;
  const run = HANDLERS[input.dataset.action];
  if (run) void run(state, io);
});

$("brain-canvas").addEventListener("click", (event) => {
  io.point = canvasPoint(event);
  void HANDLERS["brain-pick"](state, io);
});

$("chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void HANDLERS["chat-send"](state, io);
});

const meta = await fetchJson("/api/meta");
$("port-label").textContent = meta.listen;
const opening = location.hash.replace("#", "");
const start = ["eye", "brain", "chat", "bus", "score"].includes(opening) ? `tab-${opening}` : "tab-eye";
await HANDLERS[start](state, io);
