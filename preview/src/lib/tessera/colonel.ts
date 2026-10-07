/** Stack machine taken from 8/x/tess/server/colonel-vm.ts in Drive archive 8-2.
 *  Arithmetic and jumps run. Mesh, radio, and consciousness opcodes are recorded and not sent. */

export type ColonelResult = {
  ok: boolean;
  stack: string[];
  output: string[];
  cycles: number;
  error?: string;
};

type Op = { opcode: string; operands: string[] };

const LINE: Array<{ pattern: RegExp; opcode: string; operands: (m: RegExpMatchArray) => string[] }> = [
  { pattern: /^PUSH\s+"(.*)"$/, opcode: "PUSH", operands: (m) => [m[1]] },
  { pattern: /^PUSH\s+(.+)$/, opcode: "PUSH", operands: (m) => [m[1]] },
  { pattern: /^POP$/, opcode: "POP", operands: () => [] },
  { pattern: /^DUP$/, opcode: "DUP", operands: () => [] },
  { pattern: /^SWAP$/, opcode: "SWAP", operands: () => [] },
  { pattern: /^ADD$/, opcode: "ADD", operands: () => [] },
  { pattern: /^CONCAT$/, opcode: "CONCAT", operands: () => [] },
  { pattern: /^JUMP\s+(\S+)$/, opcode: "JUMP", operands: (m) => [m[1]] },
  { pattern: /^JUMPIF\s+(\S+)$/, opcode: "JUMP_IF", operands: (m) => [m[1]] },
  { pattern: /^CALL\s+(\S+)$/, opcode: "CALL", operands: (m) => [m[1]] },
  { pattern: /^RETURN$/, opcode: "RETURN", operands: () => [] },
  { pattern: /^HALT$/, opcode: "HALT", operands: () => [] },
  { pattern: /^NOP$/, opcode: "NOP", operands: () => [] },
  { pattern: /^Λ\s+COMPUTE\s+(.+)$/, opcode: "LAMBDA_COMPUTE", operands: (m) => [m[1]] },
];

export function runColonel(source: string, maxCycles = 1000): ColonelResult {
  const instructions: Op[] = [];
  const labels = new Map<string, number>();
  const registers = new Map<string, string>();
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    if (line.endsWith(":") && !line.includes(" ")) {
      labels.set(line.slice(0, -1), instructions.length);
      continue;
    }
    if (line.startsWith("CONST ")) {
      const parts = line.slice(6).split("=");
      if (parts.length >= 2) registers.set(parts[0].trim(), parts.slice(1).join("=").trim());
      continue;
    }
    const match = LINE.find((item) => line.match(item.pattern));
    if (!match) {
      return { ok: false, stack: [], output: [], cycles: 0, error: `Unknown line: ${line}` };
    }
    const found = line.match(match.pattern)!;
    instructions.push({ opcode: match.opcode, operands: match.operands(found) });
  }

  const stack: string[] = [];
  const output: string[] = [];
  const callStack: number[] = [];
  let pc = 0;
  let cycles = 0;
  let halted = false;

  const resolve = (value: string) => (registers.has(value) ? registers.get(value)! : value);

  while (!halted && pc < instructions.length && cycles < maxCycles) {
    const instr = instructions[pc];
    cycles += 1;
    let jumped = false;
    switch (instr.opcode) {
      case "NOP":
        break;
      case "HALT":
        halted = true;
        break;
      case "PUSH":
        stack.push(resolve(instr.operands[0] ?? ""));
        break;
      case "POP":
        stack.pop();
        break;
      case "DUP":
        if (stack.length > 0) stack.push(stack[stack.length - 1]);
        break;
      case "SWAP":
        if (stack.length >= 2) {
          const b = stack.pop()!;
          const a = stack.pop()!;
          stack.push(b, a);
        }
        break;
      case "ADD": {
        const b = stack.pop() ?? "0";
        const a = stack.pop() ?? "0";
        const left = Number(a);
        const right = Number(b);
        stack.push(Number.isFinite(left) && Number.isFinite(right) ? String(left + right) : a + b);
        break;
      }
      case "CONCAT": {
        const b = stack.pop() ?? "";
        const a = stack.pop() ?? "";
        stack.push(a + b);
        break;
      }
      case "JUMP":
      case "JUMP_IF":
      case "CALL": {
        const take = instr.opcode !== "JUMP_IF" || !["", "0", "false"].includes(stack.pop() ?? "");
        const target = labels.get(instr.operands[0] ?? "");
        if (take && target !== undefined) {
          if (instr.opcode === "CALL") callStack.push(pc + 1);
          pc = target;
          jumped = true;
        }
        break;
      }
      case "RETURN":
        if (callStack.length > 0) {
          pc = callStack.pop()!;
          jumped = true;
        } else halted = true;
        break;
      case "LAMBDA_COMPUTE":
        output.push(`LAMBDA_COMPUTE not hashed in this copy: ${resolve(instr.operands[0] ?? "")}`);
        break;
      default:
        output.push(`${instr.opcode} was not sent. There is no mesh.`);
    }
    if (!jumped) pc += 1;
  }

  if (!halted && cycles >= maxCycles) {
    return { ok: false, stack, output, cycles, error: `Stopped after ${maxCycles} cycles.` };
  }
  return { ok: true, stack, output, cycles };
}
