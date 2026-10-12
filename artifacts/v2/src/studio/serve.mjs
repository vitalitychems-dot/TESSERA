/**
 * Open the 3D studio in a browser.
 *   pnpm --filter @workspace/v2 studio
 */
import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCivic } from "./civic.mjs";
import { loadCivic } from "./civic-store.mjs";
import { createStudio, listenStudio } from "./wall.mjs";
import { createMonitor, fakeWorker } from "./worker-stream.mjs";

export async function openDemoStudio({ port = 0, civicPath = null } = {}) {
  const studio = createStudio();
  const monitor = createMonitor();
  studio.postGoal("Lay out the offices");
  studio.runNext();
  studio.finishRunning();
  studio.runNext();
  fakeWorker(monitor, "g1-work");
  const saved = civicPath ? loadCivic(civicPath) : null;
  const civic = createCivic(saved);
  if (!saved) {
    const proposal = civic.propose("worker", {
      title: "Raise a reading room",
      kind: "upgrade",
      change: { agentId: "worker", levels: 1 },
    });
    civic.vote("worker", proposal.id, "yes");
  }
  civic.tick({ tasks: studio.state().tasks, events: monitor.list() });
  return listenStudio(studio, { monitor, port, civic, civicPath });
}

const launchedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (launchedDirectly) {
  const civicPath = join(dirname(fileURLToPath(import.meta.url)), "../../data/civic-world.json");
  const started = await openDemoStudio({ port: Number(process.env.PORT || 4173), civicPath });
  console.log(`Tessera 3D studio: ${started.url}`);
  console.log(`2D wall: ${started.url}?view=2d`);
}
