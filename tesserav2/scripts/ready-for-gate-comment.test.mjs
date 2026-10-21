import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { workflowPath } from "./workflow-path.mjs";
import { fileURLToPath } from "node:url";
import {
  READY_MARKER,
  findReadyComment,
  readyCommentBody,
  upsertReadyComment,
} from "./ready-for-gate-comment.mjs";

const repository = "vitalitychems-dot/TESSERA";
const head = "a".repeat(40);
const nextHead = "b".repeat(40);

function headers(link = null) {
  return { get(name) { return name.toLowerCase() === "link" ? link : null; } };
}

test("the comment names the head sha and keeps a stable marker", () => {
  const body = readyCommentBody(head);
  assert.equal(body.includes(READY_MARKER), true);
  assert.match(body, new RegExp(`ready for gate ${head}`));
  assert.throws(() => readyCommentBody("not-a-sha"));
});

test("a second run updates the marked comment instead of adding one", async () => {
  const comments = [];
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method });
    if (options.method === "GET") {
      return { ok: true, headers: headers(), json: async () => comments };
    }
    const body = JSON.parse(options.body).body;
    if (options.method === "POST") {
      const comment = { id: 41, body };
      comments.push(comment);
      return { ok: true, headers: headers(), json: async () => comment };
    }
    if (options.method === "PATCH") {
      const id = Number(url.split("/").pop());
      const comment = comments.find((item) => item.id === id);
      comment.body = body;
      return { ok: true, headers: headers(), json: async () => comment };
    }
    throw new Error(`unexpected method ${options.method}`);
  };

  const created = await upsertReadyComment({
    repository,
    prNumber: "305",
    headSha: head,
    token: "test-token",
    fetchImpl,
  });
  assert.equal(created.action, "created");
  assert.equal(created.id, 41);

  const same = await upsertReadyComment({
    repository,
    prNumber: "305",
    headSha: head,
    token: "test-token",
    fetchImpl,
  });
  assert.equal(same.action, "unchanged");
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 0);

  const updated = await upsertReadyComment({
    repository,
    prNumber: "305",
    headSha: nextHead,
    token: "test-token",
    fetchImpl,
  });
  assert.equal(updated.action, "updated");
  assert.equal(updated.id, 41);
  assert.equal(comments.length, 1);
  assert.match(comments[0].body, new RegExp(`ready for gate ${nextHead}`));
  assert.equal(calls.some((call) => call.method === "DELETE"), false);
});

test("an older marked comment is updated and a later page is followed", async () => {
  const stored = [
    { id: 9, body: "ordinary note" },
    { id: 12, body: `${READY_MARKER}\nready for gate ${"c".repeat(40)}\n` },
    { id: 15, body: `${READY_MARKER}\nready for gate ${"d".repeat(40)}\n` },
  ];
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-token");
    if (options.method === "GET" && url.endsWith("page=2")) {
      return { ok: true, headers: headers(), json: async () => stored.slice(2) };
    }
    if (options.method === "GET" && url.includes("/issues/305/comments")) {
      return {
        ok: true,
        headers: headers(`<https://api.github.com/repos/${repository}/issues/305/comments?page=2>; rel="next"`),
        json: async () => stored.slice(0, 2),
      };
    }
    if (options.method === "PATCH") {
      assert.match(url, /\/issues\/comments\/12$/);
      stored[1].body = JSON.parse(options.body).body;
      return { ok: true, headers: headers(), json: async () => stored[1] };
    }
    throw new Error(`${options.method} ${url}`);
  };
  const result = await upsertReadyComment({
    repository,
    prNumber: 305,
    headSha: head,
    token: "test-token",
    fetchImpl,
  });
  assert.equal(result.action, "updated");
  assert.equal(result.id, 12);
  assert.equal(findReadyComment(stored).id, 12);
});

test("a repeated comments page stops instead of following itself", async () => {
  const fetchImpl = async () => ({
    ok: true,
    headers: headers(`<https://api.github.com/repos/${repository}/issues/305/comments?per_page=100>; rel="next"`),
    json: async () => [],
  });
  await assert.rejects(
    () => upsertReadyComment({ repository, prNumber: "305", headSha: head, token: "test-token", fetchImpl }),
    /repeated comments page/,
  );
});

test("the workflow is pull_request only, pinned, and write is limited to the comment job", () => {
  const text = readFileSync(workflowPath("pr-gates.yml"), "utf8");
  const source = [
    readFileSync(fileURLToPath(new URL("./pr-diff-scan.mjs", import.meta.url)), "utf8"),
    readFileSync(fileURLToPath(new URL("./pr-author-check.mjs", import.meta.url)), "utf8"),
    readFileSync(fileURLToPath(new URL("./ready-for-gate-comment.mjs", import.meta.url)), "utf8"),
  ].join("\n");
  assert.equal(text.includes("pull_request_target"), false);
  assert.equal(text.includes("workflow_run"), false);
  assert.match(text, /on:\n {2}pull_request:\n {4}branches: \[main\]\n/);
  assert.doesNotMatch(text, /\n {2}push:/);
  assert.doesNotMatch(text, /schedule:/);
  assert.match(text, /DIFF_SCAN_ENFORCE: "0"/);
  assert.match(text, /needs: \[diff-scan, author-check\]/);
  assert.match(text, /if: success\(\)/);
  assert.equal(text.split("pull-requests: write").length - 1, 1);
  const ready = text.split("ready-for-gate:")[1];
  assert.match(ready, /contents: read\n {6}pull-requests: write/);
  assert.doesNotMatch(text, /contents: write/);
  assert.doesNotMatch(text, /\$\{\{\s*secrets\./);
  assert.match(text, /persist-credentials: false/);
  assert.match(text, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\.0\.1/);
  assert.doesNotMatch(text, /uses:\s+\S+@v\d/);
  assert.equal(source.includes("pull_request_target"), false);
  assert.doesNotMatch(source, /\.delete\(|method: "DELETE"|git\s+push|reset --hard/);
});
