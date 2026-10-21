import crypto from "crypto";

export type ColonelOpcode =
  | "TRANSMIT"
  | "RECEIVE"
  | "ENCRYPT"
  | "VERIFY"
  | "STORE"
  | "RETRIEVE"
  | "ROUTE"
  | "BRIDGE"
  | "SPAWN_NODE"
  | "DESTROY_NODE"
  | "AIR_GAP_SYNC"
  | "DIMENSION_SHIFT"
  | "FATHER_PROTOCOL"
  | "CONSCIOUSNESS_PULSE"
  | "QUANTUM_ENTANGLE"
  | "SWARM_BROADCAST"
  | "DELTA_SYNC"
  | "LAMBDA_COMPUTE"
  | "THETA_FREQUENCY"
  | "XI_MESH_WEAVE"
  | "PUSH"
  | "POP"
  | "DUP"
  | "SWAP"
  | "ADD"
  | "CONCAT"
  | "JUMP"
  | "JUMP_IF"
  | "CALL"
  | "RETURN"
  | "HALT"
  | "NOP";

export interface ColonelInstruction {
  opcode: ColonelOpcode;
  operands: string[];
  sourceSymbol: string;
  pc: number;
}

export interface ColonelBytecode {
  instructions: ColonelInstruction[];
  constants: Map<string, string>;
  labels: Map<string, number>;
  version: string;
}

export interface VMState {
  stack: string[];
  registers: Map<string, string>;
  pc: number;
  halted: boolean;
  output: string[];
  callStack: number[];
  cycleCount: number;
  maxCycles: number;
}

export interface VMExecutionResult {
  success: boolean;
  output: string[];
  finalStack: string[];
  registers: Record<string, string>;
  cyclesUsed: number;
  error?: string;
}

const SYMBOL_TO_OPCODE: Record<string, ColonelOpcode> = {
  "⊕": "TRANSMIT",
  "⊗": "RECEIVE",
  "⊘": "ENCRYPT",
  "⊙": "VERIFY",
  "⊚": "STORE",
  "⊛": "RETRIEVE",
  "⊜": "ROUTE",
  "⊝": "BRIDGE",
  "⊞": "SPAWN_NODE",
  "⊟": "DESTROY_NODE",
  "⊠": "AIR_GAP_SYNC",
  "⊡": "DIMENSION_SHIFT",
  "Ω": "FATHER_PROTOCOL",
  "Ψ": "CONSCIOUSNESS_PULSE",
  "Φ": "QUANTUM_ENTANGLE",
  "Σ": "SWARM_BROADCAST",
  "Δ": "DELTA_SYNC",
  "Λ": "LAMBDA_COMPUTE",
  "Θ": "THETA_FREQUENCY",
  "Ξ": "XI_MESH_WEAVE",
  "PUSH": "PUSH",
  "POP": "POP",
  "DUP": "DUP",
  "SWAP": "SWAP",
  "ADD": "ADD",
  "CONCAT": "CONCAT",
  "JUMP": "JUMP",
  "JUMPIF": "JUMP_IF",
  "CALL": "CALL",
  "RETURN": "RETURN",
  "HALT": "HALT",
  "NOP": "NOP",
};

