const DOC_TYPES = new Set(["doc", "module", "source", "code"]);
const TASK_TYPES = new Set(["task", "decision"]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Task and doc cards drawn only from the local graph. No remote enrichers. */
export function libraryNodes(graph) {
  const nodes = [];
  for (const entity of graph.entities.values()) {
    let kind = "";
    if (DOC_TYPES.has(entity.entityType)) kind = "doc";
    else if (TASK_TYPES.has(entity.entityType)) kind = "task";
    if (!kind) continue;
    nodes.push({ name: entity.name, kind, observations: entity.observations });
  }
  return nodes;
}

export function renderLibrary(graph) {
  const cards = libraryNodes(graph)
    .map((node) => {
      const line = node.observations[0] ?? "";
      return `<article data-kind="${node.kind}" data-name="${escapeHtml(node.name)}"><h2>${escapeHtml(node.name)}</h2><p>${escapeHtml(line)}</p></article>`;
    })
    .join("");
  return `<section id="library">${cards}</section>`;
}
