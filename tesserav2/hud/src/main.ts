import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { HUD_TOKENS } from "./tokens.ts";
import "./style.css";

document.documentElement.style.setProperty("--ground", HUD_TOKENS.ground);
document.documentElement.style.setProperty("--edge", HUD_TOKENS.edge);

type Facet = { name: string; size: number; hash: string; lane: string; rows: number; type?: string; at?: number };
type Tile = {
  facet: Facet;
  body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  height: number;
  target: number;
  pulse: number;
  dying: boolean;
};

const GROUND = new THREE.Color(HUD_TOKENS.ground);
const EDGE = new THREE.Color(HUD_TOKENS.edge);
const FRACTURE = new THREE.Color(HUD_TOKENS.fracture);
const CELL = 1.25;

const canvas = document.getElementById("terrain") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(GROUND, 1);

const scene = new THREE.Scene();
scene.background = GROUND;
scene.fog = new THREE.Fog(GROUND, 18, 48);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
camera.position.set(9, 7.5, 10);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.target.set(0, 0.8, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const key = new THREE.DirectionalLight(EDGE, 0.9);
key.position.set(6, 12, 4);
scene.add(key);

const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshBasicMaterial({ color: GROUND }), // unlit so the ground renders exactly #070b10
);
groundPlane.rotation.x = -Math.PI / 2;
scene.add(groundPlane);
const grid = new THREE.GridHelper(40, 32, EDGE, EDGE);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.12;
grid.position.y = 0.002;
scene.add(grid);

const tiles = new Map<string, Tile>();
const counts = { add: 0, change: 0, delete: 0 };
const events: Facet[] = [];
(window as unknown as { __hud: unknown }).__hud = { events, tiles, counts };

/** Height from file size (log scale), nudged by content hash so equal sizes still differ. */
function heightFor(f: Facet): number {
  const base = 0.2 + Math.max(0, Math.log2(1 + f.size) - 7) * 0.45;
  const jitter = (parseInt(f.hash.slice(0, 4), 16) / 0xffff) * 0.35;
  return base + jitter;
}

/** Body tint: Ink Ground lifted toward the edge color, shifted by hash. */
function bodyColor(f: Facet): THREE.Color {
  const t = 0.1 + (parseInt(f.hash.slice(4, 8), 16) / 0xffff) * 0.18;
  return GROUND.clone().lerp(EDGE, t);
}

function layout() {
  const live = [...tiles.values()].filter((t) => !t.dying).sort((a, b) => a.facet.name.localeCompare(b.facet.name));
  const side = Math.max(1, Math.ceil(Math.sqrt(live.length)));
  live.forEach((t, i) => {
    const x = (i % side) - (side - 1) / 2;
    const z = Math.floor(i / side) - (side - 1) / 2;
    t.body.position.x = t.edges.position.x = x * CELL;
    t.body.position.z = t.edges.position.z = z * CELL;
  });
}

function upsert(f: Facet, pulse: boolean) {
  let t = tiles.get(f.name);
  if (!t) {
    const geo = new THREE.BoxGeometry(CELL * 0.86, 1, CELL * 0.86);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: bodyColor(f), roughness: 0.55, metalness: 0.1,
      emissive: EDGE, emissiveIntensity: 0, transparent: true, opacity: 0.92,
    });
    const body = new THREE.Mesh(geo, mat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: EDGE }));
    body.scale.y = edges.scale.y = 0.01;
    scene.add(body, edges);
    t = { facet: f, body, edges, height: 0.01, target: heightFor(f), pulse: 0, dying: false };
    tiles.set(f.name, t);
    layout();
  }
  t.facet = f;
  t.dying = false;
  t.target = heightFor(f);
  t.body.material.color.copy(bodyColor(f));
  t.edges.material.color.copy(EDGE);
  if (pulse) t.pulse = 1;
}

function sink(name: string) {
  const t = tiles.get(name);
  if (!t) return;
  t.dying = true;
  t.target = 0;
  t.pulse = 1;
  t.edges.material.color.copy(FRACTURE);
}

const $ = (id: string) => document.getElementById(id)!;
function refreshHud(last?: Facet) {
  const live = [...tiles.values()].filter((t) => !t.dying);
  $("hud-tiles").textContent = String(live.length);
  $("hud-bytes").textContent = live.reduce((s, t) => s + t.facet.size, 0).toLocaleString();
  $("hud-counts").textContent = `${counts.add} / ${counts.change} / ${counts.delete}`;
  if (last) {
    const when = new Date(last.at ?? Date.now()).toLocaleTimeString();
    $("hud-last").textContent = `${last.type} · ${when}`;
    $("hud-file").textContent = `${last.name} · ${last.size} B · ${last.lane} · ${last.hash}`;
    for (const id of ["hud-last", "hud-file"]) {
      const el = $(id);
      el.classList.add("pulse");
      setTimeout(() => el.classList.remove("pulse"), 900);
    }
  }
}

const source = new EventSource("/facets/stream");
source.addEventListener("open", () => ($("hud-link").textContent = "live · 127.0.0.1 SSE"));
source.addEventListener("error", () => ($("hud-link").textContent = "reconnecting"));
source.addEventListener("snapshot", (e) => {
  const data = JSON.parse((e as MessageEvent).data) as { dir: string; facets: Facet[] };
  $("hud-dir").textContent = data.dir;
  const seen = new Set(data.facets.map((f) => f.name));
  for (const name of tiles.keys()) if (!seen.has(name)) sink(name);
  for (const f of data.facets) upsert(f, false);
  refreshHud();
});
source.addEventListener("facet", (e) => {
  const ev = JSON.parse((e as MessageEvent).data) as Facet;
  events.push(ev);
  if (ev.type === "delete") {
    counts.delete += 1;
    sink(ev.name);
  } else {
    counts[ev.type === "add" ? "add" : "change"] += 1;
    upsert(ev, true);
  }
  refreshHud(ev);
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  for (const [name, t] of tiles) {
    t.height += (t.target - t.height) * Math.min(1, dt * 4);
    const y = Math.max(0.01, t.height);
    t.body.scale.y = t.edges.scale.y = y;
    t.pulse = Math.max(0, t.pulse - dt * 0.8);
    t.body.material.emissiveIntensity = t.pulse * 0.9;
    if (t.dying) {
      t.body.material.opacity = Math.max(0, t.height / Math.max(0.01, heightFor(t.facet)));
      if (t.height < 0.03) {
        scene.remove(t.body, t.edges);
        t.body.geometry.dispose();
        t.edges.geometry.dispose();
        tiles.delete(name);
        layout();
      }
    }
  }
  controls.update();
  renderer.render(scene, camera);
});
