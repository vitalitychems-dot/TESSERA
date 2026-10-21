/**
 * Online badge. The inputs are navigator.onLine and the offline queue length.
 */
import { meshStatus } from "../../../../preview/src/lib/tessera/mesh-status.ts";

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderBadge({ onLine, queued }) {
  const status = meshStatus(Boolean(onLine), queued);
  return `<p class="mesh-badge" data-health="${status.health}" data-online="${onLine ? "true" : "false"}" data-queued="${queued}">${escapeHtml(status.label)}</p>`;
}
