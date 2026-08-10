#!/usr/bin/env node

import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzePolicy } from "./analyze.mjs";
import { writeAuditBundle } from "./bundle.mjs";
import { readPolicyFile } from "./contracts.mjs";
import { readStrictJsonFile } from "./io.mjs";
import { runServerUntilSignal } from "./server.mjs";
import { verifyReceipt } from "./verify.mjs";

const SAFE_PATH = /^(?:\/)?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u;
const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const TRUSTED_ROOTS = Object.freeze(
  [
    ...new Set(
      [process.cwd(), os.tmpdir(), PACKAGE_ROOT].map((root) =>
        realpathSync(root),
      ),
    ),
  ],
);

function normalizedPath(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 4096 ||
    !SAFE_PATH.test(value) ||
    value.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("invalid_arguments");
  }
  return path.resolve(value);
}

function withinTrustedRoot(candidate) {
  return TRUSTED_ROOTS.some((root) => {
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    return candidate.startsWith(prefix);
  });
}

function validatedInputPath(value) {
  const candidate = normalizedPath(value);
  let canonical;
  try {
    canonical = realpathSync(candidate);
  } catch {
    throw new Error("invalid_arguments");
  }
  if (canonical !== candidate || !withinTrustedRoot(canonical)) {
    throw new Error("invalid_arguments");
  }
  return canonical;
}

function validatedOutputPath(value) {
  const candidate = normalizedPath(value);
  let parent;
  try {
    parent = realpathSync(path.dirname(candidate));
  } catch {
    throw new Error("invalid_arguments");
  }
  const canonical = path.join(parent, path.basename(candidate));
  if (canonical !== candidate || !withinTrustedRoot(canonical)) {
    throw new Error("invalid_arguments");
  }
  return canonical;
}

function usage() {
  return [
    "Usage:",
    "  roleproof audit POLICY --out DIRECTORY",
    "  roleproof analyze POLICY",
    "  roleproof verify POLICY RECEIPT",
    "  roleproof serve [--port PORT]",
  ].join("\n");
}

function json(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

async function audit(arguments_) {
  if (
    arguments_.length !== 3 ||
    arguments_[1] !== "--out" ||
    arguments_[0].startsWith("-") ||
    arguments_[2].startsWith("-")
  ) {
    throw new Error("invalid_arguments");
  }
  const policy = await readPolicyFile(
    validatedInputPath(arguments_[0]),
  );
  const built = await writeAuditBundle(policy, validatedOutputPath(arguments_[2]));
  const summary = built.receipt.result.summary;
  process.stdout.write(
    [
      "ROLEPROOF AUDIT VERIFIED",
      "Policy      " + built.receipt.policy_sha256,
      "Result      " + built.receipt.result_sha256,
      "Constraints " + summary.total_constraints,
      "Violations  " + summary.violations,
      "Critical    " + summary.critical_violations,
      "High        " + summary.high_violations,
      "Passes      " + summary.passes,
      "Cycles      " + summary.cycle_components,
      "Bundle      " + arguments_[2],
      "",
    ].join("\n"),
  );
}

async function analyze(arguments_) {
  if (arguments_.length !== 1 || arguments_[0].startsWith("-")) {
    throw new Error("invalid_arguments");
  }
  process.stdout.write(
    json(
      analyzePolicy(
        await readPolicyFile(validatedInputPath(arguments_[0])),
      ),
    ),
  );
}

async function verify(arguments_) {
  if (arguments_.length !== 2 || arguments_.some((item) => item.startsWith("-"))) {
    throw new Error("invalid_arguments");
  }
  const policy = await readPolicyFile(
    validatedInputPath(arguments_[0]),
  );
  const receipt = await readStrictJsonFile(
    validatedInputPath(arguments_[1]),
  );
  process.stdout.write(json(verifyReceipt(policy, receipt)));
}

async function serve(arguments_) {
  let port = 4173;
  if (arguments_.length !== 0) {
    if (arguments_.length !== 2 || arguments_[0] !== "--port") {
      throw new Error("invalid_arguments");
    }
    port = Number(arguments_[1]);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new Error("invalid_arguments");
    }
  }
  await runServerUntilSignal({ port });
}

function invalidCommand() {
  process.stderr.write(usage() + "\n");
  process.exitCode = 64;
}

function canonicalCommand(value) {
  if (value === "audit") return "audit";
  if (value === "analyze") return "analyze";
  if (value === "serve") return "serve";
  if (value === "verify") return "verify";
  return undefined;
}

async function main(argv) {
  const command = canonicalCommand(argv[0]);
  const arguments_ = argv.slice(1);
  switch (command) {
    case "audit":
      return audit(arguments_);
    case "analyze":
      return analyze(arguments_);
    case "serve":
      return serve(arguments_);
    case "verify":
      return verify(arguments_);
    default:
      return invalidCommand();
  }
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  const code =
    typeof error?.code === "string"
      ? error.code
      : error?.message === "invalid_arguments"
        ? "invalid_arguments"
        : "operation_failed";
  process.stderr.write("roleproof: " + code + "\n");
  process.exitCode = code === "invalid_arguments" ? 64 : 1;
}