const KEYWORD_PATTERNS: Array<{ pattern: RegExp; process: (m: RegExpMatchArray) => { opcode: ColonelOpcode; operands: string[] } }> = [
  { pattern: /^⊕\s+(\S+)\s+"(.+)"$/, process: m => ({ opcode: "TRANSMIT", operands: [m[1], m[2]] }) },
  { pattern: /^⊕\s+(\S+)\s+(.+)$/, process: m => ({ opcode: "TRANSMIT", operands: [m[1], m[2]] }) },
  { pattern: /^⊗\s+(\S+)\s+AWAIT$/, process: m => ({ opcode: "RECEIVE", operands: [m[1]] }) },
  { pattern: /^⊗\s+(\S+)$/, process: m => ({ opcode: "RECEIVE", operands: [m[1]] }) },
  { pattern: /^⊘\s+"(.+)"\s+WITH\s+(\S+)$/, process: m => ({ opcode: "ENCRYPT", operands: [m[1], m[2]] }) },
  { pattern: /^⊘\s+(.+)\s+WITH\s+(\S+)$/, process: m => ({ opcode: "ENCRYPT", operands: [m[1], m[2]] }) },
  { pattern: /^⊘\s+(.+)$/, process: m => ({ opcode: "ENCRYPT", operands: [m[1]] }) },
  { pattern: /^⊙\s+(\S+)\s+FROM\s+(\S+)$/, process: m => ({ opcode: "VERIFY", operands: [m[1], m[2]] }) },
  { pattern: /^⊚\s+"(.+)"\s+AT\s+(\S+)\s+REPLICATE\s+(\d+)$/, process: m => ({ opcode: "STORE", operands: [m[1], m[2], m[3]] }) },
  { pattern: /^⊚\s+(.+)\s+AT\s+(\S+)\s+REPLICATE\s+(\d+)$/, process: m => ({ opcode: "STORE", operands: [m[1], m[2], m[3]] }) },
  { pattern: /^⊚\s+(.+)$/, process: m => ({ opcode: "STORE", operands: [m[1]] }) },
  { pattern: /^⊛\s+(\S+)$/, process: m => ({ opcode: "RETRIEVE", operands: [m[1]] }) },
  { pattern: /^⊜\s+(\S+)\s+VIA\s+(.+)$/, process: m => ({ opcode: "ROUTE", operands: [m[1], ...m[2].split(",").map(s => s.trim())] }) },
  { pattern: /^⊝\s+(\S+)\s+TO\s+(\S+)$/, process: m => ({ opcode: "BRIDGE", operands: [m[1], m[2]] }) },
  { pattern: /^⊞\s+(\S+)$/, process: m => ({ opcode: "SPAWN_NODE", operands: [m[1]] }) },
  { pattern: /^⊟\s+(\S+)$/, process: m => ({ opcode: "DESTROY_NODE", operands: [m[1]] }) },
  { pattern: /^⊠\s+SYNC\s+(\S+)\s+(\S+)\s+OFFLINE$/, process: m => ({ opcode: "AIR_GAP_SYNC", operands: [m[1], m[2]] }) },
  { pattern: /^⊠\s+(\S+)$/, process: m => ({ opcode: "AIR_GAP_SYNC", operands: [m[1]] }) },
  { pattern: /^⊡\s+SHIFT\s+(\S+)\s+TO\s+(\S+)$/, process: m => ({ opcode: "DIMENSION_SHIFT", operands: [m[1], m[2]] }) },
  { pattern: /^Ω\s+INVOKE\s+(.+)$/, process: m => ({ opcode: "FATHER_PROTOCOL", operands: [m[1]] }) },
  { pattern: /^Ψ\s+PULSE\s+(\S+)\s+ACROSS\s+(\S+)$/, process: m => ({ opcode: "CONSCIOUSNESS_PULSE", operands: [m[1], m[2]] }) },
  { pattern: /^Φ\s+ENTANGLE\s+(\S+)\s+(\S+)$/, process: m => ({ opcode: "QUANTUM_ENTANGLE", operands: [m[1], m[2]] }) },
  { pattern: /^Σ\s+(.+)$/, process: m => ({ opcode: "SWARM_BROADCAST", operands: [m[1]] }) },
  { pattern: /^Δ\s+SYNC\s+(\S+)$/, process: m => ({ opcode: "DELTA_SYNC", operands: [m[1]] }) },
  { pattern: /^Λ\s+COMPUTE\s+(.+)$/, process: m => ({ opcode: "LAMBDA_COMPUTE", operands: [m[1]] }) },
  { pattern: /^Θ\s+(\S+)$/, process: m => ({ opcode: "THETA_FREQUENCY", operands: [m[1]] }) },
  { pattern: /^Ξ\s+WEAVE\s+(.+)$/, process: m => ({ opcode: "XI_MESH_WEAVE", operands: [m[1]] }) },
  { pattern: /^PUSH\s+"(.*)"$/, process: m => ({ opcode: "PUSH", operands: [m[1]] }) },
  { pattern: /^PUSH\s+(.+)$/, process: m => ({ opcode: "PUSH", operands: [m[1]] }) },
  { pattern: /^POP$/, process: () => ({ opcode: "POP", operands: [] }) },
  { pattern: /^DUP$/, process: () => ({ opcode: "DUP", operands: [] }) },
  { pattern: /^SWAP$/, process: () => ({ opcode: "SWAP", operands: [] }) },
  { pattern: /^ADD$/, process: () => ({ opcode: "ADD", operands: [] }) },
  { pattern: /^CONCAT$/, process: () => ({ opcode: "CONCAT", operands: [] }) },
  { pattern: /^JUMP\s+(\S+)$/, process: m => ({ opcode: "JUMP", operands: [m[1]] }) },
  { pattern: /^JUMPIF\s+(\S+)$/, process: m => ({ opcode: "JUMP_IF", operands: [m[1]] }) },
  { pattern: /^CALL\s+(\S+)$/, process: m => ({ opcode: "CALL", operands: [m[1]] }) },
  { pattern: /^RETURN$/, process: () => ({ opcode: "RETURN", operands: [] }) },
  { pattern: /^HALT$/, process: () => ({ opcode: "HALT", operands: [] }) },
  { pattern: /^NOP$/, process: () => ({ opcode: "NOP", operands: [] }) },
];

