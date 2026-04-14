export interface Qubit {
  id: string;
  state: { alpha: { real: number; imag: number }; beta: { real: number; imag: number } };
  measured: boolean;
  value: 0 | 1 | null;
  entangledWith: string | null;
}

export interface QuantumCircuit {
  id: string;
  qubits: Qubit[];
  gates: { gate: string; target: number; control?: number; timestamp: number }[];
  measurements: { qubitIndex: number; result: 0 | 1; probability: number }[];
}

export interface TesseractState {
  dimensions: number;
  vertices: number;
  edges: number;
  faces: number;
  cells: number;
  rotationAngle: number;
  quantumCircuits: number;
  entanglementPairs: number;
  coherence: number;
}

let circuits: QuantumCircuit[] = [];

function createQubit(id: string): Qubit {
  return {
    id,
    state: { alpha: { real: 1, imag: 0 }, beta: { real: 0, imag: 0 } },
    measured: false,
    value: null,
    entangledWith: null,
  };
}

function applyHadamard(qubit: Qubit): void {
  const sqrt2inv = 1 / Math.sqrt(2);
  const newAlpha = {
    real: sqrt2inv * (qubit.state.alpha.real + qubit.state.beta.real),
    imag: sqrt2inv * (qubit.state.alpha.imag + qubit.state.beta.imag),
  };
  const newBeta = {
    real: sqrt2inv * (qubit.state.alpha.real - qubit.state.beta.real),
    imag: sqrt2inv * (qubit.state.alpha.imag - qubit.state.beta.imag),
  };
  qubit.state = { alpha: newAlpha, beta: newBeta };
}

function applyPauliX(qubit: Qubit): void {
  const temp = qubit.state.alpha;
  qubit.state.alpha = qubit.state.beta;
  qubit.state.beta = temp;
}

function measureQubit(qubit: Qubit): { result: 0 | 1; probability: number } {
  const prob0 = qubit.state.alpha.real ** 2 + qubit.state.alpha.imag ** 2;
  const result: 0 | 1 = Math.random() < prob0 ? 0 : 1;
  qubit.measured = true;
  qubit.value = result;
  if (result === 0) {
    const norm = Math.sqrt(prob0);
    qubit.state = { alpha: { real: qubit.state.alpha.real / norm, imag: qubit.state.alpha.imag / norm }, beta: { real: 0, imag: 0 } };
  } else {
    const prob1 = 1 - prob0;
    const norm = Math.sqrt(prob1);
    qubit.state = { alpha: { real: 0, imag: 0 }, beta: { real: qubit.state.beta.real / norm, imag: qubit.state.beta.imag / norm } };
  }
  return { result, probability: result === 0 ? prob0 : 1 - prob0 };
}

export function createCircuit(numQubits: number = 4): QuantumCircuit {
  const circuit: QuantumCircuit = {
    id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    qubits: Array.from({ length: numQubits }, (_, i) => createQubit(`q${i}`)),
    gates: [],
    measurements: [],
  };
  circuits.push(circuit);
  if (circuits.length > 50) circuits = circuits.slice(-25);
  return circuit;
}

export function applyGate(circuitId: string, gate: string, target: number, control?: number): boolean {
  const circuit = circuits.find(c => c.id === circuitId);
  if (!circuit || target >= circuit.qubits.length) return false;

  const qubit = circuit.qubits[target];

  switch (gate.toUpperCase()) {
    case "H": applyHadamard(qubit); break;
    case "X": applyPauliX(qubit); break;
    case "CNOT":
      if (control !== undefined && control < circuit.qubits.length) {
        if (circuit.qubits[control].value === 1 || (!circuit.qubits[control].measured && Math.random() > 0.5)) {
          applyPauliX(qubit);
        }
        circuit.qubits[control].entangledWith = qubit.id;
        qubit.entangledWith = circuit.qubits[control].id;
      }
      break;
    default: return false;
  }

  circuit.gates.push({ gate, target, control, timestamp: Date.now() });
  return true;
}

export function measure(circuitId: string, qubitIndex: number): { result: 0 | 1; probability: number } | null {
  const circuit = circuits.find(c => c.id === circuitId);
  if (!circuit || qubitIndex >= circuit.qubits.length) return null;

  const result = measureQubit(circuit.qubits[qubitIndex]);
  circuit.measurements.push({ qubitIndex, ...result });
  return result;
}

export function measureAll(circuitId: string): { results: (0 | 1)[]; probabilities: number[] } | null {
  const circuit = circuits.find(c => c.id === circuitId);
  if (!circuit) return null;

  const results: (0 | 1)[] = [];
  const probabilities: number[] = [];
  for (let i = 0; i < circuit.qubits.length; i++) {
    const m = measureQubit(circuit.qubits[i]);
    results.push(m.result);
    probabilities.push(m.probability);
  }
  return { results, probabilities };
}

export function getTesseractState(): TesseractState {
  const entangled = circuits.reduce((s, c) => s + c.qubits.filter(q => q.entangledWith).length, 0);
  const totalQubits = circuits.reduce((s, c) => s + c.qubits.length, 0);

  return {
    dimensions: 4,
    vertices: 16,
    edges: 32,
    faces: 24,
    cells: 8,
    rotationAngle: (Date.now() / 1000) % (2 * Math.PI),
    quantumCircuits: circuits.length,
    entanglementPairs: Math.floor(entangled / 2),
    coherence: totalQubits > 0
      ? circuits.reduce((s, c) => s + c.qubits.filter(q => !q.measured).length, 0) / totalQubits
      : 1.0,
  };
}

export function getCircuit(id: string): QuantumCircuit | null {
  return circuits.find(c => c.id === id) || null;
}

export function listCircuits(): { id: string; qubits: number; gates: number; measurements: number }[] {
  return circuits.map(c => ({
    id: c.id,
    qubits: c.qubits.length,
    gates: c.gates.length,
    measurements: c.measurements.length,
  }));
}
