// Every panel reads real endpoints; a panel that cannot is labelled NOT WIRED.
const $ = (id) => document.getElementById(id);
const get = (u) => fetch(u).then((r) => r.json());
const COLORS = ["#7fd", "#fd7", "#f7d", "#7df", "#df7", "#d7f", "#fa7", "#7af"];
let types = [], timer = null, world = null;

function color(type) { if (!types.includes(type)) types.push(type); return COLORS[types.indexOf(type) % COLORS.length]; }

function drawBrain(b) {
  const c = $("brain"), r = c.getBoundingClientRect();
  c.width = r.width; c.height = r.height;
  const g = c.getContext("2d"), cx = r.width / 2, cy = r.height / 2, s = Math.min(r.width, r.height) / 760;
  const pos = new Map(b.nodes.map((n) => [n.id, n]));
  const added = new Set(b.diff.edgesAdded.map((e) => (Array.isArray(e) ? e.join("|") : String(e))));
  g.lineWidth = 1;
  for (const e of [...b.relations, ...b.synapses]) {
    const a = pos.get(e.a), z = pos.get(e.b); if (!a || !z) continue;
    g.strokeStyle = added.has(`${e.a}|${e.b}`) ? "#ff5" : `rgba(120,200,255,${Math.min(0.6, 0.08 + (e.w ?? 0.2))})`;
    g.beginPath(); g.moveTo(cx + a.x * s, cy + a.y * s); g.lineTo(cx + z.x * s, cy + z.y * s); g.stroke();
  }
  for (const n of b.nodes) { g.fillStyle = color(n.type); g.fillRect(cx + n.x * s - 2, cy + n.y * s - 2, 4, 4); }
  $("tl").textContent = `t=${b.t}/${b.events - 1} nodes=${b.nodeCount} relations=${b.relationCount} synapses=${b.synapseCount} (+${b.diff.forward}/-${b.diff.back})`;
}

async function initWorld() {
  try {
    const THREE = await import("/vendor/three.module.js");
    const el = $("world"), w = el.clientWidth, h = el.clientHeight;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);
    const rnd = new THREE.WebGLRenderer({ antialias: true }); rnd.setSize(w, h); el.appendChild(rnd.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6)); const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(1, 2, 1); scene.add(sun);
    const group = new THREE.Group(); scene.add(group);
    let ang = 0; const loop = () => { ang += 0.003; cam.position.set(Math.cos(ang) * 40, 30, Math.sin(ang) * 40); cam.lookAt(0, 0, 0); rnd.render(scene, cam); requestAnimationFrame(loop); }; loop();
    world = { THREE, group };
  } catch { $("world").innerHTML = '<p class="notwired" style="padding:30px">NOT WIRED: three.js not available</p>'; }
}

function drawWorld(wd) {
  if (!world) return;
  const { THREE, group } = world; group.clear();
  const geo = new THREE.BoxGeometry(0.95, 0.95, 0.95), off = wd.side / 2;
  for (const c of wd.columns) {
    const mat = new THREE.MeshLambertMaterial({ color: color(c.type) });
    for (let y = 0; y < c.h; y++) { const m = new THREE.Mesh(geo, mat); m.position.set(c.x - off, y, c.z - off); group.add(m); }
  }
}

async function drawEye() {
  const [eye, ws] = await Promise.all([get("/api/eye"), get("/api/workspace")]);
  const rows = eye.events.slice(-30).reverse().map((e) => `<div>[${e.source}] ${e.kind}: ${String(e.text).slice(0, 120)}</div>`).join("");
  const lead = ws.leader ? `<div class="wired">workspace leader: ${ws.leader.from}/${ws.leader.topic} attention=${ws.leader.attention}</div>` : `<div class="notwired">${ws.note}</div>`;
  $("eyelist").innerHTML = `${lead}<div>bus: ${JSON.stringify(eye.bus)}</div><div>stored interactions: ${eye.storedInteractions}</div>${rows}`;
}

async function load(t) {
  const q = t === undefined ? "" : `?t=${t}`;
  const [b, wd] = await Promise.all([get(`/api/brain${q}`), get(`/api/world${q}`)]);
  $("t").max = String(b.events - 1); $("t").value = String(b.t);
  drawBrain(b); drawWorld(wd);
  $("status").textContent = `blocks=${wd.blocks} source=${b.source}`;
}

export const HANDLERS = {
  scrub: () => load(Number($("t").value)),
  refresh: () => Promise.all([load(), drawEye()]),
  play: () => {
    if (timer) { clearInterval(timer); timer = null; return; }
    let t = 0; const max = Number($("t").max), step = Math.max(1, Math.round(max / 60));
    timer = setInterval(() => { t = Math.min(max, t + step); load(t); if (t >= max) { clearInterval(timer); timer = null; } }, 400);
  },
};
for (const el of document.querySelectorAll("[data-action]")) el.addEventListener(el.tagName === "INPUT" ? "input" : "click", () => HANDLERS[el.dataset.action]());
await initWorld(); await HANDLERS.refresh(); setInterval(drawEye, 5000);
