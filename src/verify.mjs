import { canonicalStringify, sha256Hex } from "./canonical.mjs";

export const VERIFICATION_FORMAT = "roleproof.verification.v1";

export class VerificationError extends Error {
  constructor(code) {
    super(code);
    this.name = "VerificationError";
    this.code = code;
  }
}

const fail = (code) => {
  throw new VerificationError(code);
};

function exact(value, keys, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(code);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(code);
  }
}

function buildModel(policy) {
  const ids = policy.roles.map((role) => role.id);
  const index = new Map(ids.map((id, position) => [id, position]));
  const count = ids.length;
  const distance = Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, column) =>
      row === column ? 0 : Number.POSITIVE_INFINITY,
    ),
  );
  const edgeKinds = new Map();
  for (const role of policy.roles) {
    const from = index.get(role.id);
    for (const target of role.inherits) {
      distance[from][index.get(target)] = 1;
      edgeKinds.set(role.id + "\u0000" + target + "\u0000inherits", true);
    }
    for (const target of role.can_assume) {
      distance[from][index.get(target)] = 1;
      edgeKinds.set(role.id + "\u0000" + target + "\u0000can_assume", true);
    }
  }
  for (let middle = 0; middle < count; middle += 1) {
    for (let from = 0; from < count; from += 1) {
      for (let to = 0; to < count; to += 1) {
        const candidate = distance[from][middle] + distance[middle][to];
        if (candidate < distance[from][to]) distance[from][to] = candidate;
      }
    }
  }
  const rolesById = new Map(policy.roles.map((role) => [role.id, role]));
  return { distance, edgeKinds, ids, index, rolesById };
}

function principalModel(policy, principal, model) {
  const reachable = new Set();
  const grants = new Set();
  for (const assigned of principal.assigned_roles) {
    const from = model.index.get(assigned);
    for (const role of policy.roles) {
      if (Number.isFinite(model.distance[from][model.index.get(role.id)])) {
        reachable.add(role.id);
        for (const grant of role.grants) {
          for (const action of grant.actions) {
            grants.add(grant.resource + "\u0000" + action);
          }
        }
      }
    }
  }
  return { grants, reachable };
}

function validateSteps(policy, principal, witness, target, model) {
  exact(witness.assignment, ["principal", "role"], "invalid_assignment");
  if (
    witness.assignment.principal !== principal.id ||
    !principal.assigned_roles.includes(witness.assignment.role) ||
    !Array.isArray(witness.steps) ||
    witness.steps.length > policy.roles.length - 1
  ) {
    fail("invalid_assignment");
  }
  let current = witness.assignment.role;
  const visited = new Set([current]);
  for (const step of witness.steps) {
    exact(step, ["from", "kind", "to"], "invalid_witness_step");
    if (
      step.from !== current ||
      !["inherits", "can_assume"].includes(step.kind) ||
      !model.edgeKinds.has(
        step.from + "\u0000" + step.to + "\u0000" + step.kind,
      ) ||
      visited.has(step.to)
    ) {
      fail("invalid_witness_step");
    }
    current = step.to;
    visited.add(current);
  }
  if (current !== target) fail("invalid_witness_target");
  const targetIndex = model.index.get(target);
  const shortest = Math.min(
    ...principal.assigned_roles.map(
      (role) => model.distance[model.index.get(role)][targetIndex],
    ),
  );
  if (witness.steps.length !== shortest) fail("non_shortest_witness");
}

function validateRoleWitness(policy, principal, witness, expectedRole, model) {
  exact(
    witness,
    ["assignment", "reached_role", "steps"],
    "invalid_role_witness",
  );
  if (witness.reached_role !== expectedRole) fail("invalid_role_witness");
  validateSteps(policy, principal, witness, expectedRole, model);
}

function grantExists(role, resource, action) {
  return role.grants.some(
    (grant) =>
      grant.resource === resource && grant.actions.includes(action),
  );
}

function validateGrantWitness(
  policy,
  principal,
  witness,
  resource,
  action,
  model,
) {
  exact(witness, ["assignment", "grant", "steps"], "invalid_grant_witness");
  exact(witness.grant, ["action", "resource", "role"], "invalid_grant_witness");
  if (
    witness.grant.resource !== resource ||
    witness.grant.action !== action ||
    !model.rolesById.has(witness.grant.role) ||
    !grantExists(
      model.rolesById.get(witness.grant.role),
      resource,
      action,
    )
  ) {
    fail("invalid_grant_witness");
  }
  validateSteps(policy, principal, witness, witness.grant.role, model);
  const grantRoles = policy.roles
    .filter((role) => grantExists(role, resource, action))
    .map((role) => role.id);
  const shortest = Math.min(
    ...principal.assigned_roles.flatMap((assigned) =>
      grantRoles.map(
        (role) =>
          model.distance[model.index.get(assigned)][model.index.get(role)],
      ),
    ),
  );
  if (witness.steps.length !== shortest) fail("non_shortest_grant_witness");
}

