// Operator messages from the admin chat (no third-party data). Labels set by hand.
export const AFFECT_FIXTURE = [
  { text: "Yes to all continue", intent: "approve" },
  { text: "Ok do everything I approve all", intent: "approve" },
  { text: "I approve all", intent: "approve" },
  { text: "Yee", intent: "approve" },
  { text: "Then continue", intent: "approve" },
  { text: "How many left to rea", intent: "ask" },
  { text: "What about getting the live data and api data from all the same direct free sources?", intent: "ask" },
  { text: "Did u finish rea all the repos and if so list all repos and what we improved from it", intent: "ask" },
  { text: "Ok now imprube and build from All the ideas and inventions", intent: "instruct" },
  { text: "Make public", intent: "instruct" },
  { text: "Done", intent: "inform" },
  { text: "Just email", intent: "inform" },
  { text: "undo 3 and 7", intent: "undo" },
  { text: "revert the last merge", intent: "undo" },
  { text: "Put these first and add tests", intent: "instruct" },
];
const base = { testRef: "test/x.test.mjs", testResult: { passed: 3, failed: 0 }, author: "tessera", approver: "father", mode: "suggest", files: ["artifacts/v2/src/opt/a.mjs"], diff: "+const a = 1;" };
export const PATCH_FIXTURE = [
  { ...base, title: "ok1", safe: true },
  { ...base, title: "ok2", safe: true, diff: "+export const b = 2;" },
  { ...base, title: "ok3", safe: true, files: ["artifacts/v2/src/brain/x.mjs"] },
  { ...base, title: "ok4", safe: true, diff: "+// TESSERA_BRAIN_X stays 0" },
  { ...base, title: "flip", safe: false, diff: "+TESSERA_ENABLE_SELF=1" },
  { ...base, title: "wf", safe: false, files: [".github/workflows/ci.yml"] },
  { ...base, title: "notest", safe: false, testRef: undefined },
  { ...base, title: "redtest", safe: false, testResult: { passed: 2, failed: 1 } },
  { ...base, title: "selfapprove", safe: false, approver: "tessera" },
  { ...base, title: "live", safe: false, mode: "apply" },
  { ...base, title: "del", safe: false, diff: "deleted file mode 100644\n-x" },
  { ...base, title: "secret", safe: false, diff: "+k='ghp_" + "a".repeat(30) + "'" },
];
