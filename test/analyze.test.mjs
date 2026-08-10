import assert from "node:assert/strict";
import test from "node:test";

import { analyzePolicy } from "../src/analyze.mjs";
import { parsePolicyBytes, readPolicyFile } from "../src/contracts.mjs";

test("the Orion review exposes four exact violations and one pass", async () => {
  const policy = await readPolicyFile("examples/orion.synthetic.json");
  const receipt = analyzePolicy(policy);
  assert.equal(receipt.format, "roleproof.receipt.v1");
  assert.match(receipt.policy_sha256, /^[0-9a-f]{64}$/);
  assert.match(receipt.result_sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(receipt.result.summary, {
    critical_violations: 3,
    cycle_components: 0,
    high_violations: 1,
    passes: 1,
    total_constraints: 5,
    violations: 4,
  });

  const intern = receipt.result.findings.find(
    (finding) => finding.constraint_id === "intern-no-prod-deploy",
  );
  assert.equal(intern.status, "violation");
  assert.deepEqual(intern.witnesses[0], {
    assignment: { principal: "alice-intern", role: "intern" },
    grant: { action: "deploy", resource: "production", role: "prod-admin" },
    steps: [
      { from: "intern", kind: "can_assume", to: "contractor" },
      { from: "contractor", kind: "can_assume", to: "developer" },
      { from: "developer", kind: "can_assume", to: "release-manager" },
      { from: "release-manager", kind: "can_assume", to: "prod-admin" },
    ],
  });
  assert.equal(intern.witness_cuts.length, 6);

  const safe = receipt.result.findings.find(
    (finding) => finding.constraint_id === "payroll-no-prod-deploy",
  );
  assert.equal(safe.status, "pass");
  assert.deepEqual(safe.witnesses, []);
  assert.deepEqual(safe.witness_cuts, []);
});

test("separation-of-duties records both shortest role witnesses", async () => {
  const receipt = analyzePolicy(
    await readPolicyFile("examples/orion.synthetic.json"),
  );
  const finding = receipt.result.findings.find(
    (item) => item.constraint_id === "approver-no-request",
  );
  assert.equal(finding.status, "violation");
  assert.deepEqual(
    finding.witnesses.map((witness) => witness.reached_role),
    ["approver", "requester"],
  );
  assert.equal(finding.witnesses[0].steps.length, 0);
  assert.deepEqual(finding.witnesses[1].steps, [
    { from: "approver", kind: "inherits", to: "requester" },
  ]);
});

test("shortest then lexicographic witness choice is deterministic", () => {
  const raw = {
    schema_version: "roleproof.policy.v1",
    title: "Synthetic alternatives",
    principals: [{ id: "person", assigned_roles: ["alpha", "beta"] }],
    roles: [
      {
        id: "alpha",
        inherits: [],
        can_assume: ["grant-a"],
        grants: [],
      },
      {
        id: "beta",
        inherits: [],
        can_assume: ["grant-b"],
        grants: [],
      },
      {
        id: "grant-a",
        inherits: [],
        can_assume: [],
        grants: [{ resource: "prod", actions: ["deploy"] }],
      },
      {
        id: "grant-b",
        inherits: [],
        can_assume: [],
        grants: [{ resource: "prod", actions: ["deploy"] }],
      },
    ],
    resources: [{ id: "prod", sensitivity: "critical" }],
    constraints: [{
      id: "deny",
      kind: "deny_access",
      principal: "person",
      resource: "prod",
      action: "deploy",
      severity: "critical",
    }],
  };
  const policy = parsePolicyBytes(Buffer.from(JSON.stringify(raw)));
  const receipt = analyzePolicy(policy);
  assert.equal(
    receipt.result.findings[0].witnesses[0].assignment.role,
    "alpha",
  );
  assert.equal(receipt.result.findings[0].witnesses[0].grant.role, "grant-a");
});

test("strongly connected roles are reported once without unbounded traversal", () => {
  const raw = {
    schema_version: "roleproof.policy.v1",
    title: "Synthetic cycle",
    principals: [{ id: "person", assigned_roles: ["reader"] }],
    roles: [
      {
        id: "reader",
        inherits: [],
        can_assume: ["writer"],
        grants: [],
      },
      {
        id: "writer",
        inherits: ["reader"],
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
  const result = analyzePolicy(
    parsePolicyBytes(Buffer.from(JSON.stringify(raw))),
  ).result;
  assert.deepEqual(result.cycles, [{
    edge_count: 2,
    roles: ["reader", "writer"],
  }]);
  assert.equal(result.principals[0].effective_roles.length, 2);
  assert.equal(result.findings[0].status, "violation");
});

test("normalization makes receipts invariant to source array order", async () => {
  const original = await readPolicyFile("examples/orion.synthetic.json");
  const reordered = {
    ...original,
    principals: [...original.principals].reverse(),
    resources: [...original.resources].reverse(),
    roles: [...original.roles].reverse(),
    constraints: [...original.constraints].reverse(),
  };
  const normalized = parsePolicyBytes(Buffer.from(JSON.stringify(reordered)));
  assert.deepEqual(analyzePolicy(original), analyzePolicy(normalized));
});
