/** Real board facts. A missing item stays missing. Nothing here is invented activity. */

export type LiveNode = {
  id: string;
  label: string;
  detail: string;
  known: boolean;
  x: number;
  y: number;
};

export function liveNodes(): LiveNode[] {
  return [
    { id: "role", label: "Role", detail: "The pen. 7F3A9C.", known: true, x: 180, y: 36 },
    { id: "files", label: "Files", detail: "81 of 272 at the root.", known: true, x: 70, y: 130 },
    { id: "gap", label: "Gap", detail: "The rest are not a program.", known: true, x: 290, y: 130 },
    { id: "routes", label: "Routes", detail: "The first module answers.", known: true, x: 70, y: 240 },
    { id: "store", label: "Store", detail: "The storefront stays out.", known: true, x: 290, y: 240 },
    { id: "check", label: "Check", detail: "Twenty checks, twenty times.", known: true, x: 180, y: 340 },
    { id: "flow", label: "Open", detail: "No screen flow chosen.", known: false, x: 90, y: 450 },
    { id: "media", label: "Open", detail: "Media review not done.", known: false, x: 270, y: 450 },
  ];
}

export function liveEdges() {
  return [
    ["role", "files"],
    ["role", "gap"],
    ["files", "routes"],
    ["gap", "store"],
    ["routes", "check"],
    ["store", "check"],
    ["check", "flow"],
    ["check", "media"],
  ] as const;
}

export function liveCount(nodes = liveNodes()) {
  const known = nodes.filter((node) => node.known).length;
  return { total: nodes.length, known, missing: nodes.length - known };
}

export const LESSON_SPOTS = [
  { id: "l0", label: "Academy", x: 45, y: 560 },
  { id: "l1", label: "Nobel", x: 135, y: 560 },
  { id: "l2", label: "Current", x: 225, y: 560 },
  { id: "l3", label: "Sigil", x: 315, y: 560 },
] as const;
