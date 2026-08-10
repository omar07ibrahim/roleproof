import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readPolicyFile } from "../src/contracts.mjs";
import { readStrictJsonFile } from "../src/io.mjs";
import { verifyReceipt } from "../src/verify.mjs";

async function inventory(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await inventory(path.join(directory, entry.name), relative)));
    } else {
      assert.equal(entry.isFile(), true);
      assert.equal(entry.isSymbolicLink(), false);
      result.push(relative);
    }
  }
  return result.sort();
}

test("the dashboard build is exact, source-derived, and hash-bound", async () => {
  const output = execFileSync(process.execPath, ["tools/build-site.mjs"], {
    encoding: "utf8",
  });
  assert.equal(output, "roleproof site: PASS (9 files, 4 verified violations)\n");
  const expected = [
    "app.js",
    "data/analysis.receipt.json",
    "data/manifest.json",
    "data/policy.normalized.json",
    "data/role-graph.svg",
    "data/site.manifest.json",
    "data/verification.json",
    "index.html",
    "styles.css",
  ];
  assert.deepEqual(await inventory("dist"), expected);

  const manifest = await readStrictJsonFile("dist/data/site.manifest.json");
  assert.equal(manifest.format, "roleproof.site.v1");
  assert.equal(manifest.files.length, 8);
  for (const record of manifest.files) {
    const payload = await readFile(path.join("dist", record.path));
    assert.equal(payload.byteLength, record.bytes);
    assert.equal(
      createHash("sha256").update(payload).digest("hex"),
      record.sha256,
    );
  }

  const policy = await readPolicyFile("examples/orion.synthetic.json");
  const receipt = await readStrictJsonFile("dist/data/analysis.receipt.json");
  const verification = verifyReceipt(policy, receipt);
  assert.equal(verification.status, "verified");
  assert.equal(verification.result_sha256, manifest.result_sha256);
});

test("the browser surface is self-contained and uses safe DOM construction", async () => {
  const html = await readFile("web/index.html", "utf8");
  const script = await readFile("web/app.js", "utf8");
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.match(html, /RoleProof · Explainable access review/);
  assert.match(html, /src="\/app.js"/);
  assert.match(html, /src="\/data\/role-graph.svg"/);
  assert.equal(html.includes("https://"), false);
  assert.equal(html.includes("http://"), false);
  for (const forbidden of ["innerHTML", "outerHTML", "document.write", "eval("]) {
    assert.equal(script.includes(forbidden), false, forbidden);
  }
  const headers = Object.fromEntries(
    config.headers[0].headers.map((entry) => [entry.key, entry.value]),
  );
  assert.match(headers["Content-Security-Policy"], /script-src 'self'/);
  assert.match(headers["Content-Security-Policy"], /connect-src 'self'/);
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, "dist");
});