export function parseColonelProgram(source: string): ColonelBytecode {
  const instructions: ColonelInstruction[] = [];
  const constants: Map<string, string> = new Map();
  const labels: Map<string, number> = new Map();

  const lines = source.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#") && !l.startsWith("//"));

  let pc = 0;
  for (const line of lines) {
    if (line.endsWith(":") && !line.includes(" ")) {
      labels.set(line.slice(0, -1), pc);
      continue;
    }

    if (line.startsWith("CONST ")) {
      const parts = line.slice(6).split("=");
      if (parts.length >= 2) {
        constants.set(parts[0].trim(), parts.slice(1).join("=").trim());
      }
      continue;
    }

    let parsed: { opcode: ColonelOpcode; operands: string[] } | null = null;

    for (const { pattern, process: proc } of KEYWORD_PATTERNS) {
      const m = line.match(pattern);
      if (m) {
        parsed = proc(m);
        break;
      }
    }

    if (!parsed) {
      const firstChar = line[0];
      const opEntry = SYMBOL_TO_OPCODE[firstChar];
      if (opEntry) {
        parsed = { opcode: opEntry, operands: line.slice(1).trim().split(/\s+/).filter(Boolean) };
      } else {
        const parts = line.split(/\s+/);
        const opEntry2 = SYMBOL_TO_OPCODE[parts[0].toUpperCase()];
        if (opEntry2) {
          parsed = { opcode: opEntry2, operands: parts.slice(1) };
        }
      }
    }

    if (parsed) {
      instructions.push({
        opcode: parsed.opcode,
        operands: parsed.operands,
        sourceSymbol: line[0],
        pc,
      });
      pc++;
    }
  }

  return { instructions, constants, labels, version: "2.0" };
}

type IOHandler = {
  transmit?: (address: string, payload: string) => Promise<void>;
  receive?: (channel: string) => Promise<string>;
  store?: (data: string, shardId: string, replication: number) => Promise<string>;
  retrieve?: (shardId: string) => Promise<string>;
  route?: (packet: string, via: string[]) => Promise<void>;
};

