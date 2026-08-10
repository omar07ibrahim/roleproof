#!/usr/bin/env node

import { analyzePolicy } from "./analyze.mjs";
import { writeAuditBundle } from "./bundle.mjs";
import { readPolicyFile } from "./contracts.mjs";
import { readStrictJsonFile } from "./io.mjs";
import { runServerUntilSignal } from "./server.mjs";
import { verifyReceipt } from "./verify.mjs";

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
  const policy = await readPolicyFile(arguments_[0]);
  const built = await writeAuditBundle(policy, arguments_[2]);
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
    json(analyzePolicy(await readPolicyFile(arguments_[0]))),
  );
}

async function verify(arguments_) {
  if (arguments_.length !== 2 || arguments_.some((item) => item.startsWith("-"))) {
    throw new Error("invalid_arguments");
  }
  const policy = await readPolicyFile(arguments_[0]);
  const receipt = await readStrictJsonFile(arguments_[1]);
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

async function main(argv) {
  const [command, ...arguments_] = argv;
  if (command === "audit") return audit(arguments_);
  if (command === "analyze") return analyze(arguments_);
  if (command === "verify") return verify(arguments_);
  if (command === "serve") return serve(arguments_);
  process.stderr.write(usage() + "\n");
  process.exitCode = 64;
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
