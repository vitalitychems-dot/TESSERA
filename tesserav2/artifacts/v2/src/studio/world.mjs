/**
 * Offices, desks, and built objects for the studio floor.
 * Grown from the task graph, worker events, and the build log.
 */

export function plateName(id) {
  if (id === "tessera") return "Tessera";
  if (id === "worker") return "Worker";
  const text = String(id);
  return text.slice(0, 1).toUpperCase() + text.slice(1);
}

export function readBuildLog(markdown) {
  const rows = [];
  for (const line of String(markdown).split("\n")) {
    const match = line.match(/^\|\s*\d+\s*\|\s*(V2-\d+)\s*\|[^|]*\|\s*([^|]+?)\s*\|/);
    if (!match) continue;
    rows.push({ id: match[1], title: match[2].trim() });
  }
  return rows;
}

function ownerId(task, desks) {
  const ids = new Set(desks.map((desk) => desk.id));
  if (/^Plan:/.test(task.title) && ids.has("tessera")) return "tessera";
  if (ids.has("worker")) return "worker";
  return desks[0]?.id ?? "tessera";
}

/** One office per desk. Done work and build-log rows add objects and rooms. */
export function buildWorld({ desks = [], tasks = [], events = [], log = [] } = {}) {
  const offices = desks.map((desk, index) => ({
    id: desk.id,
    name: plateName(desk.id),
    role: desk.role,
    x: index * 7,
    z: 0,
    lamp: desk.lamp === "busy" ? "busy" : "idle",
    walking: false,
    pieces: ["desk", "nameplate", "status-light"],
    artifacts: [],
  }));
  const byId = new Map(offices.map((office) => [office.id, office]));

  for (const task of tasks) {
    if (task.status !== "done") continue;
    const office = byId.get(ownerId(task, desks));
    if (!office) continue;
    office.artifacts.push({ id: task.id, kind: "book", title: task.title });
  }

  for (const event of events) {
    if (event.name !== "tool.write" && event.name !== "tool.read") continue;
    const office = byId.get("worker") ?? offices[0];
    if (!office) continue;
    office.walking = true;
    office.lamp = "busy";
    if (event.name === "tool.write") {
      office.artifacts.push({
        id: `${event.taskId}:${event.detail || "note"}`,
        kind: "page",
        title: event.detail || event.taskId,
      });
    }
  }

  for (const office of offices) {
    if (office.role === "worker" && tasks.some((task) => task.status === "running")) {
      office.walking = true;
      office.lamp = "busy";
    }
  }

  const rooms = [];
  for (let i = 0; i < log.length; i += 5) {
    const slice = log.slice(i, i + 5);
    rooms.push({
      id: `bay-${rooms.length + 1}`,
      title: slice[0].id,
      count: slice.length,
      x: rooms.length * 6,
      z: 8,
    });
  }

  return { offices, rooms };
}
