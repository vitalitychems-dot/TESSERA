import * as THREE from "three";

const GLASS = 0x7ef0d4, BONE = 0xf3efe6, FRACTURE = 0xff5c39;

function readSnapshot() {
  try {
    const data = JSON.parse(document.getElementById("brain-snapshot-data")?.textContent || "{}");
    return {
      disclaimer: typeof data.disclaimer === "string" ? data.disclaimer : "",
      source: typeof data.source === "string" ? data.source : "",
      sampleFixture: data.sampleFixture === true,
      nodes: Array.isArray(data.nodes) ? data.nodes : [],
      edges: Array.isArray(data.edges) ? data.edges : [],
      counts: data.counts && typeof data.counts === "object" ? data.counts : {},
    };
  } catch { return { nodes: [], edges: [], counts: {} }; }
}

function layout(nodes, edges) {
  const n = Math.max(nodes.length, 1);
  const placed = nodes.map((node, i) => ({
    id: node.id,
    x: Math.cos((i / n) * Math.PI * 2) * 16,
    y: (i - (nodes.length - 1) / 2) * 3,
    z: Math.sin((i / n) * Math.PI * 2) * 16,
  }));
  const at = new Map(placed.map((p, i) => [p.id, i]));
  const springs = edges.flatMap((e) => {
    const a = at.get(e.source), b = at.get(e.target);
    return a == null || b == null ? [] : [[a, b]];
  });
  for (let step = 0; step < 80; step += 1) {
    const force = placed.map(() => ({ x: 0, y: 0, z: 0 }));
    for (let i = 0; i < placed.length; i += 1) for (let j = i + 1; j < placed.length; j += 1) {
      const dx = placed[i].x - placed[j].x, dy = placed[i].y - placed[j].y, dz = placed[i].z - placed[j].z;
      const scale = 70 / (Math.max(dx * dx + dy * dy + dz * dz, 0.04) ** 1.5);
      force[i].x += dx * scale; force[i].y += dy * scale; force[i].z += dz * scale;
      force[j].x -= dx * scale; force[j].y -= dy * scale; force[j].z -= dz * scale;
    }
    for (const [a, b] of springs) {
      const dx = placed[b].x - placed[a].x, dy = placed[b].y - placed[a].y, dz = placed[b].z - placed[a].z;
      const dist = Math.hypot(dx, dy, dz) || 1, pull = (dist - 14) * 0.045, ux = dx / dist, uy = dy / dist, uz = dz / dist;
      force[a].x += ux * pull; force[a].y += uy * pull; force[a].z += uz * pull;
      force[b].x -= ux * pull; force[b].y -= uy * pull; force[b].z -= uz * pull;
    }
    for (const p of placed) { const f = force[at.get(p.id)]; p.x += f.x * 0.02; p.y += f.y * 0.02; p.z += f.z * 0.02; }
  }
  const c = placed.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y, z: s.z + p.z }), { x: 0, y: 0, z: 0 });
  c.x /= n; c.y /= n; c.z /= n;
  const radius = placed.reduce((m, p) => Math.max(m, Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z)), 1);
  const fit = 14 / radius;
  for (const p of placed) { p.x = (p.x - c.x) * fit; p.y = (p.y - c.y) * fit; p.z = (p.z - c.z) * fit; }
  return new Map(placed.map((p) => [p.id, p]));
}

const glow = (recalls, maxRecall) => (maxRecall ? 0.18 + 0.82 * (Number(recalls) / maxRecall) : 0.22);

