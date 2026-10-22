import * as THREE from "three";

const GLASS = 0x7ef0d4;
const BONE = 0xf3efe6;
const FRACTURE = 0xff5c39;
const BG = 0x070b10;

function readSnapshot() {
  const node = document.getElementById("brain-snapshot-data");
  if (!node) return { nodes: [], edges: [], counts: { nodes: 0, edges: 0, links: 0, recalls: 0 } };
  try {
    const data = JSON.parse(node.textContent || "{}");
    return {
      disclaimer: typeof data.disclaimer === "string" ? data.disclaimer : "",
      source: typeof data.source === "string" ? data.source : "",
      sampleFixture: data.sampleFixture === true,
      nodes: Array.isArray(data.nodes) ? data.nodes : [],
      edges: Array.isArray(data.edges) ? data.edges : [],
      counts: data.counts && typeof data.counts === "object" ? data.counts : {},
    };
  } catch {
    return { nodes: [], edges: [], counts: { nodes: 0, edges: 0, links: 0, recalls: 0 } };
  }
}

function layout(nodes, edges) {
  const placed = nodes.map((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    return {
      id: node.id,
      x: Math.cos(angle) * 16,
      y: (index - (nodes.length - 1) / 2) * 3,
      z: Math.sin(angle) * 16,
    };
  });
  const indexOf = new Map(placed.map((point, index) => [point.id, index]));
  const springs = [];
  for (const edge of edges) {
    const a = indexOf.get(edge.source);
    const b = indexOf.get(edge.target);
    if (a == null || b == null) continue;
    springs.push([a, b]);
  }
  for (let step = 0; step < 100; step += 1) {
    const force = placed.map(() => ({ x: 0, y: 0, z: 0 }));
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const dx = placed[i].x - placed[j].x;
        const dy = placed[i].y - placed[j].y;
        const dz = placed[i].z - placed[j].z;
        const dist2 = Math.max(dx * dx + dy * dy + dz * dz, 0.04);
        const scale = 70 / (dist2 * Math.sqrt(dist2));
        force[i].x += dx * scale;
        force[i].y += dy * scale;
        force[i].z += dz * scale;
        force[j].x -= dx * scale;
        force[j].y -= dy * scale;
        force[j].z -= dz * scale;
      }
    }
    for (const [a, b] of springs) {
      const dx = placed[b].x - placed[a].x;
      const dy = placed[b].y - placed[a].y;
      const dz = placed[b].z - placed[a].z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const pull = (dist - 14) * 0.045;
      force[a].x += (dx / dist) * pull;
      force[a].y += (dy / dist) * pull;
      force[a].z += (dz / dist) * pull;
      force[b].x -= (dx / dist) * pull;
      force[b].y -= (dy / dist) * pull;
      force[b].z -= (dz / dist) * pull;
    }
    for (let i = 0; i < placed.length; i += 1) {
      placed[i].x = (placed[i].x + force[i].x * 0.02) * 0.985;
      placed[i].y = (placed[i].y + force[i].y * 0.02) * 0.985;
      placed[i].z = (placed[i].z + force[i].z * 0.02) * 0.985;
    }
  }
  return new Map(placed.map((point) => [point.id, point]));
}

function glow(recalls, maxRecall) {
  if (!maxRecall) return 0.22;
  return 0.18 + 0.82 * (Number(recalls) / maxRecall);
}

function line(a, b, color, opacity) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(a.x, a.y, a.z),
    new THREE.Vector3(b.x, b.y, b.z),
  ]);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Line(geometry, material);
  mesh.raycast = () => {};
  return mesh;
}

