import { useState } from "react";
import { penStatus } from "@/lib/tessera/chat";

const SNIPPET = `const base = (process.env.TESSERA_BASE_URL ?? "https://api.x.ai/v1").replace(/\\/$/, "");
const response = await fetch(base + "/chat/completions", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + (process.env.TESSERA_API_KEY ?? process.env.XAI_API_KEY),
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: process.env.TESSERA_MODEL ?? "grok-4.5",
    messages: [{ role: "user", content: "Explain this in three honest lines." }],
  }),
});
const body = await response.json();
console.log(body.choices?.[0]?.message?.content);`;

export function CodeView() {
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function check() {
    const pen = await penStatus();
    setStatus(
      pen.configured
        ? `This server can call ${pen.vendor} ${pen.model}. There is no mesh and no installed SDK.`
        : "No API key is set on this server. There is no mesh and no installed SDK.",
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
    } catch {
      setStatus("Could not copy from this browser. Select the text instead.");
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Code</p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">A client that can actually run</h2>
        <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm text-fg">
          <li>Do not run npm install @tessera/sdk @tessera/mesh. Both names return 404 on npm. The local client is src/lib/tessera/sdk.ts.</li>
          <li>There is no Agent Profile credentials page in the repositories read so far.</li>
          <li>Set TESSERA_API_KEY on the server. It does nothing useful until TESSERA_BASE_URL points at your own server. Until then the pen is xAI grok-4.5.</li>
          <li>Copy the block below. The local client refuses mesh.tessera.sovereign before it sends anything.</li>
        </ol>
        <pre className="mt-5 overflow-x-auto rounded-xl border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-fg">{SNIPPET}</pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void copy()} className="inline-flex h-11 items-center rounded-lg border border-border-strong px-4 text-sm text-fg">
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={() => void check()} className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg">
            Check this server
          </button>
        </div>
        {status ? <p className="mt-3 text-sm text-fg">{status}</p> : null}
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Until TESSERA_BASE_URL is set, the snippet calls xAI. It does not call a model named tessera-sovereign-v3, because that model is not loaded here.
        </p>
        <h3 className="mt-8 text-sm font-medium text-fg">The mesh snippet does not run</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <span className="text-fg">require("@tessera/mesh")</span> fails with MODULE_NOT_FOUND. npm has no such package. The saved TESS files do contain a mesh, and it is not this snippet. It is an in-memory list of browser sessions on one server, gated by a token. No peer is connected in this chamber. The old page that lists Tessera Core with 27 peers and 4.8 GB/s is written as fixed numbers in SovereignMeshPage.tsx. Those numbers are not a live network, so they are not shown here as status.
        </p>
        <h3 className="mt-8 text-sm font-medium text-fg">The wallet snippet does not run</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          require("@tessera/economy") fails with MODULE_NOT_FOUND. npm has no such package. TokenEconomyPage.tsx stores a fixed supply of 963,000,000 TSRT and a fixed reward list. No balance was read and no transfer was sent. This chamber will not create a wallet, hold a private key, or pay a council reward.
        </p>
        <h3 className="mt-8 text-sm font-medium text-fg">The webhook snippet does not run</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          @tessera/events is not on npm, and require fails with MODULE_NOT_FOUND. No saved file defines SovereignEvents. Nothing is listening on port 3000. No vote, agent, or mesh event was received. A webhook secret is not stored here.
        </p>
      </div>
    </div>
  );
}