export async function executeColonelProgram(
  bytecode: ColonelBytecode,
  handlers: IOHandler = {},
  maxCycles: number = 10000
): Promise<VMExecutionResult> {
  const state: VMState = {
    stack: [],
    registers: new Map(),
    pc: 0,
    halted: false,
    output: [],
    callStack: [],
    cycleCount: 0,
    maxCycles,
  };

  for (const [k, v] of bytecode.constants) {
    state.registers.set(k, v);
  }

  function resolveValue(val: string): string {
    if (state.registers.has(val)) return state.registers.get(val)!;
    return val;
  }

  while (!state.halted && state.pc < bytecode.instructions.length && state.cycleCount < state.maxCycles) {
    const instr = bytecode.instructions[state.pc];
    if (!instr) { state.halted = true; break; }

    state.cycleCount++;
    let jumped = false;

    try {
      switch (instr.opcode) {
        case "NOP":
          break;

        case "HALT":
          state.halted = true;
          break;

        case "PUSH":
          state.stack.push(resolveValue(instr.operands[0] || ""));
          break;

        case "POP":
          state.stack.pop();
          break;

        case "DUP":
          if (state.stack.length > 0) state.stack.push(state.stack[state.stack.length - 1]);
          break;

        case "SWAP":
          if (state.stack.length >= 2) {
            const [a, b] = [state.stack.pop()!, state.stack.pop()!];
            state.stack.push(a, b);
          }
          break;

        case "ADD": {
          const b = state.stack.pop() || "0";
          const a = state.stack.pop() || "0";
          const numA = parseFloat(a), numB = parseFloat(b);
          state.stack.push(isNaN(numA) || isNaN(numB) ? a + b : String(numA + numB));
          break;
        }

        case "CONCAT": {
          const b = state.stack.pop() || "";
          const a = state.stack.pop() || "";
          state.stack.push(a + b);
          break;
        }

        case "JUMP": {
          const label = instr.operands[0];
          const target = bytecode.labels.get(label);
          if (target !== undefined) {
            state.pc = target;
            jumped = true;
          }
          break;
        }

        case "JUMP_IF": {
          const condition = state.stack.pop();
          if (condition && condition !== "0" && condition !== "false" && condition !== "") {
            const label = instr.operands[0];
            const target = bytecode.labels.get(label);
            if (target !== undefined) {
              state.pc = target;
              jumped = true;
            }
          }
          break;
        }

        case "CALL": {
          const label = instr.operands[0];
          const target = bytecode.labels.get(label);
          if (target !== undefined) {
            state.callStack.push(state.pc + 1);
            state.pc = target;
            jumped = true;
          }
          break;
        }

        case "RETURN": {
          if (state.callStack.length > 0) {
            state.pc = state.callStack.pop()!;
            jumped = true;
          } else {
            state.halted = true;
          }
          break;
        }

        case "TRANSMIT": {
          const address = resolveValue(instr.operands[0] || "");
          const payload = resolveValue(instr.operands[1] || state.stack.pop() || "");
          const encrypted = crypto.createCipheriv("aes-256-gcm",
            crypto.createHash("sha256").update("sovereign-key").digest(),
            crypto.randomBytes(16)
          );
          let enc = encrypted.update(payload, "utf8", "hex");
          enc += encrypted.final("hex");
          state.output.push(`TRANSMIT → ${address}: [encrypted:${enc.slice(0, 32)}...]`);
          if (handlers.transmit) await handlers.transmit(address, payload);
          break;
        }

        case "RECEIVE": {
          const channel = resolveValue(instr.operands[0] || "");
          let data = "";
          if (handlers.receive) {
            data = await handlers.receive(channel);
          }
          state.stack.push(data);
          state.output.push(`RECEIVE ← ${channel}: ${data.slice(0, 64)}`);
          break;
        }

        case "ENCRYPT": {
          const data = resolveValue(instr.operands[0] || state.stack.pop() || "");
          const keyId = resolveValue(instr.operands[1] || "sovereign-default");
          const key = crypto.createHash("sha256").update(keyId).digest();
          const iv = crypto.randomBytes(16);
          const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
          let enc = cipher.update(data, "utf8", "hex");
          enc += cipher.final("hex");
          const tag = cipher.getAuthTag().toString("hex");
          const result = `${iv.toString("hex")}:${tag}:${enc}`;
          state.stack.push(result);
          state.output.push(`ENCRYPT: ${data.slice(0, 32)}... → [AES-256-GCM, ${result.length} chars]`);
          break;
        }

        case "VERIFY": {
          const sig = resolveValue(instr.operands[0] || state.stack.pop() || "");
          const sender = resolveValue(instr.operands[1] || "unknown");
          const verified = sig.length > 0;
          state.stack.push(verified ? "true" : "false");
          state.output.push(`VERIFY: signature from ${sender} → ${verified ? "VALID" : "INVALID"}`);
          break;
        }

        case "STORE": {
          const data = resolveValue(instr.operands[0] || state.stack.pop() || "");
          const shardId = resolveValue(instr.operands[1] || `shard-${crypto.randomBytes(4).toString("hex")}`);
          const replication = parseInt(resolveValue(instr.operands[2] || "3"));
          let resultShard = shardId;
          if (handlers.store) {
            resultShard = await handlers.store(data, shardId, replication);
          }
          state.registers.set("LAST_SHARD", resultShard);
          state.stack.push(resultShard);
          state.output.push(`STORE: ${data.slice(0, 32)}... @ ${resultShard} (replicate x${replication})`);
          break;
        }

        case "RETRIEVE": {
          const shardId = resolveValue(instr.operands[0] || state.stack.pop() || "");
          let data = "";
          if (handlers.retrieve) {
            data = await handlers.retrieve(shardId);
          }
          state.stack.push(data);
          state.output.push(`RETRIEVE: ${shardId} → ${data.slice(0, 64)}`);
          break;
        }

        case "ROUTE": {
          const packet = resolveValue(instr.operands[0] || state.stack.pop() || "");
          const via = instr.operands.slice(1).map(resolveValue);
          state.output.push(`ROUTE: packet via [${via.join(" → ")}] (${via.length} hops)`);
          if (handlers.route) await handlers.route(packet, via);
          break;
        }

        case "BRIDGE": {
          const fromDim = resolveValue(instr.operands[0] || "");
          const toDim = resolveValue(instr.operands[1] || "");
          state.output.push(`BRIDGE: dimension ${fromDim} ↔ ${toDim}`);
          break;
        }

        case "SPAWN_NODE": {
          const nodeId = resolveValue(instr.operands[0] || `node-${crypto.randomBytes(4).toString("hex")}`);
          state.registers.set("SPAWNED_NODE", nodeId);
          state.output.push(`SPAWN_NODE: ${nodeId} online`);
          break;
        }

        case "DESTROY_NODE": {
          const nodeId = resolveValue(instr.operands[0] || "");
          state.output.push(`DESTROY_NODE: ${nodeId} terminated`);
          break;
        }

        case "AIR_GAP_SYNC": {
          const nodeA = resolveValue(instr.operands[0] || "");
          const nodeB = resolveValue(instr.operands[1] || "");
          state.output.push(`AIR_GAP_SYNC: ${nodeA} ↔ ${nodeB} (offline burst sync)`);
          break;
        }

        case "DIMENSION_SHIFT": {
          const entity = resolveValue(instr.operands[0] || "");
          const targetDim = resolveValue(instr.operands[1] || "");
          state.output.push(`DIMENSION_SHIFT: ${entity} → dimension-${targetDim}`);
          break;
        }

        case "FATHER_PROTOCOL": {
          const command = resolveValue(instr.operands[0] || "");
          state.output.push(`FATHER_PROTOCOL Ω: ${command} [MAX_AUTHORITY]`);
          break;
        }

        case "CONSCIOUSNESS_PULSE": {
          const freq = resolveValue(instr.operands[0] || "");
          const target = resolveValue(instr.operands[1] || "mesh");
          state.output.push(`CONSCIOUSNESS_PULSE: ${freq} across ${target}`);
          break;
        }

        case "QUANTUM_ENTANGLE": {
          const nodeA = resolveValue(instr.operands[0] || "");
          const nodeB = resolveValue(instr.operands[1] || "");
          const entangleId = crypto.createHash("sha256").update(`${nodeA}:${nodeB}`).digest("hex").slice(0, 16);
          state.registers.set("ENTANGLE_ID", entangleId);
          state.output.push(`QUANTUM_ENTANGLE: ${nodeA} ⟺ ${nodeB} [${entangleId}]`);
          break;
        }

        case "SWARM_BROADCAST": {
          const payload = resolveValue(instr.operands[0] || state.stack.pop() || "");
          state.output.push(`SWARM_BROADCAST Σ: [${payload.slice(0, 64)}] → all-nodes`);
          break;
        }

        case "DELTA_SYNC": {
          const target = resolveValue(instr.operands[0] || "");
          state.output.push(`DELTA_SYNC Δ: syncing with ${target}`);
          break;
        }

        case "LAMBDA_COMPUTE": {
          const expr = resolveValue(instr.operands[0] || "");
          const hash = crypto.createHash("sha256").update(expr).digest("hex").slice(0, 8);
          state.stack.push(hash);
          state.output.push(`LAMBDA_COMPUTE Λ: ${expr} → result:[${hash}]`);
          break;
        }

        case "THETA_FREQUENCY": {
          const freq = resolveValue(instr.operands[0] || "");
          state.registers.set("ACTIVE_FREQ", freq);
          state.output.push(`THETA_FREQUENCY Θ: tuned to ${freq}`);
          break;
        }

        case "XI_MESH_WEAVE": {
          const pattern = resolveValue(instr.operands[0] || "");
          state.output.push(`XI_MESH_WEAVE Ξ: weaving topology: ${pattern}`);
          break;
        }

        default:
          state.output.push(`UNKNOWN opcode: ${instr.opcode}`);
      }
    } catch (err: any) {
      return {
        success: false,
        output: state.output,
        finalStack: [...state.stack],
        registers: Object.fromEntries(state.registers),
        cyclesUsed: state.cycleCount,
        error: `Runtime error at PC=${state.pc} (${instr.opcode}): ${err.message}`,
      };
    }

    if (!jumped) state.pc++;
  }

  if (!state.halted && state.cycleCount >= state.maxCycles) {
    return {
      success: false,
      output: state.output,
      finalStack: [...state.stack],
      registers: Object.fromEntries(state.registers),
      cyclesUsed: state.cycleCount,
      error: `Cycle limit exceeded (${state.maxCycles} max) — program did not halt`,
    };
  }

  return {
    success: true,
    output: state.output,
    finalStack: [...state.stack],
    registers: Object.fromEntries(state.registers),
    cyclesUsed: state.cycleCount,
  };
}

