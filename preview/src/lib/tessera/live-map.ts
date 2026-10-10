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
    { id: "role", label: "Role", detail: "Tessera. The pen. Sigil 7F3A9C.", known: true, x: 50, y: 10 },
    { id: "files", label: "Files", detail: "81 of 272 names have a small file at the root.", known: true, x: 18, y: 28 },
    { id: "gap", label: "Gap", detail: "The other names are not a program yet.", known: true, x: 82, y: 28 },
    { id: "routes", label: "Routes", detail: "Eight duplicates stay. The first module answers.", known: true, x: 22, y: 48 },
    { id: "store", label: "Store", detail: "The storefront stays out of Tessera.", known: true, x: 78, y: 48 },
    { id: "loop", label: "Check", detail: "The same twenty checks matched twenty times.", known: true, x: 50, y: 66 },
    { id: "flow", label: "Open", detail: "One missing screen flow has not been chosen.", known: false, x: 28, y: 84 },
    { id: "media", label: "Open", detail: "The media review has not been done.", known: false, x: 72, y: 84 },
  ];
}

export function liveCount(nodes = liveNodes()) {
  const known = nodes.filter((node) => node.known).length;
  return { total: nodes.length, known, missing: nodes.length - known };
}
