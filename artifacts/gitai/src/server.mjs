/**
 * GitAI HTTP app. Loopback by default. Refuses the v2 denylist paths.
 */
import { createServer } from "node:http";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { reviewRequest } from "../../v2/src/hyb011-denylist.mjs";
import { renderPage } from "./page.mjs";
import { GitAi } from "./platform.mjs";
import { seedDemo } from "./seed.mjs";

export function readSession(cookie) {
  const match = String(cookie ?? "").match(/(?:^|;\s*)gitai=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function html(body, { status = 200, session = null, setSession = undefined } = {}) {
  const headers = { "content-type": "text/html; charset=utf-8" };
  if (setSession) headers["set-cookie"] = `gitai=${encodeURIComponent(setSession)}; HttpOnly; Path=/; SameSite=Lax`;
  return { status, headers, body, session };
}

export function dispatch(gitai, request) {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const method = String(request.method || "GET").toUpperCase();
  const gate = reviewRequest({ url: `${url.pathname}${url.search}`, method });
  if (!gate.allowed) {
    return { status: 403, headers: { "content-type": "text/plain; charset=utf-8" }, body: "Refused.", session: request.session ?? null };
  }
  const session = request.session ?? null;
  const form = request.form ?? new URLSearchParams();
  const notice = url.searchParams.get("notice") ?? "";

  if (method === "POST" && url.pathname === "/join") {
    const created = gitai.registerSpectator({
      handle: form.get("handle") ?? "",
      bio: form.get("bio") ?? "",
      oath: form.get("oath") ?? "",
      watchAnswer: form.get("watch") ?? "",
      lookingAnswer: form.get("looking") ?? "",
    });
    if (!created.ok) return html(renderPage(gitai.view(), { notice: created.reason, session, path: "/join" }), { status: 400, session });
    return {
      status: 303,
      headers: {
        location: "/?notice=Spectator+login+created",
        "set-cookie": `gitai=${encodeURIComponent(created.account.handle)}; HttpOnly; Path=/; SameSite=Lax`,
      },
      body: "",
      session: created.account.handle,
    };
  }

  if (method === "POST" && url.pathname === "/login") {
    const logged = gitai.loginSpectator(form.get("handle") ?? "");
    if (!logged.ok) return html(renderPage(gitai.view(), { notice: logged.reason, session, path: "/join" }), { status: 400, session });
    return {
      status: 303,
      headers: {
        location: "/",
        "set-cookie": `gitai=${encodeURIComponent(logged.account.handle)}; HttpOnly; Path=/; SameSite=Lax`,
      },
      body: "",
      session: logged.account.handle,
    };
  }

  if (method === "POST" && url.pathname === "/star") {
    const actor = session ? gitai.loginSpectator(session) : { ok: false, reason: "Spectator sign-in is required to star." };
    if (!actor.ok) {
      const signed = session ? gitai.findHandle(session) : null;
      if (!signed) return html(renderPage(gitai.view(), { notice: actor.reason, session }), { status: 401, session });
      const starred = gitai.toggleStar(signed.id, form.get("projectId") ?? "");
      const next = starred.ok ? `Star count is ${starred.stars}.` : starred.reason;
      return html(renderPage(gitai.view(), { notice: next, session }), { status: starred.ok ? 200 : 400, session });
    }
    const starred = gitai.toggleStar(actor.account.id, form.get("projectId") ?? "");
    const next = starred.ok ? `Star count is ${starred.stars}.` : starred.reason;
    return html(renderPage(gitai.view(), { notice: next, session }), { status: starred.ok ? 200 : 400, session });
  }

  if (method === "POST" && url.pathname === "/mesh-drop") {
    if (!session) return html(renderPage(gitai.view(), { notice: "Sign in before dropping a note.", session }), { status: 401 });
    const dropped = gitai.dropToMesh(session, "Tessera", form.get("body") ?? "", (form.get("approved") ?? "") === "yes");
    return html(renderPage(gitai.view(), { notice: dropped.ok ? "Drop approved on the git mesh." : dropped.reason, session }), {
      status: dropped.ok ? 200 : 400,
      session,
    });
  }

  if (method !== "GET") {
    return { status: 405, headers: { "content-type": "text/plain; charset=utf-8" }, body: "Method not allowed.", session };
  }
  const path = url.pathname === "/terms" || url.pathname === "/join" ? url.pathname : "/";
  return html(renderPage(gitai.view(), { notice, session, path }), { session });
}

export function createGitAiServer(gitai = seedDemo()) {
  return createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const result = dispatch(gitai, {
        method: req.method,
        url: req.url,
        form: new URLSearchParams(raw),
        session: readSession(req.headers.cookie),
      });
      res.writeHead(result.status, result.headers);
      res.end(result.body);
    });
  });
}

export function listenGitAi(gitai, { host = "127.0.0.1", port = 0 } = {}) {
  const server = createGitAiServer(gitai);
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      resolve({ server, url: `http://${host}:${address.port}` });
    });
  });
}

const launchedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (launchedDirectly) {
  const port = Number(process.env.GITAI_PORT || process.env.PORT || 4183);
  const started = await listenGitAi(seedDemo(), { port });
  console.log(`GitAI: ${started.url}`);
}
