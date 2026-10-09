import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { dataPath } from "./app-path.mjs";

const name = process.argv[2] ?? "";
if (!/^[a-z0-9-]{1,40}$/.test(name)) {
  console.error("refused: name");
  process.exit(2);
}
const file = dataPath("tools", `${name}.mjs`);
const source = await readFile(file, "utf8");
if (/child_process|eval\(|new Function|process\.binding|rmSync|fetch\(/.test(source)) {
  console.error("refused: tool");
  process.exit(2);
}
await import(pathToFileURL(file).href);
