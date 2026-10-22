function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Clean-room board. A card whose first line repeats an existing card is refused. */
export function createBoard() {
  const cards = [];
  return {
    add(text) {
      const first = String(text).split(/\r?\n/, 1)[0].trim();
      if (!first) return { ok: false, reason: "empty card" };
      if (cards.some((card) => card.first === first)) {
        return { ok: false, reason: "duplicate first line" };
      }
      cards.push({ first, text: String(text) });
      return { ok: true };
    },
    render() {
      const body = cards
        .map((card) => `<article data-first="${escapeHtml(card.first)}"><h2>${escapeHtml(card.first)}</h2></article>`)
        .join("");
      return `<section id="board">${body}</section>`;
    },
  };
}
