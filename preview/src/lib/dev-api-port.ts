// The desk gate reads API_SERVER_PORT and fails closed when it is unset or
// invalid. Only the Vite dev server may fill a blank value, and only from a
// valid TESSERA_API_PORT. It does not invent a port. Production preview and
// builds leave the variable unset. An already-set value is left unchanged,
// including an invalid one, so the gate still fails closed.

const PORT_TEXT = /^[1-9][0-9]{0,4}$/;

export function fillDevApiServerPort(
  command: string,
  mode: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (command !== "serve" || mode !== "development") return;
  if (env.API_SERVER_PORT?.trim()) return;
  const suitePort = env.TESSERA_API_PORT?.trim();
  if (!suitePort || !PORT_TEXT.test(suitePort)) return;
  const port = Number(suitePort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return;
  env.API_SERVER_PORT = suitePort;
}
