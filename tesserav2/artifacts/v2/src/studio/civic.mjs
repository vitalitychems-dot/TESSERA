/**
 * Agent world: homes, neighborhoods, daily life, and votes.
 * The tick reads the task graph and the monitor stream.
 * It does not open a network. Work each tick stops at the step cap.
 */
import { reviewPath } from "../hyb011-denylist.mjs";

export const VOTE_RATIO_NUMERATOR = 2;
export const VOTE_RATIO_DENOMINATOR = 3;
export const TICK_STEP_CAP = 8;
export const HOME_OBJECT_CAP = 12;
export const MEMORY_CAP = 24;
export const PROJECT_CAP = 12;
export const QUEEN_ID = "tessera";
export const OWNER_ID = "father";

const ROOM_LADDER = ["office", "library", "gallery", "workshop"];
const OBJECT_LADDER = ["desk", "nameplate", "status-light", "shelf", "chair", "map", "clock", "plant"];
const SCHEDULE = [
  { hour: "dawn", activity: "review the floor" },
  { hour: "morning", activity: "plan the next room" },
  { hour: "afternoon", activity: "build" },
  { hour: "dusk", activity: "write the memory log" },
];

const SHIP_KINDS = ["tool", "fix", "doc"];
const SHIP_SPEC_BLOCKED = /(vault|wallets?|payments?|\b1t\b|mining|trading)/i;

function normalizeShip(change = {}) {
  const objectId = String(change.objectId ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,48}$/i.test(objectId)) throw new Error("objectId required (letters, digits, dash)");
  const shipKind = String(change.shipKind ?? "").trim();
  if (!SHIP_KINDS.includes(shipKind)) throw new Error("shipKind tool, fix, or doc");
  const specTitle = String(change.specTitle ?? "").trim();
  if (!specTitle || specTitle.length > 120) throw new Error("specTitle 1-120 chars");
  const specDetail = String(change.specDetail ?? "");
  if (specDetail.length > 2000) throw new Error("specDetail too long");
  const targetPath = String(change.targetPath ?? "").trim();
  if (!targetPath || targetPath.startsWith("..") || targetPath.startsWith("/") || /^[a-zA-Z]:/.test(targetPath)) {
    throw new Error("targetPath must be relative");
  }
  if (!reviewPath(targetPath).allowed) throw new Error("targetPath refused");
  const testName = String(change.testName ?? "").trim();
  if (testName.includes("/") || !/^[a-z0-9][\w.-]*\.test\.mjs$/i.test(testName)) {
    throw new Error("testName must be a file.test.mjs basename");
  }
  if (!reviewPath(testName).allowed) throw new Error("testName refused");
  if (SHIP_SPEC_BLOCKED.test(`${specTitle} ${specDetail} ${targetPath} ${testName}`)) {
    throw new Error("spec refused");
  }
  return { objectId, shipKind, specTitle, specDetail, targetPath, testName };
}

function passes(yes, total) {
  return yes * VOTE_RATIO_DENOMINATOR >= total * VOTE_RATIO_NUMERATOR;
}

function residentRecord(id, name, role, neighborhood, goal) {
  return {
    id,
    name,
    role,
    neighborhood,
    home: {
      id: `home-${id}`,
      level: 1,
      rooms: ["office"],
      objects: ["desk", "nameplate", "status-light"],
    },
    life: {
      goals: [goal],
      projects: [],
      schedule: SCHEDULE.map((slot) => ({ hour: slot.hour, activity: slot.activity })),
      now: SCHEDULE[0].hour,
      activity: SCHEDULE[0].activity,
    },
  };
}

