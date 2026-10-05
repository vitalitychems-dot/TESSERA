import path from "node:path";
import { loadConfig, requireToken } from "./config.js";
import { createGitHubClient } from "./github.js";
import { createHttpServer } from "./http-server.js";
import { createHttpBoundService } from "./runtime.js";

export function startHttpServer() {
  const config = loadConfig();
  const client = config.token
    ? createGitHubClient({ token: requireToken(config), apiBase: config.apiBase })
    : undefined;
  const service = createHttpBoundService(config, client);
  const server = createHttpServer(service);
  server.listen(config.httpPort, config.httpHost, () => {
    process.stderr.write(`gitbook http listening on http://${config.httpHost}:${config.httpPort}\n`);
  });
  return server;
}

if (process.argv[1]?.endsWith(`${path.sep}http.js`) || process.argv[1]?.endsWith("/http.js")) {
  startHttpServer();
}
