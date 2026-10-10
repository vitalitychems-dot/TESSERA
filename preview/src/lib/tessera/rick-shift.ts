import { roomsAt } from "./house-sim.ts";
import { localBatch } from "./rick-home.ts";
import { tryMachine } from "./spin-machine.ts";
import { workshopRun } from "./workshop.ts";

/** Times the jobs already in the room and keeps the fastest first. */

export function measureShift() {
  const jobs = [
    { name: "house", work: () => roomsAt(1).length },
    { name: "tie", work: () => workshopRun("tie", true, 0).reason.length },
    { name: "rank", work: () => localBatch(4000).count },
    { name: "spin", work: () => tryMachine(4000, 3).counts[0] },
  ];
  const order = jobs
    .map((job) => {
      const start = performance.now();
      const value = job.work();
      return { name: job.name, ms: Math.round((performance.now() - start) * 10) / 10, value };
    })
    .sort((a, b) => a.ms - b.ms || a.name.localeCompare(b.name));
  const first = order[0]?.name ?? "none";
  return { order, first, line: `Fastest ${first}. ${order.map((job) => `${job.name} ${job.ms} ms`).join(", ")}.` };
}
