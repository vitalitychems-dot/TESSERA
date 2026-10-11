import assert from "node:assert/strict";
import test from "node:test";
import { askRepo, filesIn, namesLike } from "./repo-ask.ts";

test("a folder count and a path come from the lists", () => {
  assert.equal(filesIn("gitbook", "history"), 3110);
  assert.equal(filesIn("gitbook", "review"), 18);
  assert.equal(filesIn("tessera", "preview"), 346);
  assert.match(askRepo("how many files") ?? "", /4099 file names/);
  assert.match(askRepo("how many files") ?? "", /10400 file names/);
  assert.match(askRepo("files in history") ?? "", /Gitbook has 3110/);
  assert.match(askRepo("files in history") ?? "", /Largest on Gitbook is archive/);
  assert.match(askRepo("files in history") ?? "", /Largest on TESSERA is/);
  assert.match(askRepo("find README.md") ?? "", /TESSERA left/);
  assert.match(askRepo("find README.md") ?? "", /Gitbook left/);
  assert.match(askRepo("files in no-such-folder") ?? "", /not a folder/);
  assert.match(askRepo("do you have review/wave-9.md") ?? "", /Gitbook/);
  assert.match(askRepo("do you have missing-file.zzz") ?? "", /not on the list/);
  assert.equal(namesLike("review/wave-9.md").includes("Gitbook review/wave-9.md"), true);
  const readmes = namesLike("README.md");
  assert.equal(readmes.some((hit) => hit.startsWith("TESSERA ")), true);
  assert.equal(readmes.some((hit) => hit.startsWith("Gitbook ")), true);
  assert.match(askRepo("find README.md") ?? "", /TESSERA README.md/);
  assert.match(askRepo("find README.md") ?? "", /Gitbook README.md/);
  assert.match(askRepo("find wave-9") ?? "", /review\/wave-9\.md/);
  assert.equal(askRepo("hello"), null);
});