function expectedCuts(witnesses) {
  const cuts = new Map();
  for (const witness of witnesses) {
    const assignment = {
      kind: "remove_assignment",
      principal: witness.assignment.principal,
      role: witness.assignment.role,
      scope: "chosen_witness_only",
    };
    cuts.set(canonicalStringify(assignment), assignment);
    for (const step of witness.steps) {
      const cut = {
        from_role: step.from,
        kind:
          step.kind === "inherits"
            ? "remove_inheritance"
            : "remove_assumption",
        scope: "chosen_witness_only",
        to_role: step.to,
      };
      cuts.set(canonicalStringify(cut), cut);
    }
    if (witness.grant !== undefined) {
      const cut = {
        action: witness.grant.action,
        kind: "remove_grant",
        resource: witness.grant.resource,
        role: witness.grant.role,
        scope: "chosen_witness_only",
      };
      cuts.set(canonicalStringify(cut), cut);
    }
  }
  return [...cuts.values()].sort((left, right) =>
    canonicalStringify(left).localeCompare(canonicalStringify(right)),
  );
}

function cycleComponents(policy, model) {
  const consumed = new Set();
  const components = [];
  for (const role of model.ids) {
    if (consumed.has(role)) continue;
    const position = model.index.get(role);
    const members = model.ids.filter((candidate) => {
      const other = model.index.get(candidate);
      return (
        Number.isFinite(model.distance[position][other]) &&
        Number.isFinite(model.distance[other][position])
      );
    });
    for (const member of members) consumed.add(member);
    if (members.length < 2) continue;
    members.sort();
    const memberSet = new Set(members);
    const edgeCount = policy.roles
      .filter((item) => memberSet.has(item.id))
      .reduce(
        (total, item) =>
          total +
          [...item.inherits, ...item.can_assume].filter((target) =>
            memberSet.has(target),
          ).length,
        0,
      );
    components.push({ edge_count: edgeCount, roles: members });
  }
  return components.sort((left, right) =>
    left.roles.join("\u0000").localeCompare(right.roles.join("\u0000")),
  );
}

function validatePrincipals(policy, result, model, principalModels) {
  if (
    !Array.isArray(result.principals) ||
    result.principals.length !== policy.principals.length
  ) {
    fail("invalid_principals");
  }
  for (let index = 0; index < policy.principals.length; index += 1) {
    const principal = policy.principals[index];
    const actual = result.principals[index];
    const expected = principalModels.get(principal.id);
    exact(
      actual,
      ["assigned_roles", "effective_grants", "effective_roles", "id"],
      "invalid_principal",
    );
    if (
      actual.id !== principal.id ||
      canonicalStringify(actual.assigned_roles) !==
        canonicalStringify(principal.assigned_roles) ||
      !Array.isArray(actual.effective_roles) ||
      !Array.isArray(actual.effective_grants)
    ) {
      fail("invalid_principal");
    }
    const roleIds = actual.effective_roles.map((entry) => entry.role);
    if (
      canonicalStringify(roleIds) !==
      canonicalStringify([...expected.reachable].sort())
    ) {
      fail("incomplete_role_closure");
    }
    for (const entry of actual.effective_roles) {
      exact(entry, ["role", "witness"], "invalid_effective_role");
      validateRoleWitness(policy, principal, entry.witness, entry.role, model);
    }
    const grantKeys = actual.effective_grants.map(
      (entry) => entry.resource + "\u0000" + entry.action,
    );
    if (
      canonicalStringify(grantKeys) !==
      canonicalStringify([...expected.grants].sort())
    ) {
      fail("incomplete_grant_closure");
    }
    for (const entry of actual.effective_grants) {
      exact(
        entry,
        ["action", "resource", "via_role", "witness"],
        "invalid_effective_grant",
      );
      if (entry.via_role !== entry.witness.grant?.role) {
        fail("invalid_effective_grant");
      }
      validateGrantWitness(
        policy,
        principal,
        entry.witness,
        entry.resource,
        entry.action,
        model,
      );
    }
  }
}

