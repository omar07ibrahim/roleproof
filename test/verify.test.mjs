import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { analyzePolicy } from "../src/analyze.mjs";
import { sha256Hex } from "../src/canonical.mjs";
import { parsePolicyBytes, readPolicyFile } from "../src/contracts.mjs";
import {
  VerificationError,
  verifyReceipt,
} from "../src/verify.mjs";

test("the independent verifier closes the Orion receipt", async () => {
  const policy = await readPolicyFile("examples/orion.synthetic.json");
  const receipt = analyzePolicy(policy);
  const verification = verifyReceipt(policy, receipt);
  assert.equal(verification.status, "verified");
  assert.deepEqual(verification.checks, {
    cycle_components: true,
    finding_completeness: true,
    hash_binding: true,
    principal_closure: true,
    shortest_witnesses: true,
    witness_cuts: true,
  });
  assert.match(verification.constraint_status_sha256, /^[0-9a-f]{64}$/);
});

test("rehashed witness tampering is rejected", async () => {
  const policy = await readPolicyFile("examples/orion.synthetic.json");
  const receipt = structuredClone(analyzePolicy(policy));
  receipt.result.findings[1].witnesses[0].steps[0].to = "ci-operator";
  receipt.result_sha256 = sha256Hex(receipt.result);
  assert.throws(
    () => verifyReceipt(policy, receipt),
    (error) =>
      error instanceof VerificationError &&
      error.code === "invalid_witness_step",
  );
});

test("rehashed omission and false pass tampering are rejected", async () => {
  const policy = await readPolicyFile("examples/orion.synthetic.json");

  const omitted = structuredClone(analyzePolicy(policy));
  omitted.result.findings.pop();
  omitted.result_sha256 = sha256Hex(omitted.result);
  assert.throws(
    () => verifyReceipt(policy, omitted),
    (error) =>
      error instanceof VerificationError && error.code === "invalid_findings",
  );

  const falsePass = structuredClone(analyzePolicy(policy));
  const finding = falsePass.result.findings[1];
  finding.status = "pass";
  finding.witnesses = [];
  finding.witness_cuts = [];
  falsePass.result_sha256 = sha256Hex(falsePass.result);
  assert.throws(
    () => verifyReceipt(policy, falsePass),
    (error) =>
      error instanceof VerificationError &&
      error.code === "invalid_finding_status",
  );
});

test("cycle components are independently reconstructed", () => {
  const raw = {
    schema_version: "roleproof.policy.v1",
    title: "Synthetic cycle",
    principals: [{ id: "person", assigned_roles: ["a-role"] }],
    roles: [
      {
        id: "a-role",
        inherits: [],
        can_assume: ["b-role"],
        grants: [],
      },
      {
        id: "b-role",
        inherits: ["a-role"],
        can_assume: [],
        grants: [{ resource: "ledger", actions: ["write"] }],
      },
    ],
    resources: [{ id: "ledger", sensitivity: "high" }],
    constraints: [{
      id: "deny",
      kind: "deny_access",
      principal: "person",
      resource: "ledger",
      action: "write",
      severity: "high",
    }],
  };
  const policy = parsePolicyBytes(Buffer.from(JSON.stringify(raw)));
  assert.equal(verifyReceipt(policy, analyzePolicy(policy)).status, "verified");
});

test("the verifier has no dependency on the analyzer implementation", async () => {
  const source = await readFile("src/verify.mjs", "utf8");
  assert.equal(source.includes("./analyze.mjs"), false);
  assert.equal(source.includes("analyzePolicy"), false);
});
