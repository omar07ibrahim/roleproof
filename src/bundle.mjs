import { analyzePolicy } from "./analyze.mjs";
import { sha256Hex } from "./canonical.mjs";
import { writeNewBundleDirectory } from "./io.mjs";
import { verifyReceipt } from "./verify.mjs";

export const BUNDLE_FORMAT = "roleproof.bundle.v1";

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function buildAuditBundle(policy) {
  const receipt = analyzePolicy(policy);
  const verification = verifyReceipt(policy, receipt);
  const payloads = new Map([
    ["analysis.receipt.json", jsonBytes(receipt)],
    ["policy.normalized.json", jsonBytes(policy)],
    ["verification.json", jsonBytes(verification)],
  ]);
  const manifest = {
    files: [...payloads.entries()]
      .map(([filePath, payload]) => ({
        bytes: payload.byteLength,
        path: filePath,
        sha256: sha256Hex(payload),
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    format: BUNDLE_FORMAT,
    policy_sha256: receipt.policy_sha256,
    result_sha256: receipt.result_sha256,
    verification_sha256: sha256Hex(verification),
  };
  payloads.set("manifest.json", jsonBytes(manifest));
  return { bundle: payloads, manifest, receipt, verification };
}

export async function writeAuditBundle(policy, directory) {
  const built = buildAuditBundle(policy);
  await writeNewBundleDirectory(directory, built.bundle);
  return built;
}