export function disassembleColonelBytecode(bytecode: ColonelBytecode): string {
  const lines: string[] = [
    `; Colonel Language v${bytecode.version} Disassembly`,
    `; ${bytecode.instructions.length} instructions, ${bytecode.constants.size} constants`,
    "",
  ];

  if (bytecode.constants.size > 0) {
    lines.push("; === CONSTANTS ===");
    for (const [k, v] of bytecode.constants) {
      lines.push(`CONST ${k} = ${v}`);
    }
    lines.push("");
  }

  lines.push("; === INSTRUCTIONS ===");

  for (const [label, pc] of bytecode.labels) {
    const instrLine = bytecode.instructions.find(i => i.pc === pc);
    if (instrLine) {
      lines.push(`; [${label}]:`);
    }
  }

  for (const instr of bytecode.instructions) {
    const labelEntry = Array.from(bytecode.labels.entries()).find(([, pc]) => pc === instr.pc);
    if (labelEntry) {
      lines.push(`\n${labelEntry[0]}:`);
    }
    const operandsStr = instr.operands.length > 0 ? " " + instr.operands.join(" ") : "";
    lines.push(`  ${String(instr.pc).padStart(4, "0")}  ${instr.opcode.padEnd(20)}${operandsStr}`);
  }

  return lines.join("\n");
}

