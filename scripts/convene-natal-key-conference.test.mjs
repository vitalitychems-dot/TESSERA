import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { conferencePrivateMaterial, renderPublicReport, textHasKeyMaterial, writeKeyFile } from "../artifacts/api-server/scripts/convene-natal-key-conference.mjs";

const sample = "roundtrip-key-material";
const replacement = "roundtrip-key-material-other";
const scriptPath = fileURLToPath(new URL("../artifacts/api-server/scripts/convene-natal-key-conference.mjs", import.meta.url));
const keyName = "tesseract-admin-key";

const fixtureChart = {
  birth: {
    date: "2000-01-01",
    time: "12:00",
    location: "Fixture Location",
    timezone: "UTC",
    houseSystem: "Whole Sign",
  },
  core: {
    sun: { sign: "Aries", degree: "0", house: 1 },
    moon: { sign: "Taurus", degree: "0", house: 2 },
    ascendant: { sign: "Gemini", degree: "0" },
  },
  planets: {
    mercury: { sign: "Aries", degree: "0", house: 1 },
    venus: { sign: "Taurus", degree: "0", house: 2 },
    mars: { sign: "Gemini", degree: "0", house: 3 },
    jupiter: { sign: "Cancer", degree: "0", house: 4 },
    saturn: { sign: "Leo", degree: "0", house: 5 },
    uranus: { sign: "Virgo", degree: "0", house: 6 },
    neptune: { sign: "Libra", degree: "0", house: 7 },
    pluto: { sign: "Scorpio", degree: "0", house: 8 },
  },
  nodes: { northNode: { sign: "Sagittarius", degree: "0", house: 9 } },
  themes: { chineseZodiac: "Fixture Dragon" },
};