function blankState() {
  return {
    tick: 0,
    seenTasks: [],
    seenEvents: 0,
    agents: {
      tessera: residentRecord("tessera", "Tessera", "queen", "court", "Hold the court"),
      worker: residentRecord("worker", "Worker", "resident", "yard", "Build the next room"),
      clerk: residentRecord("clerk", "Clerk", "resident", "yard", "Keep the neighborhood record"),
    },
    neighborhoods: {
      court: { id: "court", name: "Court", members: ["tessera"] },
      yard: { id: "yard", name: "Yard", members: ["worker", "clerk"] },
    },
    rules: ["Homes stay inside their neighborhood."],
    proposals: [],
    shipments: [],
    graph: { entities: [], relations: [] },
  };
}

function remember(state, agentId, text) {
  const agent = state.agents[agentId];
  if (!agent) return;
  let entity = state.graph.entities.find((item) => item.name === agentId);
  if (!entity) {
    entity = { name: agentId, entityType: "agent", observations: [] };
    state.graph.entities.push(entity);
  }
  let place = state.graph.entities.find((item) => item.name === agent.neighborhood);
  if (!place) {
    const hood = state.neighborhoods[agent.neighborhood];
    place = { name: agent.neighborhood, entityType: "neighborhood", observations: [hood?.name ?? agent.neighborhood] };
    state.graph.entities.push(place);
  }
  if (!state.graph.relations.some((item) => item.from === agentId && item.relationType === "lives_in")) {
    state.graph.relations.push({ from: agentId, to: agent.neighborhood, relationType: "lives_in" });
  }
  entity.observations.push(`t${state.tick}: ${text}`);
  if (entity.observations.length > MEMORY_CAP) {
    entity.observations.splice(0, entity.observations.length - MEMORY_CAP);
  }
}

function upgradeHome(agent, levels) {
  for (let i = 0; i < levels; i += 1) {
    if (agent.home.objects.length >= HOME_OBJECT_CAP) return;
    agent.home.level += 1;
    const room = ROOM_LADDER[Math.min(agent.home.level - 1, ROOM_LADDER.length - 1)];
    if (!agent.home.rooms.includes(room)) agent.home.rooms.push(room);
    const objectName = OBJECT_LADDER[Math.min(agent.home.objects.length, OBJECT_LADDER.length - 1)];
    if (!agent.home.objects.includes(objectName)) agent.home.objects.push(objectName);
    else agent.home.objects.push(`${objectName}-${agent.home.level}`);
  }
}

function addProject(agent, title) {
  if (!title || agent.life.projects.includes(title) || agent.life.projects.length >= PROJECT_CAP) return;
  agent.life.projects.push(title);
}

function moveHome(state, agentId, neighborhood) {
  const agent = state.agents[agentId];
  for (const hood of Object.values(state.neighborhoods)) {
    hood.members = hood.members.filter((id) => id !== agentId);
  }
  state.neighborhoods[neighborhood].members.push(agentId);
  agent.neighborhood = neighborhood;
  const link = state.graph.relations.find((item) => item.from === agentId && item.relationType === "lives_in");
  if (link) link.to = neighborhood;
  else state.graph.relations.push({ from: agentId, to: neighborhood, relationType: "lives_in" });
}

function capture(state, proposal) {
  if (proposal.kind === "rule") return { rules: [...state.rules] };
  if (proposal.kind === "upgrade") {
    return { home: structuredClone(state.agents[proposal.change.agentId].home) };
  }
  if (proposal.kind === "ship") return { shipments: [...state.shipments] };
  return {
    neighborhoods: structuredClone(state.neighborhoods),
    agents: Object.fromEntries(
      Object.values(state.agents).map((agent) => [agent.id, { neighborhood: agent.neighborhood }]),
    ),
    relations: state.graph.relations.map((item) => ({ ...item })),
  };
}

