#!/usr/bin/env node
/**
 * Pen health check.
 * Confirms the hosted pen and the local pen stay off, and that loopback
 * rules still match the code those pens call.
 * Does not set TESSERA_PEN_ENABLED, TESSERA_PEN_LOCAL, or any TESSERA_ENABLE_* name.
 * Does not open a socket and does not print secret values.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptUrl = import.meta.url;
const rootUrl = new URL("..", scriptUrl);

const ENV_ALLOW = ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "USER", "SHELL"];

function flagNames(env, prefix) {
  return Object.keys(env).filter((name) => name.startsWith(prefix)).sort();
}

function cleanChildEnv(parent) {
  const env = {};
  for (const name of ENV_ALLOW) {
    if (typeof parent[name] === "string" && parent[name].length > 0) env[name] = parent[name];
  }
  return env;
}

async function runChildChecks() {
  const penSwitch = await import(new URL("artifacts/api-server/src/lib/pen-switch.ts", rootUrl).href);
  const http = await import(new URL("artifacts/api-server/src/lib/tessera-llm-http.ts", rootUrl).href);
  const loopback = await import(new URL("artifacts/api-server/src/lib/pen-local/loopback.ts", rootUrl).href);

  const blank = {};
  const hostedOn = { TESSERA_PEN_ENABLED: "1" };
  const hostedWord = { TESSERA_PEN_ENABLED: "true" };
  const hostedOff = { TESSERA_PEN_ENABLED: "0" };
  const localOn = { TESSERA_PEN_LOCAL: "1" };
  const localWord = { TESSERA_PEN_LOCAL: "true" };

  const defaultUrl = loopback.DEFAULT_LOCAL_PEN_URL;
  const acceptedDefault = loopback.classifyLoopbackUrl(defaultUrl);
  const rejectedLocalhost = loopback.classifyLoopbackUrl("http://localhost:8765");
  const rejectedHttps = loopback.classifyLoopbackUrl("https://127.0.0.1:8765");
  const chatUrl = acceptedDefault.ok ? loopback.chatCompletionsUrl(acceptedDefault.url) : null;
  const hostedLoopback = http.decideChatLlmBaseUrl("http://127.0.0.1:8765/v1", blank);
  const hostedPublic = http.decideChatLlmBaseUrl("https://api.openai.com/v1", blank);
  const hostedMissing = http.decideChatLlmBaseUrl(undefined, blank);

  const report = {
    label: "TESTED",
    network: false,
    process_env_mutated: false,
    child_tessera_enable_names: flagNames(process.env, "TESSERA_ENABLE"),
    hosted_pen_enabled_in_child_env: penSwitch.isTesseraPenEnabled(),
    local_pen_enabled_in_child_env: penSwitch.isLocalPenFlagOn(),
    hosted_off_on_blank_env: penSwitch.isTesseraPenEnabled(blank) === false,
    hosted_on_only_for_one_or_true:
      penSwitch.isTesseraPenEnabled(hostedOn) === true &&
      penSwitch.isTesseraPenEnabled(hostedWord) === true &&
      penSwitch.isTesseraPenEnabled(hostedOff) === false,
    local_on_only_for_exact_one:
      penSwitch.isLocalPenFlagOn(localOn) === true &&
      penSwitch.isLocalPenFlagOn(localWord) === false &&
      penSwitch.isLocalPenFlagOn(blank) === false,
    default_local_url: defaultUrl,
    loopback_accepts_default: acceptedDefault.ok === true,
    loopback_rejects_localhost: rejectedLocalhost.ok === false,
    loopback_rejects_https: rejectedHttps.ok === false,
    local_chat_path: chatUrl ? chatUrl.pathname : null,
    hosted_loopback_base: hostedLoopback.ok ? hostedLoopback.href : null,
    hosted_chat_suffix: "/chat/completions",
    hosted_accepts_loopback_v1: hostedLoopback.ok === true,
    hosted_refuses_public_openai: hostedPublic.ok === false && hostedPublic.code === "refused",
    hosted_missing_without_url: hostedMissing.ok === false && hostedMissing.code === "missing",
  };

  const ok =
    report.child_tessera_enable_names.length === 0 &&
    report.hosted_pen_enabled_in_child_env === false &&
    report.local_pen_enabled_in_child_env === false &&
    report.hosted_off_on_blank_env &&
    report.hosted_on_only_for_one_or_true &&
    report.local_on_only_for_exact_one &&
    report.default_local_url === "http://127.0.0.1:8765" &&
    report.loopback_accepts_default &&
    report.loopback_rejects_localhost &&
    report.loopback_rejects_https &&
    report.local_chat_path === "/v1/chat/completions" &&
    report.hosted_loopback_base === "http://127.0.0.1:8765/v1" &&
    report.hosted_accepts_loopback_v1 &&
    report.hosted_refuses_public_openai &&
    report.hosted_missing_without_url;

  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exit(ok ? 0 : 1);
}

function runParent() {
  const beforeEnable = flagNames(process.env, "TESSERA_ENABLE");
  const penEnabledSet = Object.prototype.hasOwnProperty.call(process.env, "TESSERA_PEN_ENABLED");
  const penLocalSet = Object.prototype.hasOwnProperty.call(process.env, "TESSERA_PEN_LOCAL");
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--import",
      new URL("artifacts/console/register.mjs", rootUrl).pathname,
      fileURLToPath(scriptUrl),
      "--child",
    ],
    {
      cwd: fileURLToPath(rootUrl),
      env: cleanChildEnv(process.env),
      encoding: "utf8",
    },
  );
  const afterEnable = flagNames(process.env, "TESSERA_ENABLE");
  let parsed = null;
  const stdout = child.stdout ?? "";
  const line = stdout.trim().split("\n").filter((row) => row.startsWith("{")).at(-1);
  if (line) {
    try {
      parsed = JSON.parse(line);
    } catch {
      parsed = null;
    }
  }
  const summary = {
    label: "TESTED",
    network: false,
    parent_tessera_enable_names_set: beforeEnable,
    parent_tessera_pen_enabled_is_set: penEnabledSet,
    parent_tessera_pen_local_is_set: penLocalSet,
    parent_flag_names_unchanged: beforeEnable.join(",") === afterEnable.join(","),
    child_exit: child.status,
    child: parsed,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (child.stderr) process.stderr.write(child.stderr);
  if (child.error) {
    process.stderr.write(`${child.error.message}\n`);
    process.exit(1);
  }
  process.exit(child.status === 0 && parsed ? 0 : 1);
}

if (process.argv.includes("--child")) {
  await runChildChecks();
} else {
  runParent();
}
