/**
 * Open the 3D studio in a browser.
 *   pnpm --filter @workspace/v2 studio
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createStudio, listenStudio } from "./wall.mjs";
import { createMonitor, fakeWorker } from "./worker-stream.mjs";

export async function openDemoStudio({ port = 0 } = {}) {
  const studio = createStudio();
  const monitor = createMonitor();
  studio.postGoal("Lay out the offices");
  studio.runNext();
  studio.finishRunning();
  studio.runNext();
  fakeWorker(monitor, "g1-work");
  return listenStudio(studio, { monitor, port });
}

const launchedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (launchedDirectly) {
  const started = await openDemoStudio({ port: Number(process.env.PORT || 4173) });
  console.log(`Tessera 3D studio: ${started.url}`);
  console.log(`2D wall: ${started.url}?view=2d`);
}