function mutate(state, proposal) {
  if (proposal.kind === "rule") {
    if (state.rules.length >= MEMORY_CAP) state.rules.shift();
    state.rules.push(proposal.change.rule);
    return;
  }
  if (proposal.kind === "upgrade") {
    upgradeHome(state.agents[proposal.change.agentId], proposal.change.levels);
    return;
  }
  if (proposal.kind === "ship") {
    if (!state.shipments.some((item) => item.proposalId === proposal.id)) {
      state.shipments.push({
        proposalId: proposal.id,
        objectId: proposal.change.objectId,
        status: "approved",
        taskId: null,
        branch: null,
        worktreePath: null,
        diffStat: "",
        testsPassed: false,
        prDraft: null,
        pushed: false,
      });
    }
    return;
  }
  moveHome(state, proposal.change.agentId, proposal.change.neighborhood);
}

function restore(state, proposal) {
  const before = proposal.before;
  if (!before) return;
  if (proposal.kind === "rule") {
    state.rules.splice(0, state.rules.length, ...before.rules);
    return;
  }
  if (proposal.kind === "upgrade") {
    state.agents[proposal.change.agentId].home = structuredClone(before.home);
    return;
  }
  if (proposal.kind === "ship") {
    state.shipments.splice(0, state.shipments.length, ...before.shipments.map((item) => ({ ...item })));
    return;
  }
  state.neighborhoods = structuredClone(before.neighborhoods);
  for (const [id, prior] of Object.entries(before.agents)) {
    if (state.agents[id]) state.agents[id].neighborhood = prior.neighborhood;
  }
  state.graph.relations = before.relations.map((item) => ({ ...item }));
}