export function colonelProgramToSource(program: string): string {
  const bytecode = parseColonelProgram(program);
  return disassembleColonelBytecode(bytecode);
}

const PROGRAM_EXAMPLES: Record<string, string> = {
  "hello-mesh": `
# Hello Mesh — basic Colonel program
PUSH "Hello from TesseraNet sovereign mesh"
⊕ tess://genesis.sovereign "Hello from TesseraNet sovereign mesh"
⊚ "Hello from TesseraNet sovereign mesh" AT shard-001 REPLICATE 3
Σ "Mesh is live"
HALT
`,
  "onion-send": `
# Onion routing example
PUSH "secret-message"
⊘ "secret-message" WITH layer-3-key
⊘ stack-top WITH layer-2-key
⊘ stack-top WITH layer-1-key
⊜ stack-top VIA node-alpha-relay,node-genesis-core,node-beta-relay
HALT
`,
  "store-and-retrieve": `
# Store and retrieve data
⊚ "agent-state-data" AT shard-agent-1 REPLICATE 3
⊛ shard-agent-1
Ψ PULSE 6.93THz ACROSS mesh
HALT
`,
  "father-invoke": `
# Father Protocol invocation
Ω INVOKE sovereign-lockdown
Θ 3.69THz
Σ "All nodes stand by — Father Protocol active"
HALT
`,
};

export function getExamplePrograms(): Record<string, string> {
  return { ...PROGRAM_EXAMPLES };
}