function validateFindings(policy, result, model, principalModels) {
  if (
    !Array.isArray(result.findings) ||
    result.findings.length !== policy.constraints.length
  ) {
    fail("invalid_findings");
  }
  const statuses = [];
  for (let index = 0; index < policy.constraints.length; index += 1) {
    const constraint = policy.constraints[index];
    const finding = result.findings[index];
    const principal = policy.principals.find(
      (item) => item.id === constraint.principal,
    );
    const principalState = principalModels.get(principal.id);
    if (
      finding.constraint_id !== constraint.id ||
      finding.kind !== constraint.kind ||
      finding.principal !== constraint.principal ||
      finding.severity !== constraint.severity ||
      !Array.isArray(finding.witnesses) ||
      !Array.isArray(finding.witness_cuts)
    ) {
      fail("invalid_finding");
    }
    let violated;
    if (constraint.kind === "deny_access") {
      exact(
        finding,
        [
          "action",
          "constraint_id",
          "kind",
          "principal",
          "resource",
          "severity",
          "status",
          "witness_cuts",
          "witnesses",
        ],
        "invalid_finding",
      );
      if (
        finding.action !== constraint.action ||
        finding.resource !== constraint.resource
      ) {
        fail("invalid_finding");
      }
      violated = principalState.grants.has(
        constraint.resource + "\u0000" + constraint.action,
      );
      if (violated) {
        if (finding.witnesses.length !== 1) fail("invalid_witness_count");
        validateGrantWitness(
          policy,
          principal,
          finding.witnesses[0],
          constraint.resource,
          constraint.action,
          model,
        );
      }
    } else {
      exact(
        finding,
        [
          "constraint_id",
          "kind",
          "principal",
          "roles",
          "severity",
          "status",
          "witness_cuts",
          "witnesses",
        ],
        "invalid_finding",
      );
      if (
        canonicalStringify(finding.roles) !==
        canonicalStringify(constraint.roles)
      ) {
        fail("invalid_finding");
      }
      violated = constraint.roles.every((role) =>
        principalState.reachable.has(role),
      );
      if (violated) {
        if (finding.witnesses.length !== 2) fail("invalid_witness_count");
        for (let item = 0; item < constraint.roles.length; item += 1) {
          validateRoleWitness(
            policy,
            principal,
            finding.witnesses[item],
            constraint.roles[item],
            model,
          );
        }
      }
    }
    const expectedStatus = violated ? "violation" : "pass";
    if (
      finding.status !== expectedStatus ||
      (!violated &&
        (finding.witnesses.length !== 0 ||
          finding.witness_cuts.length !== 0))
    ) {
      fail("invalid_finding_status");
    }
    if (
      violated &&
      canonicalStringify(finding.witness_cuts) !==
        canonicalStringify(expectedCuts(finding.witnesses))
    ) {
      fail("invalid_witness_cuts");
    }
    statuses.push({
      constraint_id: constraint.id,
      severity: constraint.severity,
      status: expectedStatus,
    });
  }
  return statuses;
}

export function verifyReceipt(policy, receipt) {
  exact(
    receipt,
    ["format", "policy_sha256", "result", "result_sha256"],
    "invalid_receipt",
  );
  if (
    receipt.format !== "roleproof.receipt.v1" ||
    receipt.policy_sha256 !== sha256Hex(policy) ||
    receipt.result_sha256 !== sha256Hex(receipt.result)
  ) {
    fail("hash_mismatch");
  }
  const result = receipt.result;
  exact(
    result,
    [
      "cycles",
      "engine",
      "findings",
      "format",
      "policy",
      "principals",
      "summary",
    ],
    "invalid_result",
  );
  if (result.format !== "roleproof.analysis.v1") fail("invalid_result");
  exact(result.policy, [
    "constraints",
    "principals",
    "resources",
    "roles",
    "sha256",
    "title",
  ], "invalid_policy_binding");
  if (
    result.policy.sha256 !== receipt.policy_sha256 ||
    result.policy.title !== policy.title ||
    result.policy.constraints !== policy.constraints.length ||
    result.policy.principals !== policy.principals.length ||
    result.policy.resources !== policy.resources.length ||
    result.policy.roles !== policy.roles.length
  ) {
    fail("invalid_policy_binding");
  }
  const model = buildModel(policy);
  const principalModels = new Map(
    policy.principals.map((principal) => [
      principal.id,
      principalModel(policy, principal, model),
    ]),
  );
  validatePrincipals(policy, result, model, principalModels);
  const statuses = validateFindings(
    policy,
    result,
    model,
    principalModels,
  );
  const violations = statuses.filter((item) => item.status === "violation");
  const cycles = cycleComponents(policy, model);
  if (canonicalStringify(result.cycles) !== canonicalStringify(cycles)) {
    fail("invalid_cycle_components");
  }
  const summary = {
    critical_violations: violations.filter(
      (item) => item.severity === "critical",
    ).length,
    cycle_components: cycles.length,
    high_violations: violations.filter((item) => item.severity === "high").length,
    passes: statuses.length - violations.length,
    total_constraints: statuses.length,
    violations: violations.length,
  };
  if (canonicalStringify(result.summary) !== canonicalStringify(summary)) {
    fail("invalid_summary");
  }
  return {
    checks: {
      cycle_components: true,
      finding_completeness: true,
      hash_binding: true,
      principal_closure: true,
      shortest_witnesses: true,
      witness_cuts: true,
    },
    constraint_status_sha256: sha256Hex(statuses),
    format: VERIFICATION_FORMAT,
    policy_sha256: receipt.policy_sha256,
    result_sha256: receipt.result_sha256,
    status: "verified",
  };
}