export function createCivic(saved) {
  const state = blankState();
  let nextProposal = 1;
  if (saved?.agents) {
    state.tick = saved.tick ?? 0;
    state.seenTasks = [...(saved.seenTasks ?? [])];
    state.seenEvents = saved.seenEvents ?? 0;
    state.agents = saved.agents;
    state.neighborhoods = saved.neighborhoods;
    state.rules = [...(saved.rules ?? [])];
    state.shipments = (saved.shipments ?? []).map((item) => ({
      ...item,
      prDraft: item.prDraft ? { ...item.prDraft } : null,
    }));
    state.proposals = (saved.proposals ?? []).map((proposal) => ({
      ...proposal,
      votes: { ...proposal.votes },
      change: { ...proposal.change },
    }));
    state.graph = {
      entities: (saved.graph?.entities ?? []).map((entity) => ({
        ...entity,
        observations: [...(entity.observations ?? [])],
      })),
      relations: (saved.graph?.relations ?? []).map((item) => ({ ...item })),
    };
    const numbers = state.proposals.map((proposal) => Number(String(proposal.id).replace(/\D/g, "")) || 0);
    nextProposal = Math.max(0, ...numbers) + 1;
  } else {
    remember(state, "tessera", "Tessera opened the court.");
    remember(state, "worker", "Worker took the yard desk.");
    remember(state, "clerk", "Clerk joined the yard.");
  }

  function residents() {
    return Object.values(state.agents);
  }

  function find(proposalId) {
    const proposal = state.proposals.find((item) => item.id === proposalId);
    if (!proposal) throw new Error("missing proposal");
    return proposal;
  }

  function tally(proposal) {
    if (proposal.status !== "open") return proposal;
    if (proposal.vetoedBy) {
      proposal.status = "vetoed";
      return proposal;
    }
    const total = residents().length;
    const yes = Object.values(proposal.votes).filter((vote) => vote === "yes").length;
    if (passes(yes, total)) {
      proposal.before = capture(state, proposal);
      mutate(state, proposal);
      proposal.status = "applied";
      proposal.appliedBy = "vote";
      return proposal;
    }
    if (Object.keys(proposal.votes).length >= total) proposal.status = "rejected";
    return proposal;
  }

  return {
    snapshot() {
      return structuredClone({
        tick: state.tick,
        seenTasks: state.seenTasks,
        seenEvents: state.seenEvents,
        agents: state.agents,
        neighborhoods: state.neighborhoods,
        rules: state.rules,
        proposals: state.proposals,
        shipments: state.shipments,
        graph: state.graph,
        limits: {
          tickStepCap: TICK_STEP_CAP,
          homeObjectCap: HOME_OBJECT_CAP,
          memoryCap: MEMORY_CAP,
          network: "deny",
        },
      });
    },
    propose(agentId, input = {}) {
      if (!state.agents[agentId]) throw new Error("only a resident can propose");
      const title = String(input.title ?? "").trim();
      if (!title) throw new Error("title required");
      const kind = input.kind;
      if (kind !== "rule" && kind !== "upgrade" && kind !== "join" && kind !== "ship") {
        throw new Error("unknown kind");
      }
      const change = input.change ?? {};
      let normalized;
      if (kind === "rule") {
        const rule = String(change.rule ?? "").trim();
        if (!rule) throw new Error("rule required");
        normalized = { rule };
      } else if (kind === "upgrade") {
        if (!state.agents[change.agentId]) throw new Error("missing agent");
        const levels = Number(change.levels ?? 1);
        if (!Number.isInteger(levels) || levels < 1 || levels > 3) throw new Error("levels out of range");
        normalized = { agentId: change.agentId, levels };
      } else if (kind === "ship") {
        normalized = normalizeShip(change);
      } else {
        if (!state.agents[change.agentId]) throw new Error("missing agent");
        if (!state.neighborhoods[change.neighborhood]) throw new Error("missing neighborhood");
        normalized = { agentId: change.agentId, neighborhood: change.neighborhood };
      }
      const proposal = {
        id: `p${nextProposal++}`,
        title,
        kind,
        author: agentId,
        change: normalized,
        votes: {},
        status: "open",
        vetoedBy: null,
        overriddenBy: null,
        appliedBy: null,
        before: null,
      };
      state.proposals.push(proposal);
      return structuredClone(proposal);
    },
    vote(agentId, proposalId, choice) {
      if (!state.agents[agentId]) throw new Error("only a resident can vote");
      if (choice !== "yes" && choice !== "no") throw new Error("vote yes or no");
      const proposal = find(proposalId);
      if (proposal.status !== "open") throw new Error("proposal is closed");
      proposal.votes[agentId] = choice;
      return structuredClone(tally(proposal));
    },
    veto(actorId, proposalId) {
      if (actorId !== QUEEN_ID) throw new Error("only the queen can veto");
      const proposal = find(proposalId);
      if (proposal.status === "applied") throw new Error("already applied");
      proposal.vetoedBy = QUEEN_ID;
      proposal.status = "vetoed";
      return structuredClone(proposal);
    },
    override(actorId, proposalId, decision) {
      if (actorId !== OWNER_ID) throw new Error("only father can override");
      if (decision !== "apply" && decision !== "reject") throw new Error("override apply or reject");
      const proposal = find(proposalId);
      if (decision === "reject") {
        if (proposal.status === "applied") restore(state, proposal);
        proposal.status = "rejected";
        proposal.overriddenBy = OWNER_ID;
        return structuredClone(proposal);
      }
      if (proposal.status !== "applied") {
        proposal.vetoedBy = null;
        proposal.status = "open";
        proposal.before = capture(state, proposal);
        mutate(state, proposal);
        proposal.status = "applied";
        proposal.appliedBy = "father";
      }
      proposal.overriddenBy = OWNER_ID;
      return structuredClone(proposal);
    },
    recordShipment(shipment) {
      if (!shipment || typeof shipment.proposalId !== "string") throw new Error("shipment required");
      const proposal = find(shipment.proposalId);
      if (proposal.kind !== "ship") throw new Error("not a ship proposal");
      const record = { ...shipment, pushed: false };
      const index = state.shipments.findIndex((item) => item.proposalId === shipment.proposalId);
      if (index >= 0) state.shipments[index] = record;
      else state.shipments.push(record);
      return structuredClone(record);
    },
    tick({ tasks = [], events = [] } = {}) {
      let steps = 0;
      state.tick += 1;
      const slot = SCHEDULE[state.tick % SCHEDULE.length];
      for (const agent of residents()) {
        if (steps >= TICK_STEP_CAP) break;
        agent.life.now = slot.hour;
        agent.life.activity = slot.activity;
        steps += 1;
      }
      for (const task of tasks) {
        if (steps >= TICK_STEP_CAP) break;
        if (task.status === "running") {
          const owner = state.agents.worker;
          if (owner && !owner.life.projects.includes(task.title)) {
            addProject(owner, task.title);
            steps += 1;
          }
        }
        if (steps >= TICK_STEP_CAP) break;
        if (task.status !== "done" || state.seenTasks.includes(task.id)) continue;
        state.seenTasks.push(task.id);
        const ownerId = /^Plan:/.test(task.title) ? "tessera" : "worker";
        const owner = state.agents[ownerId];
        if (!owner) continue;
        upgradeHome(owner, 1);
        addProject(owner, task.title);
        remember(state, ownerId, `Finished ${task.title}`);
        steps += 1;
      }
      const pending = events.slice(state.seenEvents);
      for (const event of pending) {
        if (steps >= TICK_STEP_CAP) break;
        state.seenEvents += 1;
        const owner = state.agents.worker;
        if (!owner) continue;
        remember(state, "worker", `${event.name} ${event.detail || event.taskId || ""}`.trim());
        if (event.name === "tool.write") {
          addProject(owner, event.detail || event.taskId);
          upgradeHome(owner, 1);
        }
        steps += 1;
      }
      for (const proposal of state.proposals) {
        if (steps >= TICK_STEP_CAP) break;
        if (proposal.status === "open") tally(proposal);
        steps += 1;
      }
      return { tick: state.tick, steps };
    },
  };
}

