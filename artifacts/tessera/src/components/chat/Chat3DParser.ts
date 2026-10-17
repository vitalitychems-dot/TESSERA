export interface Object3DSpec {
  type: string;
  label?: string;
  color?: string;
  secondaryColor?: string;
  size?: number;
  detail?: string;
  src?: string;
}

export function parse3DObjectBlocks(text: string): { text: string; objects: Object3DSpec[] } {
  const objects: Object3DSpec[] = [];
  const regex = /\[3DOBJ:([^\]]+)\]/g;
  const cleaned = text.replace(regex, (_match, attrs) => {
    const spec: Record<string, string> = {};
    attrs.replace(/(\w+)="([^"]*)"/g, (_: string, k: string, v: string) => {
      spec[k] = v;
      return "";
    });
    if (spec.type || spec.label) {
      objects.push({
        type: spec.type || "abstract",
        label: spec.label,
        color: spec.color,
        secondaryColor: spec.secondary || spec.secondaryColor,
        size: spec.size ? parseFloat(spec.size) : undefined,
        detail: spec.detail,
        src: spec.src,
      });
    }
    return "";
  });
  return { text: cleaned.trim(), objects };
}

export function inferObjectSpec(messageText: string): Object3DSpec | null {
  const lower = messageText.toLowerCase();
  const inventionPatterns: Array<{ re: RegExp; type: string; label: string; color: string }> = [
    { re: /\b(car|vehicle|automobile|truck|bus)\b/, type: "car", label: "Vehicle", color: "#3b82f6" },
    { re: /\b(rocket|spacecraft|missile|satellite)\b/, type: "rocket", label: "Rocket", color: "#6366f1" },
    { re: /\b(house|building|home|structure|architecture)\b/, type: "building", label: "Building", color: "#10b981" },
    { re: /\b(molecule|atom|chemical|compound|dna)\b/, type: "molecule", label: "Molecule", color: "#f59e0b" },
    { re: /\b(crystal|gem|diamond|prism|mineral)\b/, type: "crystal", label: "Crystal", color: "#06b6d4" },
    { re: /\b(gear|engine|mechanism|machine|motor)\b/, type: "machine", label: "Machine", color: "#8b5cf6" },
    { re: /\b(tower|pyramid|monument|obelisk)\b/, type: "tower", label: "Tower", color: "#f97316" },
    { re: /\b(robot|android|automaton|cyborg)\b/, type: "robot", label: "Robot", color: "#a78bfa" },
    { re: /\b(sphere|ball|globe|orb|planet)\b/, type: "sphere", label: "Orb", color: "#ec4899" },
    { re: /\b(cube|box|block)\b/, type: "cube", label: "Cube", color: "#14b8a6" },
    { re: /\b(torus|donut|ring)\b/, type: "torus", label: "Torus", color: "#d946ef" },
    { re: /\b(telescope|microscope|instrument|device)\b/, type: "device", label: "Device", color: "#64748b" },
  ];
  for (const pattern of inventionPatterns) {
    if (pattern.re.test(lower)) {
      return { type: pattern.type, label: pattern.label, color: pattern.color };
    }
  }
  return null;
}