export function mountBrainGraph() {
  const data = readSnapshot();
  const label = document.getElementById("brain-snapshot-label");
  if (label && data.disclaimer) label.textContent = data.disclaimer;
  const counts = document.getElementById("brain-snapshot-counts");
  if (counts) {
    const c = data.counts;
    const parts = [
      `${c.nodes ?? 0} nodes`,
      `${c.edges ?? 0} edges`,
      `${c.links ?? 0} links`,
      `${c.recalls ?? 0} recalls`,
    ];
    if (data.sampleFixture) parts.push("Sample fixture.");
    if (data.source) parts.push(data.source);
    counts.textContent = parts.join(" · ");
  }
  const aside = document.getElementById("brain-snapshot-aside");
  const canvas = document.getElementById("brain-snapshot-canvas");
  if (!canvas) return { sync() {} };

  const positions = layout(data.nodes, data.edges);
  const maxRecall = data.nodes.reduce((max, node) => Math.max(max, Number(node.recalls) || 0), 0);
  const maxEdgeRecall = data.edges.reduce((max, edge) => Math.max(max, edge.kind === "recall" ? Number(edge.recalls) || 0 : 0), 0);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  } catch {
    document.body.dataset.brainReady = "error";
    if (counts) counts.textContent = `${counts.textContent} · WebGL unavailable`;
    return { sync() {} };
  }
  renderer.setClearColor(BG, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400);
  camera.position.set(0, 10, 38);
  const rig = new THREE.Group();
  scene.add(rig);

  const nodeMaterial = new Map();
  const coreGeometry = new THREE.SphereGeometry(0.72, 20, 16);
  const haloGeometry = new THREE.SphereGeometry(1.35, 20, 16);
  for (const node of data.nodes) {
    const point = positions.get(node.id);
    if (!point) continue;
    const color = node.kind === "facet" ? GLASS : BONE;
    const core = new THREE.Mesh(coreGeometry, new THREE.MeshBasicMaterial({ color }));
    core.position.set(point.x, point.y, point.z);
    core.userData.id = node.id;
    const halo = new THREE.Mesh(haloGeometry, new THREE.MeshBasicMaterial({
      color: node.kind === "facet" ? GLASS : BONE,
      transparent: true,
      opacity: glow(node.recalls, maxRecall),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    halo.position.copy(core.position);
    halo.raycast = () => {};
    rig.add(halo, core);
    nodeMaterial.set(node.id, core);
  }
  for (const edge of data.edges) {
    const a = positions.get(edge.source);
    const b = positions.get(edge.target);
    if (!a || !b) continue;
    if (edge.kind === "recall") {
      rig.add(line(a, b, GLASS, glow(edge.recalls, maxEdgeRecall)));
    } else {
      rig.add(line(a, b, FRACTURE, 0.28));
    }
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selected = "";
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;
  let yaw = 0.4;
  let pitch = 0.25;
  let distance = 38;
  let running = false;
  let frame = 0;

  function mark(id) {
    selected = id;
    for (const [nodeId, mesh] of nodeMaterial) {
      const node = data.nodes.find((item) => item.id === nodeId);
      const base = node?.kind === "facet" ? GLASS : BONE;
      mesh.material.color.setHex(nodeId === id ? 0xffffff : base);
      mesh.scale.setScalar(nodeId === id ? 1.35 : 1);
    }
    if (!aside) return;
    for (const button of aside.querySelectorAll("button")) {
      button.setAttribute("aria-current", button.dataset.node === id ? "true" : "false");
    }
  }

  if (aside) {
    aside.replaceChildren();
    for (const node of data.nodes) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.node = node.id;
      button.textContent = `${node.id} · ${node.kind} · recalls ${node.recalls}`;
      button.addEventListener("click", () => mark(node.id));
      aside.append(button);
    }
  }

  function resize() {
    const width = canvas.clientWidth || 900;
    const height = canvas.clientHeight || 640;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  function placeCamera() {
    const cos = Math.cos(pitch);
    camera.position.set(Math.sin(yaw) * cos * distance, Math.sin(pitch) * distance, Math.cos(yaw) * cos * distance);
    camera.lookAt(0, 0, 0);
  }

  function render() {
    resize();
    if (!reduceMotion && running) yaw += 0.003;
    placeCamera();
    renderer.render(scene, camera);
    if (canvas.width > 0 && !document.body.dataset.brainReady) document.body.dataset.brainReady = "1";
    if (running) frame = requestAnimationFrame(render);
  }

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    lastX = event.clientX;
    lastY = event.clientY;
    yaw -= dx * 0.008;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.008));
  });
  canvas.addEventListener("pointerup", (event) => {
    dragging = false;
    if (moved > 6) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...nodeMaterial.values()], false);
    if (hits[0]?.object.userData.id) mark(hits[0].object.userData.id);
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    distance = Math.max(12, Math.min(90, distance + event.deltaY * 0.03));
  }, { passive: false });

  resize();
  placeCamera();
  return {
    sync(visible) {
      if (visible) {
        resize();
        if (!running) {
          running = true;
          frame = requestAnimationFrame(render);
        }
        return;
      }
      running = false;
      if (frame) cancelAnimationFrame(frame);
    },
  };
}
