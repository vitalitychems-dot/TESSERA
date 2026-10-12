export type MeshHealth = "online" | "syncing" | "offline";
export function meshStatus(online: boolean, queued: number): { health: MeshHealth; label: string } {
  if (!online) return { health: "offline", label: queued ? `Offline · ${queued} waiting` : "Offline" };
  if (queued > 0) return { health: "syncing", label: `Syncing ${queued}` };
  return { health: "online", label: "Online" };
}
