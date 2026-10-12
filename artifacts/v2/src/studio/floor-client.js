import * as THREE from "/vendor/three.module.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd7cbb8);
scene.fog = new THREE.Fog(0xd7cbb8, 22, 48);

const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 80);
camera.position.set(16, 15, 22);

const canvas = document.querySelector("#floor-3d");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;

const hemi = new THREE.HemisphereLight(0xfff4e4, 0x6a513c, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 1.4);
sun.position.set(8, 14, 6);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(48, 36),
  new THREE.MeshStandardMaterial({ color: 0xc4b49a, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
scene.add(ground);

const root = new THREE.Group();
scene.add(root);
const walkers = [];

function wood(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
}

function namePlate(text, sub) {
  const board = document.createElement("canvas");
  board.width = 256;
  board.height = 64;
  const pen = board.getContext("2d");
  pen.fillStyle = "#f6efe2";
  pen.fillRect(0, 0, 256, 64);
  pen.strokeStyle = "#2a2118";
  pen.strokeRect(2, 2, 252, 60);
  pen.fillStyle = "#2a2118";
  pen.font = sub ? "24px Georgia, serif" : "28px Georgia, serif";
  pen.fillText(String(text).slice(0, 16), 14, sub ? 28 : 42);
  if (sub) {
    pen.font = "16px Georgia, serif";
    pen.fillStyle = "#6b3e22";
    pen.fillText(String(sub).slice(0, 18), 14, 50);
  }
  const texture = new THREE.CanvasTexture(board);
  texture.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: texture }));
  plate.position.set(0, 1.55, -1.6);
  return plate;
}

function agentFigure() {
  const group = new THREE.Group();
  const coat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.28), wood(0x31404e));
  coat.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), wood(0xe4c4a4));
  head.position.y = 1.35;
  group.add(coat, head);
  return group;
}

function makePlot(plot) {
  const group = new THREE.Group();
  group.position.set(plot.x, 0, plot.z);
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(plot.w, 0.05, plot.d),
    new THREE.MeshStandardMaterial({ color: plot.color, roughness: 1 }),
  );
  pad.position.y = 0.02;
  group.add(pad);
  return group;
}

function makeOffice(office) {
  const group = new THREE.Group();
  group.position.set(office.x, 0, office.z);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.08, 5), wood(0x8d5a32));
  floor.position.y = 0.04;
  const back = new THREE.Mesh(new THREE.BoxGeometry(6, 1.7, 0.08), wood(0xf3eadb));
  back.position.set(0, 0.85, -2.46);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 5), wood(0xf3eadb));
  side.position.set(-2.96, 0.85, 0);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.8), wood(0x6b3e22));
  desk.position.set(0.2, 0.72, -0.4);
  const lampColor = office.lamp === "busy" ? 0xe0a045 : 0x7d9a72;
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshStandardMaterial({ color: lampColor, emissive: lampColor, emissiveIntensity: 0.7 }),
  );
  light.position.set(0.9, 1.15, -0.4);
  const agent = agentFigure();
  agent.position.set(-0.6, 0, 0.4);
  agent.userData.homeX = -0.6;
  agent.userData.walking = office.walking;
  walkers.push(agent);
  group.add(floor, back, side, desk, light, namePlate(office.name, office.neighborhoodName), agent);
  if ((office.level ?? 1) >= 2) {
    const room = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.15, 2.2), wood(0xe7dcc8));
    room.position.set(2.2, 0.58, 0.8);
    group.add(room);
  }
  if ((office.objects ?? []).includes("shelf")) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.22), wood(0x5c3a22));
    shelf.position.set(-1.7, 0.5, -1.4);
    group.add(shelf);
  }
  office.artifacts.slice(0, 6).forEach((artifact, index) => {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.08, 0.2),
      wood(artifact.kind === "page" ? 0xf7f1e4 : 0x8c3b32),
    );
    book.position.set(-0.4 + (index % 3) * 0.32, 0.82 + Math.floor(index / 3) * 0.09, -0.4);
    group.add(book);
  });
  return group;
}

function makeRoom(room) {
  const group = new THREE.Group();
  group.position.set(room.x, 0, room.z);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 3.4), wood(0x9a6a3c));
  floor.position.y = 0.04;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.2, 0.08), wood(0xe7dcc8));
  wall.position.set(0, 0.6, -1.66);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), wood(0x6e4b2e));
  crate.position.set(0, 0.3, 0.2);
  group.add(floor, wall, crate, namePlate(room.title));
  return group;
}

function fit() {
  const width = canvas.clientWidth || 960;
  const height = canvas.clientHeight || 640;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function look() {
  const box = new THREE.Box3().setFromObject(root);
  const center = box.isEmpty() ? new THREE.Vector3(3, 0, 2) : box.getCenter(new THREE.Vector3());
  camera.lookAt(center.x, 0.6, center.z);
}

async function refresh() {
  const world = await (await fetch("/world")).json();
  root.clear();
  walkers.length = 0;
  for (const plot of world.plots ?? []) root.add(makePlot(plot));
  for (const office of world.offices) root.add(makeOffice(office));
  for (const room of world.rooms) root.add(makeRoom(room));
  look();
}

function frame(time) {
  for (const agent of walkers) {
    const along = agent.userData.walking ? (Math.sin(time / 700) + 1) / 2 : 0;
    agent.position.x = agent.userData.homeX + along * 1.5;
    agent.position.y = Math.abs(Math.sin(time / 180)) * (agent.userData.walking ? 0.06 : 0);
  }
  renderer.render(scene, camera);
  window.__FLOOR_READY = true;
  requestAnimationFrame(frame);
}

fit();
await refresh();
requestAnimationFrame(frame);

const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/live`);
let queued = false;
socket.addEventListener("message", () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    refresh().catch((error) => {
      const status = document.querySelector("#floor-status");
      if (status) status.textContent = error.message;
    });
  });
});
window.addEventListener("resize", fit);