export function mountBrainGraph() {
  const data = readSnapshot();
  const label = document.getElementById("brain-snapshot-label");
  if (label && data.disclaimer) label.textContent = data.disclaimer;
  const countsEl = document.getElementById("brain-snapshot-counts");
  if (countsEl) {
    const c = data.counts;
    const pairs = c.recalls ?? 0;
    const parts = [`${c.nodes ?? 0} nodes`, `${c.edges ?? 0} edges`, `${c.links ?? 0} links`, `${pairs} recall pair${pairs === 1 ? "" : "s"}`];
    if (data.sampleFixture) parts.push("Sample fixture.");
    if (data.source) parts.push(data.source);
    countsEl.textContent = parts.join(" · ");
    countsEl.title = "Node recall-degree values add up to twice the header's recall-pair count.";
  }
  const canvas = document.getElementById("brain-snapshot-canvas");
  const aside = document.getElementById("brain-snapshot-aside");
  if (!canvas) return { sync() {} };
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true }); }
  catch { document.body.dataset.brainReady = "error"; return { sync() {} }; }
  renderer.setClearColor(0x070b10, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b10);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400);
  const positions = layout(data.nodes, data.edges);
  const maxRecall = data.nodes.reduce((m, node) => Math.max(m, Number(node.recalls) || 0), 0);
  const maxEdge = data.edges.reduce((m, edge) => Math.max(m, edge.kind === "recall" ? Number(edge.recalls) || 0 : 0), 0);
  const cores = new Map();
  const coreGeometry = new THREE.SphereGeometry(1.15, 20, 16);
  const haloGeometry = new THREE.SphereGeometry(2.4, 20, 16);
  for (const node of data.nodes) {
    const point = positions.get(node.id);
    if (!point) continue;
    const color = node.kind === "facet" ? GLASS : BONE;
    const core = new THREE.Mesh(coreGeometry, new THREE.MeshBasicMaterial({ color }));
    core.position.set(point.x, point.y, point.z);
    core.userData.id = node.id;
    const halo = new THREE.Mesh(haloGeometry, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: glow(node.recalls, maxRecall), blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.position.copy(core.position);
    halo.raycast = () => {};
    scene.add(halo, core);
    cores.set(node.id, core);
  }
  const pairKey = (edge) => (edge.source < edge.target ? `${edge.source}\0${edge.target}` : `${edge.target}\0${edge.source}`);
  const linkPairs = new Set(data.edges.filter((edge) => edge.kind === "link").map(pairKey));
  for (const edge of data.edges) {
    const a = positions.get(edge.source), b = positions.get(edge.target);
    if (!a || !b) continue;
    const recall = edge.kind === "recall";
    const share = recall && linkPairs.has(pairKey(edge));
    let ax = a.x, ay = a.y, az = a.z, bx = b.x, by = b.y, bz = b.z;
    if (share) {
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      let ox = -dy, oy = dx, oz = 0;
      if (ox * ox + oy * oy < 1e-8) { ox = -dz; oy = 0; oz = dx; }
      const s = 0.9 / (Math.hypot(ox, oy, oz) || 1);
      ax += ox * s; ay += oy * s; az += oz * s; bx += ox * s; by += oy * s; bz += oz * s;
    }
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz)]);
    const material = share
      ? new THREE.LineDashedMaterial({ color: GLASS, transparent: true, opacity: glow(edge.recalls, maxEdge), dashSize: 0.55, gapSize: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })
      : new THREE.LineBasicMaterial({ color: recall ? GLASS : FRACTURE, transparent: true, opacity: recall ? glow(edge.recalls, maxEdge) : 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geometry, material);
    if (share) line.computeLineDistances();
    line.raycast = () => {};
    scene.add(line);
  }
  function mark(id) {
    for (const [nodeId, mesh] of cores) {
      const node = data.nodes.find((item) => item.id === nodeId);
      mesh.material.color.setHex(nodeId === id ? 0xffffff : node?.kind === "facet" ? GLASS : BONE);
      mesh.scale.setScalar(nodeId === id ? 1.35 : 1);
    }
    aside?.querySelectorAll("button").forEach((button) => button.setAttribute("aria-current", button.dataset.node === id ? "true" : "false"));
  }
  if (aside) {
    aside.replaceChildren();
    for (const node of data.nodes) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.node = node.id;
      button.textContent = `${node.id} · ${node.kind} · recall degree ${node.recalls}`;
      button.addEventListener("click", () => mark(node.id));
      aside.append(button);
    }
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let dragging = false, moved = 0, lastX = 0, lastY = 0, yaw = 0.4, pitch = 0.25, distance = 32, running = false, frame = 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const resize = () => {
    const width = canvas.clientWidth || 900, height = canvas.clientHeight || 640;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  const render = () => {
    resize();
    if (!reduceMotion && running) yaw += 0.003;
    const cos = Math.cos(pitch);
    camera.position.set(Math.sin(yaw) * cos * distance, Math.sin(pitch) * distance, Math.cos(yaw) * cos * distance);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    if (canvas.width > 0) document.body.dataset.brainReady = "1";
    if (running) frame = requestAnimationFrame(render);
  };
  canvas.addEventListener("pointerdown", (event) => { dragging = true; moved = 0; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX, dy = event.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy); lastX = event.clientX; lastY = event.clientY;
    yaw -= dx * 0.008; pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.008));
  });
  canvas.addEventListener("pointerup", (event) => {
    dragging = false;
    if (moved > 6) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...cores.values()], false)[0];
    if (hit?.object.userData.id) mark(hit.object.userData.id);
  });
  canvas.addEventListener("wheel", (event) => { event.preventDefault(); distance = Math.max(12, Math.min(90, distance + event.deltaY * 0.03)); }, { passive: false });
  return { sync(visible) { if (!visible) { running = false; if (frame) cancelAnimationFrame(frame); return; } if (!running) { running = true; frame = requestAnimationFrame(render); } } };
}
