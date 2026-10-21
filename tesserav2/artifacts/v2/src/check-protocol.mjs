import { checkExamples } from "./studio/protocol.mjs";

const errors = checkExamples();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`protocol ok (${errors.length} errors)`);
