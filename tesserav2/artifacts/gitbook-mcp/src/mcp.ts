import path from "node:path";
import { loadConfig, packageVersion, requireToken } from "./config.js";
import { createGitHubClient } from "./github.js";
import { createHttpBoundService } from "./runtime.js";
import { encodeMessage, handleMcpMessage, takeFrames, type JsonRpcRequest } from "./mcp-session.js";

export async function runStdioServer(): Promise<void> {
  const config = loadConfig();
  const client = config.token
    ? createGitHubClient({ token: requireToken(config), apiBase: config.apiBase })
    : undefined;
  const service = createHttpBoundService(config, client);
  const serverInfo = { name: "tessera-gitbook-mcp", version: packageVersion() };
  let pending: Uint8Array = Buffer.alloc(0);

  const onData = (chunk: Buffer): void => {
    pending = Buffer.concat([pending, chunk]);
    let frames: { messages: unknown[]; rest: Uint8Array };
    try {
      frames = takeFrames(pending);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bad MCP frame";
      process.stdout.write(encodeMessage({ jsonrpc: "2.0", id: null, error: { code: -32700, message } }));
      pending = Buffer.alloc(0);
      return;
    }
    pending = frames.rest;
    for (const message of frames.messages) {
      void handleMcpMessage(service, message as JsonRpcRequest, serverInfo).then((response) => {
        if (response) process.stdout.write(encodeMessage(response));
      });
    }
  };

  process.stdin.on("data", onData);
  await new Promise<void>((resolve) => {
    process.stdin.on("end", () => resolve());
  });
}

if (process.argv[1]?.endsWith(`${path.sep}mcp.js`) || process.argv[1]?.endsWith("/mcp.js")) {
  runStdioServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "gitbook mcp failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
