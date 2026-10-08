import assert from "node:assert/strict";
import test from "node:test";
import { TesseraClient } from "../src/lib/tessera/sdk.ts";

test("the pictured mesh host is refused before any request", async () => {
  const client = new TesseraClient({
    apiKey: "not-sent",
    meshEndpoint: "https://mesh.tessera.sovereign",
  });
  await assert.rejects(
    () => client.intelligence.complete({ prompt: "hello", model: "tessera-sovereign-v3" }),
    /does not resolve/,
  );
});

test("a missing address is refused", async () => {
  const client = new TesseraClient({ apiKey: "not-sent" });
  await assert.rejects(() => client.intelligence.complete({ prompt: "hello" }), /baseUrl/);
});
