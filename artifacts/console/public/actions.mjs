export function nearestNode(nodes, point) {
  let best = null;
  let bestD = 18 ** 2;
  for (const node of nodes ?? []) {
    const dx = node.x - point.x;
    const dy = node.y - point.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      best = node;
      bestD = d;
    }
  }
  return best;
}

export const HANDLERS = {
  async "tab-eye"(state, io) {
    state.tab = "eye";
    state.eye = await io.fetchJson("/api/eye");
    io.paint(state);
  },
  async "tab-brain"(state, io) {
    state.tab = "brain";
    const t = state.brain?.t;
    state.brain = await io.fetchJson(t == null ? "/api/brain" : `/api/brain?t=${t}`);
    io.paint(state);
  },
  async "tab-chat"(state, io) {
    state.tab = "chat";
    io.paint(state);
  },
  async "tab-bus"(state, io) {
    state.tab = "bus";
    state.bus = await io.fetchJson("/api/bus");
    io.paint(state);
  },
  async "tab-score"(state, io) {
    state.tab = "score";
    state.score = await io.fetchJson("/api/score");
    io.paint(state);
  },
  async "eye-refresh"(state, io) {
    state.tab = "eye";
    state.eye = await io.fetchJson("/api/eye");
    io.paint(state);
  },
  async "brain-time"(state, io) {
    const t = Number(io.read("brain-time"));
    state.tab = "brain";
    state.brain = await io.fetchJson(`/api/brain?t=${t}`);
    io.paint(state);
  },
  async "brain-pick"(state, io) {
    const hit = nearestNode(state.brain?.nodes, io.point);
    state.selected = hit ? hit.id : null;
    state.recall = null;
    io.paint(state);
  },
  async "brain-recall"(state, io) {
    state.tab = "brain";
    if (!state.selected) {
      state.recall = { ok: false, error: "Select a memory node first." };
      io.paint(state);
      return;
    }
    const t = state.brain?.t ?? "";
    state.recall = await io.fetchJson(`/api/brain/recall?t=${t}&seed=${encodeURIComponent(state.selected)}`);
    io.paint(state);
  },
  async "chat-send"(state, io) {
    const message = io.read("chat-input").trim();
    state.tab = "chat";
    if (!message) {
      state.chatError = "Message was empty.";
      io.paint(state);
      return;
    }
    state.chatError = "";
    const result = await io.fetchJson("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!result.ok) {
      state.chatError = result.error || "The chat endpoint refused that message.";
      io.paint(state);
      return;
    }
    state.chat.push({ role: "you", text: message }, { role: "tessera", text: result.text, instrument: result.instrument });
    io.write("chat-input", "");
    io.paint(state);
  },
  async "bus-refresh"(state, io) {
    state.tab = "bus";
    state.bus = await io.fetchJson("/api/bus");
    io.paint(state);
  },
  async "score-refresh"(state, io) {
    state.tab = "score";
    state.score = await io.fetchJson("/api/score");
    io.paint(state);
  },
};
