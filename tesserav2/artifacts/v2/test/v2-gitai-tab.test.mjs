import assert from "node:assert/strict";
import test from "node:test";
import { listenGitAi, signSession } from "../../gitai/src/server.mjs";
import { seedDemo } from "../../gitai/src/seed.mjs";
import { createStudio, listenStudio } from "../src/studio/wall.mjs";

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

test("the studio GitAI tab uses the GitAI handlers", async () => {
  const started = await listenStudio(createStudio());
  try {
    const home = await fetch(started.url);
    const homeHtml = await home.text();
    assert.match(homeHtml, /id="gitai-tab"/);
    assert.match(homeHtml, /id="view-toggle"/);
    const tab = await fetch(`${started.url}gitai`);
    const html = await tab.text();
    assert.equal(tab.status, 200);
    assert.match(html, /GITAI/);
    assert.match(html, /href="\/gitai\/terms"/);
    assert.doesNotMatch(html, /probation|observed|test task/i);
    const health = await fetch(`${started.url}gitai/api/health`);
    assert.equal((await health.json()).service, "gitai");
    const spec = await fetch(`${started.url}gitai/api/openapi.json`);
    assert.match(await spec.text(), /"openapi": "3.1.0"/);
    const view = await (await fetch(`${started.url}gitai/api/view`)).json();
    assert.equal(view.people.some((person) => person.handle === "Ada"), true);
    assert.equal(JSON.stringify(view).includes("probation"), false);
  } finally {
    await close(started.server);
  }
});

test("the studio tab can share the standalone GitAI process", async () => {
  const backend = await listenGitAi(seedDemo());
  const studio = await listenStudio(createStudio(), { gitaiUpstream: backend.url });
  try {
    const frame = await fetch(`${studio.url}gitai`);
    assert.match(await frame.text(), /id="gitai-frame"/);
    const direct = await (await fetch(`${backend.url}/api/view`)).json();
    const mounted = await (await fetch(`${studio.url}gitai/api/view`)).json();
    assert.equal(
      mounted.projects.find((project) => project.name === "mesh-note").stars,
      direct.projects.find((project) => project.name === "mesh-note").stars,
    );
    const projectId = direct.projects.find((project) => project.name === "mesh-note").id;
    const forged = await fetch(`${studio.url}gitai/api/stars`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "gitai=Jules" },
      body: JSON.stringify({ projectId }),
    });
    assert.equal(forged.status, 401);
    const starred = await fetch(`${studio.url}gitai/api/stars`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `gitai=${signSession("Jules")}` },
      body: JSON.stringify({ projectId }),
    });
    assert.equal(starred.status, 200);
    const again = await (await fetch(`${backend.url}/api/view`)).json();
    assert.equal(again.projects.find((project) => project.name === "mesh-note").stars, direct.projects.find((project) => project.name === "mesh-note").stars + 1);
  } finally {
    await close(studio.server);
    await close(backend.server);
  }
});