/** Offices from the floor, plus persistent homes and neighborhood plots. */
export function presentWorld(built, civic) {
  const agents = civic?.agents ?? {};
  const neighborhoods = civic?.neighborhoods ?? {};
  function decorate(office, agent) {
    if (!agent) {
      return {
        ...office,
        neighborhood: null,
        neighborhoodName: "",
        level: 1,
        rooms: ["office"],
        objects: ["desk", "nameplate", "status-light"],
      };
    }
    const hood = neighborhoods[agent.neighborhood];
    return {
      ...office,
      name: agent.name || office.name,
      neighborhood: agent.neighborhood,
      neighborhoodName: hood?.name ?? agent.neighborhood,
      level: agent.home.level,
      rooms: [...agent.home.rooms],
      objects: [...agent.home.objects],
    };
  }
  const offices = (built?.offices ?? []).map((office) => decorate(office, agents[office.id]));
  for (const agent of Object.values(agents)) {
    if (offices.some((office) => office.id === agent.id)) continue;
    offices.push(
      decorate(
        {
          id: agent.id,
          name: agent.name,
          role: "worker",
          x: offices.length * 7,
          z: 0,
          lamp: "idle",
          walking: false,
          pieces: ["desk", "nameplate", "status-light"],
          artifacts: [],
        },
        agent,
      ),
    );
  }
  const plots = Object.values(neighborhoods)
    .map((hood) => {
      const members = offices.filter((office) => office.neighborhood === hood.id);
      if (!members.length) return null;
      const xs = members.map((office) => office.x);
      const min = Math.min(...xs);
      const max = Math.max(...xs);
      return {
        id: hood.id,
        name: hood.name,
        x: (min + max) / 2,
        z: 0,
        w: max - min + 6.6,
        d: 6.4,
        color: hood.id === "court" ? 0xc9b48a : 0xb7c3a4,
      };
    })
    .filter(Boolean);
  return {
    offices,
    rooms: built?.rooms ?? [],
    plots,
    rules: civic?.rules ?? [],
    proposals: civic?.proposals ?? [],
    shipments: civic?.shipments ?? [],
  };
}
