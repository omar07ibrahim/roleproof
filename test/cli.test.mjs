import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function run(...arguments_) {
  return spawnSync(process.execPath, ["src/cli.mjs", ...arguments_], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

test("audit writes a closed, hash-bound, mode-0600 bundle", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "roleproof-cli-"));
  const output = path.join(temporary, "bundle");
  try {
    const completed = run(
      "audit",
      "examples/orion.synthetic.json",
      "--out",
      output,
    );
    assert.equal(completed.status, 0, completed.stderr);
    assert.match(completed.stdout, /^ROLEPROOF AUDIT VERIFIED\n/);
    assert.match(completed.stdout, /Violations  4\n/);
    assert.match(completed.stdout, /Passes      1\n/);

    const names = [
      "analysis.receipt.json",
      "manifest.json",
      "policy.normalized.json",
      "verification.json",
    ];
    const actual = (await import("node:fs/promises")).readdir(output);
    assert.deepEqual((await actual).sort(), names);
    const manifest = JSON.parse(
      await readFile(path.join(output, "manifest.json"), "utf8"),
    );
    assert.equal(manifest.format, "roleproof.bundle.v1");
    assert.equal(manifest.files.length, 3);
    for (const record of manifest.files) {
      const payload = await readFile(path.join(output, record.path));
      assert.equal(payload.byteLength, record.bytes);
      assert.equal(
        createHash("sha256").update(payload).digest("hex"),
        record.sha256,
      );
    }
    for (const name of names) {
      assert.equal((await stat(path.join(output, name))).mode & 0o777, 0o600);
    }
    assert.equal((await stat(output)).mode & 0o777, 0o700);

    const before = await readFile(path.join(output, "manifest.json"));
    const repeated = run(
      "audit",
      "examples/orion.synthetic.json",
      "--out",
      output,
    );
    assert.equal(repeated.status, 1);
    assert.match(repeated.stderr, /output_exists/);
    assert.deepEqual(
      await readFile(path.join(output, "manifest.json")),
      before,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("analyze and verify expose machine-readable receipts", async () => {
  const analysis = run("analyze", "examples/orion.synthetic.json");
  assert.equal(analysis.status, 0, analysis.stderr);
  const receipt = JSON.parse(analysis.stdout);
  assert.equal(receipt.result.summary.violations, 4);

  const temporary = await mkdtemp(path.join(os.tmpdir(), "roleproof-verify-"));
  try {
    const receiptPath = path.join(temporary, "receipt.json");
    await (await import("node:fs/promises")).writeFile(
      receiptPath,
      analysis.stdout,
      { mode: 0o600 },
    );
    const verification = run(
      "verify",
      "examples/orion.synthetic.json",
      receiptPath,
    );
    assert.equal(verification.status, 0, verification.stderr);
    assert.equal(JSON.parse(verification.stdout).status, "verified");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("usage and malformed receipts fail without stack traces", async () => {
  const usage = run("unknown");
  assert.equal(usage.status, 64);
  assert.match(usage.stderr, /^Usage:/);
  assert.equal(usage.stderr.includes(" at "), false);

  const temporary = await mkdtemp(path.join(os.tmpdir(), "roleproof-bad-"));
  try {
    const receiptPath = path.join(temporary, "receipt.json");
    await (await import("node:fs/promises")).writeFile(
      receiptPath,
      '{"format":"wrong"}',
      { mode: 0o600 },
    );
    const failed = run(
      "verify",
      "examples/orion.synthetic.json",
      receiptPath,
    );
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /^roleproof: invalid_receipt\n$/);
    assert.equal(failed.stderr.includes(" at "), false);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("CLI confines file paths to the current workspace", () => {
  const outside = path.join(os.tmpdir(), "roleproof-outside.json");
  for (const arguments_ of [
    ["analyze", outside],
    ["analyze", "../outside.json"],
    ["audit", "examples/orion.synthetic.json", "--out", "../bundle"],
    ["verify", "examples/orion.synthetic.json", outside],
  ]) {
    const completed = run(...arguments_);
    assert.equal(completed.status, 64, arguments_.join(" "));
    assert.equal(completed.stderr, "roleproof: invalid_arguments\n");
  }
});
