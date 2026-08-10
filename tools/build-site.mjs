import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildAuditBundle } from "../src/bundle.mjs";
import { sha256Hex } from "../src/canonical.mjs";
import { readPolicyFile } from "../src/contracts.mjs";
import { renderRoleGraph } from "../src/render-svg.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, "web");
const destination = path.join(root, "dist");
const dataDirectory = path.join(destination, "data");
const sourceNames = ["app.js", "index.html", "styles.css"];

const sourceEntries = await readdir(source, { withFileTypes: true });
if (
  sourceEntries.some((entry) => !entry.isFile() || entry.isSymbolicLink()) ||
  sourceEntries.map((entry) => entry.name).sort().join("\n") !==
    sourceNames.join("\n")
) {
  throw new Error("unexpected dashboard source inventory");
}

await rm(destination, { recursive: true, force: true });
await mkdir(dataDirectory, { mode: 0o755, recursive: true });
for (const name of sourceNames) {
  await copyFile(path.join(source, name), path.join(destination, name));
}

const policy = await readPolicyFile(
  path.join(root, "examples", "orion.synthetic.json"),
);
const audit = buildAuditBundle(policy);
for (const [name, payload] of audit.bundle) {
  await writeFile(path.join(dataDirectory, name), payload, { mode: 0o644 });
}
await writeFile(
  path.join(dataDirectory, "role-graph.svg"),
  renderRoleGraph(policy, audit.receipt),
  { mode: 0o644 },
);

const expected = [
  "app.js",
  "data/analysis.receipt.json",
  "data/manifest.json",
  "data/policy.normalized.json",
  "data/role-graph.svg",
  "data/verification.json",
  "index.html",
  "styles.css",
];
const records = [];
for (const relativePath of expected) {
  const payload = await (await import("node:fs/promises")).readFile(
    path.join(destination, relativePath),
  );
  records.push({
    bytes: payload.byteLength,
    path: relativePath,
    sha256: sha256Hex(payload),
  });
}
const siteManifest = {
  files: records,
  format: "roleproof.site.v1",
  policy_sha256: audit.receipt.policy_sha256,
  result_sha256: audit.receipt.result_sha256,
  source_policy: "examples/orion.synthetic.json",
  verification_sha256: sha256Hex(audit.verification),
};
await writeFile(
  path.join(dataDirectory, "site.manifest.json"),
  Buffer.from(JSON.stringify(siteManifest, null, 2) + "\n", "utf8"),
  { mode: 0o644 },
);
console.log(
  "roleproof site: PASS (9 files, " +
    audit.receipt.result.summary.violations +
    " verified violations)",
);