function tempTree() {
  const root = mkdtempSync(join(tmpdir(), "tessera-key-"));
  return {
    root,
    repo: join(root, "repo"),
    outside: join(root, "outside"),
    remove() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function capture() {
  const out = [];
  const err = [];
  return {
    stdout: {
      write(chunk) {
        out.push(String(chunk));
        return true;
      },
    },
    stderr: {
      write(chunk) {
        err.push(String(chunk));
        return true;
      },
    },
    get out() {
      return out.join("");
    },
    get err() {
      return err.join("");
    },
  };
}

function assertClean(text, material) {
  const payload = Array.isArray(material) ? { keys: material } : material;
  if (textHasKeyMaterial(text, payload)) throw new Error("output contains key material");
}

function modeOf(file) {
  return statSync(file).mode & 0o777;
}

function assertMode(file, expected) {
  if (modeOf(file) !== expected) throw new Error(`mode ${expected.toString(8)} was not applied`);
}

function gitInit(dir) {
  mkdirSync(dir, { recursive: true });
  const result = spawnSync("git", ["init", "-q", dir], { stdio: "ignore" });
  if (result.status !== 0) throw new Error("git init failed");
}

async function expectCode(run, code) {
  try {
    await run();
  } catch (error) {
    if (error?.code !== code) throw new Error(`expected refusal ${code}`);
    return error;
  }
  throw new Error(`expected refusal ${code}`);
}

function privateDir(dir) {
  mkdirSync(dir, { recursive: true });
  chmodSync(dir, 0o700);
}

test("writes the key outside a git work tree without printing it", async () => {
  const tree = tempTree();
  const io = capture();
  const home = join(tree.root, "home");
  try {
    mkdirSync(home, { recursive: true });
    const written = await writeKeyFile(sample, {
      outputDir: tree.outside,
      homedir: home,
      stdout: io.stdout,
      stderr: io.stderr,
      env: {},
    });
    const file = realpathSync(join(tree.outside, keyName));
    if (written.path !== file) throw new Error("unexpected key path");
    if (written.display !== file) throw new Error("path outside home was rewritten");
    if (lstatSync(file).isSymbolicLink()) throw new Error("key file must be a regular file");
    assertMode(file, 0o600);
    assertMode(tree.outside, 0o700);
    if (readFileSync(file, "utf8") !== sample) throw new Error("key file content mismatch");
    assertClean(`${io.out}\n${io.err}`, [sample]);
    if (io.err !== "") throw new Error("stderr was not empty");
    if (io.out !== `key written: ${file}\n`) throw new Error("unexpected stdout");
  } finally {
    tree.remove();
  }
});

test("default directory is under the home directory and prints a tilde path", async () => {
  const tree = tempTree();
  const io = capture();
  const home = join(tree.root, "home");
  try {
    mkdirSync(home, { recursive: true });
    const written = await writeKeyFile(sample, {
      homedir: home,
      stdout: io.stdout,
      stderr: io.stderr,
      env: {},
    });
    const file = realpathSync(join(home, ".tessera", "keys", keyName));
    if (written.path !== file) throw new Error("unexpected default key path");
    if (written.display !== `~/.tessera/keys/${keyName}`) throw new Error("default path was not home-relative");
    assertMode(file, 0o600);
    assertMode(join(home, ".tessera"), 0o700);
    assertMode(join(home, ".tessera", "keys"), 0o700);
    if (readFileSync(file, "utf8") !== sample) throw new Error("key file content mismatch");
    assertClean(`${io.out}\n${io.err}`, [sample]);
    if (io.out.includes(home)) throw new Error("stdout contains a home path");
    if (io.out !== `key written: ~/.tessera/keys/${keyName}\n`) throw new Error("unexpected stdout");
  } finally {
    tree.remove();
  }
});

test("expands a current-user tilde and refuses another user's", async () => {
  const tree = tempTree();
  const io = capture();
  const home = join(tree.root, "home");
  try {
    mkdirSync(home, { recursive: true });
    const written = await writeKeyFile(sample, {
      homedir: home,
      stdout: io.stdout,
      stderr: io.stderr,
      env: { TESSERA_KEY_OUTPUT_DIR: "~/boxed" },
    });
    const file = realpathSync(join(home, "boxed", keyName));
    if (written.path !== file) throw new Error("tilde output directory was not expanded");
    if (io.out !== "key written: ~/boxed/tesseract-admin-key\n") throw new Error("unexpected stdout");
    if (io.out.includes(home)) throw new Error("stdout contains a home path");
    assertMode(file, 0o600);
    const error = await expectCode(
      () => writeKeyFile(replacement, {
        homedir: home,
        stdout: io.stdout,
        stderr: io.stderr,
        env: { TESSERA_KEY_OUTPUT_DIR: "~nobody/keys" },
      }),
      "EKEYTILDE",
    );
    assertClean(`${error.message}\n${io.out}\n${io.err}`, [sample, replacement]);
  } finally {
    tree.remove();
  }
});

test("refuses a destination inside any git work tree", async () => {
  const tree = tempTree();
  const io = capture();
  const home = join(tree.root, "home");
  try {
    gitInit(tree.repo);
    mkdirSync(home, { recursive: true });
    const inside = join(tree.repo, "keys");
    const lexical = await expectCode(
      () => writeKeyFile(sample, {
        outputDir: inside,
        homedir: home,
        stdout: io.stdout,
        stderr: io.stderr,
        env: {},
      }),
      "EKEYINREPO",
    );
    if (existsSync(inside)) throw new Error("in-repo directory was created");
    assertClean(`${lexical.message}\n${io.out}\n${io.err}`, [sample]);

    const viaEnv = capture();
    const envError = await expectCode(
      () => writeKeyFile(sample, {
        homedir: home,
        stdout: viaEnv.stdout,
        stderr: viaEnv.stderr,
        env: { TESSERA_KEY_OUTPUT_DIR: join(tree.repo, "env-keys") },
      }),
      "EKEYINREPO",
    );
    if (existsSync(join(tree.repo, "env-keys"))) throw new Error("in-repo directory was created");
    assertClean(`${envError.message}\n${viaEnv.out}\n${viaEnv.err}`, [sample]);

    const relative = capture();
    const relativeError = await expectCode(
      () => writeKeyFile(sample, {
        outputDir: "rel-keys",
        cwd: tree.repo,
        homedir: home,
        stdout: relative.stdout,
        stderr: relative.stderr,
        env: {},
      }),
      "EKEYINREPO",
    );
    if (existsSync(join(tree.repo, "rel-keys"))) throw new Error("relative directory was created");
    assertClean(`${relativeError.message}\n${relative.out}\n${relative.err}`, [sample]);
  } finally {
    tree.remove();
  }
});

test("refuses a symlink directory, a dangling symlink, and a symlink at the key path", async () => {
  const tree = tempTree();
  const home = join(tree.root, "home");
  try {
    gitInit(tree.repo);
    mkdirSync(home, { recursive: true });
    mkdirSync(tree.outside, { recursive: true });
    symlinkSync(tree.repo, join(tree.outside, "linked-repo"));
    const viaLink = capture();
    const linkError = await expectCode(
      () => writeKeyFile(sample, {
        outputDir: join(tree.outside, "linked-repo"),
        homedir: home,
        stdout: viaLink.stdout,
        stderr: viaLink.stderr,
        env: {},
      }),
      "EKEYLINK",
    );
    if (existsSync(join(tree.repo, keyName))) throw new Error("key file was written inside the repo");
    assertClean(`${linkError.message}\n${viaLink.out}\n${viaLink.err}`, [sample]);

    symlinkSync(join(tree.root, "missing-dir"), join(tree.root, "dangling"));
    const dangling = capture();
    const danglingError = await expectCode(
      () => writeKeyFile(sample, {
        outputDir: join(tree.root, "dangling"),
        homedir: home,
        stdout: dangling.stdout,
        stderr: dangling.stderr,
        env: {},
      }),
      "EKEYLINK",
    );
    if (existsSync(join(tree.root, "missing-dir"))) throw new Error("dangling symlink was followed");
    assertClean(`${danglingError.message}\n${dangling.out}\n${dangling.err}`, [sample]);

    privateDir(join(tree.root, "held"));
    symlinkSync(join(tree.root, "elsewhere"), join(tree.root, "held", keyName));
    const target = capture();
    const targetError = await expectCode(
      () => writeKeyFile(sample, {
        outputDir: join(tree.root, "held"),
        homedir: home,
        stdout: target.stdout,
        stderr: target.stderr,
        env: {},
      }),
      "EKEYLINK",
    );
    if (existsSync(join(tree.root, "elsewhere"))) throw new Error("symlink target was created");
    assertClean(`${targetError.message}\n${target.out}\n${target.err}`, [sample]);
  } finally {
    tree.remove();
  }
});

test("refuses an existing 0755 directory without changing it", async () => {
  const tree = tempTree();
  const io = capture();
  const home = join(tree.root, "home");
  try {
    mkdirSync(home, { recursive: true });
    mkdirSync(tree.outside, { recursive: true });
    chmodSync(tree.outside, 0o755);
    const error = await expectCode(
      () => writeKeyFile(sample, {
        outputDir: tree.outside,
        homedir: home,
        stdout: io.stdout,
        stderr: io.stderr,
        env: {},
      }),
      "EKEYMODE",
    );
    if (modeOf(tree.outside) !== 0o755) throw new Error("existing directory mode was changed");
    if (existsSync(join(tree.outside, keyName))) throw new Error("key file was written");
    assertClean(`${error.message}\n${io.out}\n${io.err}`, [sample]);
  } finally {
    tree.remove();
  }
});

test("refuses to overwrite an existing key file or an existing directory at the key path", async () => {
  const tree = tempTree();
  const first = capture();
  const second = capture();
  const home = join(tree.root, "home");
  try {
    mkdirSync(home, { recursive: true });
    await writeKeyFile(sample, {
      outputDir: tree.outside,
      homedir: home,
      stdout: first.stdout,
      stderr: first.stderr,
      env: {},
    });
    const error = await expectCode(
      () => writeKeyFile(replacement, {
        outputDir: tree.outside,
        homedir: home,
        stdout: second.stdout,
        stderr: second.stderr,
        env: {},
      }),
      "EEXIST",
    );
    const file = join(tree.outside, keyName);
    if (readFileSync(file, "utf8") !== sample) throw new Error("existing key file was changed");
    assertClean(`${error.message}\n${first.out}\n${first.err}\n${second.out}\n${second.err}`, [sample, replacement]);
    if (second.out !== "") throw new Error("overwrite attempt wrote stdout");

    const occupied = join(tree.root, "occupied");
    privateDir(occupied);
    mkdirSync(join(occupied, keyName));
    const directory = capture();
    const directoryError = await expectCode(
      () => writeKeyFile(sample, {
        outputDir: occupied,
        homedir: home,
        stdout: directory.stdout,
        stderr: directory.stderr,
        env: {},
      }),
      "EKEYDIR",
    );
    if (!lstatSync(join(occupied, keyName)).isDirectory()) throw new Error("existing directory was replaced");
    assertClean(`${directoryError.message}\n${directory.out}\n${directory.err}`, [sample]);
  } finally {
    tree.remove();
  }
});

test("a failed write leaves no key file", async () => {
  const tree = tempTree();
  const io = capture();
  const home = join(tree.root, "home");
  const filename = "a".repeat(300);
  try {
    mkdirSync(home, { recursive: true });
    const error = await expectCode(
      () => writeKeyFile(sample, {
        outputDir: tree.outside,
        filename,
        homedir: home,
        stdout: io.stdout,
        stderr: io.stderr,
        env: {},
      }),
      "ENAMETOOLONG",
    );
    if (existsSync(join(tree.outside, filename))) throw new Error("partial key file remained");
    if (existsSync(join(tree.outside, keyName))) throw new Error("key file was written");
    assertClean(`${error.message}\n${io.out}\n${io.err}`, [sample]);
    if (io.out !== "") throw new Error("failed write printed a key path");
  } finally {
    tree.remove();
  }
});

test("textHasKeyMaterial flags seed prefixes and birth data", () => {
  const material = conferencePrivateMaterial(JSON.stringify(fixtureChart));
  const clean = [
    "Identifier: sovereign-sigil-33",
    "Tally (raw): approve=1 reject=0 abstain=0 total=1",
    "Tally (weighted): approve=1 reject=0 abstain=0",
    "Approval rate: 100.00%",
    "key written: ~/.tessera/keys/tesseract-admin-key",
  ].join("\n");
  assertClean(clean, material);
  for (let length = 4; length <= material.seedHex.length; length += 1) {
    if (!textHasKeyMaterial(material.seedHex.slice(0, length), material)) {
      throw new Error("seed prefix was not flagged");
    }
  }
  for (const start of [0, 12, 24]) {
    if (!textHasKeyMaterial(material.seedHex.slice(start, start + 12), material)) {
      throw new Error("seed slice was not flagged");
    }
  }
  for (const value of material.birth) {
    if (!textHasKeyMaterial(value, material)) throw new Error("birth data was not flagged");
  }
});

test("exit 2 report has the identifier and tallies and no chart material", () => {
  const material = conferencePrivateMaterial(JSON.stringify(fixtureChart));
  const rendered = renderPublicReport([{
    id: "candidate-a",
    result: {
      outcome: "rejected",
      approvalRate: 0,
      weighted: { approve: 0, reject: 1, abstain: 0 },
      raw: { approve: 0, reject: 1, abstain: 0 },
      totalEligible: 1,
    },
  }]);
  if (rendered.code !== 2 || rendered.winnerId !== null) throw new Error("expected exit 2");
  if (rendered.report.includes("Length")) throw new Error("report contains a length line");
  if (!rendered.report.includes("Identifier: candidate-a")) throw new Error("missing identifier");
  if (!rendered.report.includes("Tally (raw):")) throw new Error("missing tally");
  if (!rendered.report.includes("Approval rate:")) throw new Error("missing approval rate");
  assertClean(rendered.report, material);
});

test("the script writes the ratified key and does not print chart material", () => {
  const tree = tempTree();
  const chartJson = JSON.stringify(fixtureChart);
  const material = conferencePrivateMaterial(chartJson);
  const home = join(tree.root, "home");
  try {
    if (material.keys.length !== 3 || material.keys.some((key) => typeof key !== "string" || key.length < 8)) {
      throw new Error("fixture chart did not derive candidate keys");
    }
    mkdirSync(home, { recursive: true });
    const child = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      env: {
        HOME: home,
        PATH: process.env.PATH,
        FATHER_NATAL_CHART_JSON: chartJson,
      },
    });
    const stdout = child.stdout ?? "";
    const stderr = child.stderr ?? "";
    assertClean(`${stdout}\n${stderr}`, material);
    if (child.status !== 0) throw new Error(`script exited ${child.status}`);
    if (stdout.includes("Length")) throw new Error("report contains a length line");
    if (stdout.includes(home)) throw new Error("stdout contains a home path");
    if (!stdout.includes(`key written: ~/.tessera/keys/${keyName}`)) throw new Error("missing key written line");
    const file = join(home, ".tessera", "keys", keyName);
    if (lstatSync(file).isSymbolicLink()) throw new Error("key file must be a regular file");
    assertMode(file, 0o600);
    assertMode(join(home, ".tessera", "keys"), 0o700);
    const stored = readFileSync(file, "utf8");
    if (!material.keys.includes(stored)) throw new Error("stored key is not a derived candidate");
    const marker = "=== JSON RESULT ===";
    const jsonStart = stdout.indexOf(marker);
    if (jsonStart < 0) throw new Error("missing json result");
    const payload = JSON.parse(stdout.slice(jsonStart + marker.length));
    for (const field of ["birthDate", "zodiac", "moon", "rising", "boundToHolder", "permanentKey"]) {
      if (Object.hasOwn(payload, field)) throw new Error("json contains a chart field");
    }
    if (payload.keyFile !== `~/.tessera/keys/${keyName}`) throw new Error("json key path was not home-relative");
    assertClean(JSON.stringify(payload), material);
  } finally {
    tree.remove();
  }
});

test("the script refuses an in-repo output directory", () => {
  const tree = tempTree();
  const chartJson = JSON.stringify(fixtureChart);
  const material = conferencePrivateMaterial(chartJson);
  const home = join(tree.root, "home");
  try {
    gitInit(tree.repo);
    mkdirSync(home, { recursive: true });
    const child = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      env: {
        HOME: home,
        PATH: process.env.PATH,
        TESSERA_KEY_OUTPUT_DIR: join(tree.repo, "keys"),
        FATHER_NATAL_CHART_JSON: chartJson,
      },
    });
    assertClean(`${child.stdout ?? ""}\n${child.stderr ?? ""}`, material);
    if (child.status === 0) throw new Error("in-repo output was accepted");
    if (existsSync(join(tree.repo, "keys", keyName))) throw new Error("key file was written inside the repo");
  } finally {
    tree.remove();
  }
});
