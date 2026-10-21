/** A worker binds only when it carries her own mark. A different mark stays unbound. */

export const CURSOR_ROOM = "bc-c59f5775-5507-4e53-9b0f-789f496ab39c";

export function bindWorker(selfMark: string, name: string, mark: string) {
  if (!name.trim() || !selfMark || mark !== selfMark) return { name: name.trim(), state: "unbound" as const };
  return { name: name.trim(), state: "bound" as const };
}

export function boundNames(selfMark: string, workers: { name: string; mark: string }[]) {
  return workers
    .map((worker) => bindWorker(selfMark, worker.name, worker.mark))
    .filter((worker) => worker.state === "bound")
    .map((worker) => worker.name);
}
