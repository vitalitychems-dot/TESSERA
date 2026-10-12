#!/usr/bin/env node
// Sneakernet: carry a git repo on USB as one file.
//   node mesh-bundle.mjs create <repo-dir> <out.bundle>
//   node mesh-bundle.mjs verify <file.bundle>
//   node mesh-bundle.mjs open   <file.bundle> <new-dir>
import { execFileSync } from "node:child_process";
const [cmd, a, b] = process.argv.slice(2);
const git = (args, cwd) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();
if (cmd === "create") { git(["bundle", "create", b, "--all"], a); console.log(`wrote ${b}`); }
else if (cmd === "verify") { const heads = git(["bundle", "list-heads", a]); if (!heads.trim()) { console.error("empty bundle"); process.exit(1); } console.log("bundle ok"); }
else if (cmd === "open") { git(["clone", a, b]); console.log(`opened into ${b}`); }
else { console.error("usage: mesh-bundle.mjs create|verify|open ..."); process.exit(2); }
