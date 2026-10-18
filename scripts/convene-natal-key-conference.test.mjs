import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { conferenceKeyMaterial, writeKeyFile } from "../artifacts/api-server/scripts/convene-natal-key-conference.mjs";

const sample = "roundtrip-key-material";
const replacement = "roundtrip-key-material-other";
const scriptPath = fileURLToPath(new URL("../artifacts/api-server/scripts/convene-natal-key-conference.mjs", import.meta.url));

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

function needles(secret) {
  if (typeof secret !== "string" || secret.length === 0) return [];
  const sha256 = createHash("sha256").update(secret).digest("hex");
  const sha512 = createHash("sha512").update(secret).digest("hex");
  return [secret, secret.slice(0, 8), sha256, sha512];
}

function assertClean(text, secrets) {
  const haystack = String(text ?? "");
  for (const secret of secrets) {
    for (const needle of needles(secret)) {
      if (needle && haystack.includes(needle)) throw new Error("output contains key material");
    }
  }
}

function modeOf(file) {
  return statSync(file).mode & 0o777;
}

function assertMode(file, expected) {
  if (modeOf(file) !== expected) throw new Error(`mode ${expected.toString(8)} was not applied`);
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

test("writes the key outside the repo without printing it", async () => {
  const tree = tempTree();
  const io = capture();
  try {
    mkdirSync(tree.repo, { recursive: true });
    mkdirSync(tree.outside, { recursive: true, mode: 0o755 });
    const written = await writeKeyFile(sample, {
      outputDir: tree.outside,
      repoRoot: tree.repo,
      stdout: io.stdout,
      stderr: io.stderr,
      env: {},
    });
    const file = join(tree.outside, "tesseract-admin-key");
    if (written.path !== file) throw new Error("unexpected key path");
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

test("default directory is under the home directory and the env override is honored", async () => {
  const tree = tempTree();
  const io = capture();
  const home = join(tree.root, "home");
  const fromEnv = join(tree.root, "from-env");
  try {
    mkdirSync(tree.repo, { recursive: true });
    mkdirSync(home, { recursive: true });
    const written = await writeKeyFile(sample, {
      repoRoot: tree.repo,
      homedir: home,
      stdout: io.stdout,
      stderr: io.stderr,
      env: {},
    });
    const file = join(home, ".tessera", "keys", "tesseract-admin-key");
    if (written.path !== file) throw new Error("unexpected default key path");
    assertMode(file, 0o600);
    assertMode(join(home, ".tessera", "keys"), 0o700);
    if (readFileSync(file, "utf8") !== sample) throw new Error("key file content mismatch");
    assertClean(`${io.out}\n${io.err}`, [sample]);

    const override = capture();
    const overridden = await writeKeyFile(replacement, {
      repoRoot: tree.repo,
      homedir: home,
      stdout: override.stdout,
      stderr: override.stderr,
      env: { TESSERA_KEY_OUTPUT_DIR: fromEnv },
    });
    const envFile = join(fromEnv, "tesseract-admin-key");
    if (overridden.path !== envFile) throw new Error("env output directory was ignored");
    if (readFileSync(envFile, "utf8") !== replacement) throw new Error("key file content mismatch");
    assertMode(envFile, 0o600);
    assertMode(fromEnv, 0o700);
    assertClean(`${override.out}\n${override.err}`, [sample, replacement]);
  } finally {
    tree.remove();
  }
});

test("refuses a path that resolves inside the repo", async () => {
  const tree = tempTree();
  const io = capture();
  try {
    mkdirSync(tree.repo, { recursive: true });
    mkdirSync(tree.outside, { recursive: true });
    const inside = join(tree.repo, "keys");
    const lexical = await expectCode(
      () => writeKeyFile(sample, {
        outputDir: inside,
        repoRoot: tree.repo,
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
        repoRoot: tree.repo,
        stdout: viaEnv.stdout,
        stderr: viaEnv.stderr,
        env: { TESSERA_KEY_OUTPUT_DIR: join(tree.repo, "env-keys") },
      }),
      "EKEYINREPO",
    );
    if (existsSync(join(tree.repo, "env-keys"))) throw new Error("in-repo directory was created");
    assertClean(`${envError.message}\n${viaEnv.out}\n${viaEnv.err}`, [sample]);

    symlinkSync(tree.repo, join(tree.outside, "linked-repo"));
    const viaLink = capture();
    const linkError = await expectCode(
      () => writeKeyFile(sample, {
        outputDir: join(tree.outside, "linked-repo"),
        repoRoot: tree.repo,
        stdout: viaLink.stdout,
        stderr: viaLink.stderr,
        env: {},
      }),
      "EKEYINREPO",
    );
    if (existsSync(join(tree.repo, "tesseract-admin-key"))) throw new Error("key file was written inside the repo");
    assertClean(`${linkError.message}\n${viaLink.out}\n${viaLink.err}`, [sample]);
  } finally {
    tree.remove();
  }
});

test("refuses to overwrite an existing key file", async () => {
  const tree = tempTree();
  const first = capture();
  const second = capture();
  try {
    mkdirSync(tree.repo, { recursive: true });
    await writeKeyFile(sample, {
      outputDir: tree.outside,
      repoRoot: tree.repo,
      stdout: first.stdout,
      stderr: first.stderr,
      env: {},
    });
    const error = await expectCode(
      () => writeKeyFile(replacement, {
        outputDir: tree.outside,
        repoRoot: tree.repo,
        stdout: second.stdout,
        stderr: second.stderr,
        env: {},
      }),
      "EEXIST",
    );
    const file = join(tree.outside, "tesseract-admin-key");
    if (readFileSync(file, "utf8") !== sample) throw new Error("existing key file was changed");
    assertClean(`${error.message}\n${first.out}\n${first.err}\n${second.out}\n${second.err}`, [sample, replacement]);
    if (second.out !== "") throw new Error("overwrite attempt wrote stdout");
  } finally {
    tree.remove();
  }
});

test("the script writes the ratified key and does not print key material", () => {
  const tree = tempTree();
  const chartJson = JSON.stringify(fixtureChart);
  const keys = conferenceKeyMaterial(chartJson);
  try {
    if (keys.length !== 3 || keys.some((key) => typeof key !== "string" || key.length < 8)) {
      throw new Error("fixture chart did not derive candidate keys");
    }
    mkdirSync(tree.repo, { recursive: true });
    const child = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      env: {
        HOME: join(tree.root, "home"),
        TESSERA_KEY_OUTPUT_DIR: tree.outside,
        FATHER_NATAL_CHART_JSON: chartJson,
      },
    });
    const stdout = child.stdout ?? "";
    const stderr = child.stderr ?? "";
    assertClean(`${stdout}\n${stderr}`, keys);
    if (child.status !== 0) throw new Error(`script exited ${child.status}`);
    const line = stdout.match(/^key written: (.+)$/m);
    if (!line) throw new Error("missing key written line");
    const file = line[1];
    if (file !== join(realpathSync(tree.outside), "tesseract-admin-key")) {
      throw new Error("script wrote outside the requested directory");
    }
    if (lstatSync(file).isSymbolicLink()) throw new Error("key file must be a regular file");
    assertMode(file, 0o600);
    assertMode(tree.outside, 0o700);
    const stored = readFileSync(file, "utf8");
    if (!keys.includes(stored)) throw new Error("stored key is not a derived candidate");
    if (stdout.includes("permanentKey")) throw new Error("stdout still names the key field");
    assertClean(`${stdout}\n${stderr}`, [stored]);
  } finally {
    tree.remove();
  }
});
