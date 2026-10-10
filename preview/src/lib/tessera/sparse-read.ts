/** One small source file. The rest of the tree stays where it is. */

export function pickSmallest(files: readonly { name: string; size: number; type: string }[], cap = 20000) {
  return (
    files
      .filter(
        (file) =>
          file.type === "file" &&
          file.size > 0 &&
          file.size <= cap &&
          /\.(py|js|ts|rs|mjs)$/.test(file.name) &&
          !file.name.startsWith(".") &&
          !/config|prettier|commitlint|eslint|babel/i.test(file.name),
      )
      .sort((a, b) => a.size - b.size || a.name.localeCompare(b.name))[0] ?? null
  );
}

export function branchCase(kind: "selector" | "sequence") {
  if (kind === "selector") return { start: false, optOut: true };
  return { start: true, optOut: false };
}

export function configCell() {
  let value: unknown = null;
  return {
    init(next: unknown) {
      value = next;
      return value;
    },
    read() {
      return value;
    },
  };
}

export const LEDGER = [
  { name: "0x0funky/agent-sprite-forge", file: "" },
  { name: "269652/artificial-consciousness-ai", file: "test_logging.py" },
  { name: "269652/artificial-consciousness-blueprint", file: "" },
  { name: "activepieces/activepieces", file: "" },
  { name: "adamgallas/FireFly-v1", file: "zcu104_test.py" },
  { name: "adamgallas/FireFly-v2", file: "" },
  { name: "adamgallas/firefly_v1_cifar_test", file: "zcu104_test.py" },
  { name: "adamgallas/SpinalDLA", file: "" },
  { name: "androoAGI/starnet", file: "" },
  { name: "appwrite/appwrite", file: "mongo-init.js" },
  { name: "AudiusProject/audius-protocol", file: "" },
  { name: "AUTOMATIC1111/stable-diffusion-webui", file: "launch.py" },
] as const;

export function tally(rows: readonly { file: string }[]) {
  const picked = rows.filter((row) => row.file).length;
  return { asked: rows.length, picked, left: rows.length - picked };
}

export function sampleLevels() {
  return { dopamine: 0.6, serotonin: 0.7, norepinephrine: 0.5, oxytocin: 0.4, testosterone: 0.5, histamine: 0.3 };
}

export function readSparse() {
  const cell = configCell();
  const count = tally(LEDGER);
  const proved =
    cell.read() === null &&
    cell.init(2) === 2 &&
    branchCase("selector").optOut === true &&
    branchCase("sequence").optOut === false &&
    count.asked === 12 &&
    count.picked === 5 &&
    sampleLevels().serotonin === 0.7;
  return {
    proved,
    said: proved
      ? "Twelve repositories were asked. Five had a small source file. Seven did not. Serotonin in the logging file is 0.7. A database user was in one file and was not created."
      : "The sparse read missed.",
  };
}
