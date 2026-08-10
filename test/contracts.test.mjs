import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { canonicalStringify, sha256Hex } from "../src/canonical.mjs";
import {
  MAX_POLICY_BYTES,
  PolicyError,
  parsePolicyBytes,
  readPolicyFile,
} from "../src/contracts.mjs";
import { parseJsonStrict, StrictJsonError } from "../src/json.mjs";

const encoded = (value) => Buffer.from(JSON.stringify(value), "utf8");

function validDocument() {
  return {
    schema_version: "roleproof.policy.v1",
    title: "Synthetic review",
    principals: [{ id: "alice", assigned_roles: ["reader"] }],
    roles: [{
      id: "reader",
      inherits: [],
      can_assume: [],
      grants: [{ resource: "ledger", actions: ["read"] }],
    }],
    resources: [{ id: "ledger", sensitivity: "high" }],
    constraints: [{
      id: "alice-no-write",
      kind: "deny_access",
      principal: "alice",
      resource: "ledger",
      action: "write",
      severity: "high",
    }],
  };
}

test("strict JSON rejects duplicate keys and trailing content", () => {
  assert.throws(
    () => parseJsonStrict('{"x":1,"x":2}'),
    (error) => error instanceof StrictJsonError && error.code === "duplicate_key",
  );
  assert.throws(
    () => parseJsonStrict('{"x":1} false'),
    (error) => error instanceof StrictJsonError && error.code === "trailing_content",
  );
});

test("the contract normalizes set-like order deterministically", () => {
  const left = validDocument();
  left.roles[0].grants[0].actions = ["write", "read"];
  const right = validDocument();
  right.roles[0].grants[0].actions = ["read", "write"];
  const normalizedLeft = parsePolicyBytes(encoded(left));
  const normalizedRight = parsePolicyBytes(encoded(right));
  assert.deepEqual(normalizedLeft, normalizedRight);
  assert.equal(sha256Hex(normalizedLeft), sha256Hex(normalizedRight));
  assert.equal(canonicalStringify({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test("unknown fields, references, duplicates, and direct self edges fail closed", () => {
  const cases = [];
  const unknown = validDocument();
  unknown.extra = true;
  cases.push(unknown);
  const missingRole = validDocument();
  missingRole.principals[0].assigned_roles = ["missing"];
  cases.push(missingRole);
  const duplicateAction = validDocument();
  duplicateAction.roles[0].grants[0].actions = ["read", "read"];
  cases.push(duplicateAction);
  const selfEdge = validDocument();
  selfEdge.roles[0].inherits = ["reader"];
  cases.push(selfEdge);
  for (const value of cases) {
    assert.throws(() => parsePolicyBytes(encoded(value)), PolicyError);
  }
});

test("cyclic role graphs are bounded policy data", () => {
  const value = validDocument();
  value.roles.push({
    id: "writer",
    inherits: ["reader"],
    can_assume: [],
    grants: [],
  });
  value.roles[0].can_assume = ["writer"];
  const policy = parsePolicyBytes(encoded(value));
  assert.equal(policy.roles.length, 2);
});

test("byte, encoding, and leaf-file boundaries are enforced", async () => {
  assert.throws(
    () => parsePolicyBytes(Buffer.alloc(MAX_POLICY_BYTES + 1, 0x20)),
    (error) => error instanceof PolicyError && error.code === "invalid_size",
  );
  assert.throws(
    () => parsePolicyBytes(Uint8Array.from([0xff])),
    (error) => error instanceof PolicyError && error.code === "invalid_encoding",
  );

  const directory = await mkdtemp(path.join(os.tmpdir(), "roleproof-contract-"));
  try {
    const target = path.join(directory, "policy.json");
    const link = path.join(directory, "link.json");
    await writeFile(target, encoded(validDocument()), { mode: 0o600 });
    await symlink(target, link);
    await assert.rejects(
      () => readPolicyFile(link),
      (error) => error instanceof PolicyError && error.code === "invalid_file",
    );
    const policy = await readPolicyFile(target);
    assert.equal(policy.schema_version, "roleproof.policy.v1");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the reviewed synthetic example satisfies the contract", async () => {
  const policy = await readPolicyFile("examples/orion.synthetic.json");
  assert.equal(policy.principals.length, 4);
  assert.equal(policy.roles.length, 10);
  assert.equal(policy.resources.length, 4);
  assert.equal(policy.constraints.length, 5);
});
