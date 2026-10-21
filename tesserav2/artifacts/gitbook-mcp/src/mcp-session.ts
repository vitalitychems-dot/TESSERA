import { TOOL_DEFINITIONS, invokeTool, type GitbookService } from "./service.js";

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

const SUPPORTED_PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18"];

export function encodeMessage(payload: unknown): Buffer {
  const json = JSON.stringify(payload);
  const header = `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n`;
  return Buffer.concat([Buffer.from(header, "utf8"), Buffer.from(json, "utf8")]);
}

export function takeFrames(buffer: Uint8Array): { messages: unknown[]; rest: Uint8Array } {
  const messages: unknown[] = [];
  let rest: Buffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  while (rest.length > 0) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;
    const header = rest.subarray(0, headerEnd).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) {
      throw new Error("MCP frame is missing Content-Length");
    }
    const length = Number(match[1]);
    const start = headerEnd + 4;
    if (rest.length < start + length) break;
    const body = rest.subarray(start, start + length).toString("utf8");
    messages.push(JSON.parse(body) as unknown);
    rest = rest.subarray(start + length);
  }
  return { messages, rest };
}

function negotiate(params: unknown): string {
  const requested =
    typeof params === "object" && params !== null && "protocolVersion" in params
      ? (params as { protocolVersion?: unknown }).protocolVersion
      : undefined;
  return typeof requested === "string" && SUPPORTED_PROTOCOLS.includes(requested) ? requested : "2024-11-05";
}

function errorResponse(id: string | number | null, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export async function handleMcpMessage(
  service: GitbookService,
  message: JsonRpcRequest,
  serverInfo: { name: string; version: string },
): Promise<Record<string, unknown> | null> {
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return errorResponse(message.id ?? null, -32600, "Invalid JSON-RPC request");
  }
  const id = message.id ?? null;
  const isNotification = message.id === undefined;
  try {
    switch (message.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: negotiate(message.params),
            capabilities: { tools: { listChanged: false } },
            serverInfo,
          },
        };
      case "notifications/initialized":
        return null;
      case "ping":
        return { jsonrpc: "2.0", id, result: {} };
      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: TOOL_DEFINITIONS } };
      case "tools/call": {
        const params = (message.params ?? {}) as { name?: unknown; arguments?: unknown };
        if (typeof params.name !== "string") {
          return errorResponse(id, -32602, "tools/call requires a tool name");
        }
        const args =
          params.arguments === undefined
            ? {}
            : typeof params.arguments === "object" && params.arguments !== null && !Array.isArray(params.arguments)
              ? (params.arguments as Record<string, unknown>)
              : null;
        if (!args) return errorResponse(id, -32602, "tools/call arguments must be an object");
        try {
          const data = await invokeTool(service, params.name, args);
          return {
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: JSON.stringify(data) }], isError: false },
          };
        } catch (error) {
          const text = error instanceof Error ? error.message : "Tool failed";
          return {
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text }], isError: true },
          };
        }
      }
      default:
        if (isNotification) return null;
        return errorResponse(id, -32601, `Method not found: ${message.method}`);
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : "MCP request failed";
    return errorResponse(id, -32000, text);
  }
}
