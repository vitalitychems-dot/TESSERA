#!/usr/bin/env node
// Picks where a loop job runs. GitHub-hosted is the default. Opt-in mesh nodes only when
// TESSERA_MESH_RUNNERS=1 AND the owner off-switch (TESSERA_MESH_OWNER_OFF) is not 1. Fails safe to GitHub-hosted.
export function selectRunner(env) {
  const mesh = env.TESSERA_MESH_RUNNERS === "1" && env.TESSERA_MESH_OWNER_OFF !== "1";
  return mesh ? ["self-hosted", "linux", "tessera-mesh"] : "ubuntu-latest";
}
if (process.argv[1]?.endsWith("runner-select.mjs")) {
  const r = JSON.stringify(selectRunner(process.env));
  console.log(`runs_on=${r}`);
}
