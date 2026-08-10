import { canonicalStringify, sha256Hex } from "./canonical.mjs";

export const ANALYSIS_FORMAT = "roleproof.analysis.v1";
export const RECEIPT_FORMAT = "roleproof.receipt.v1";
export const ENGINE_VERSION = "0.1.0";

function graph(policy) {
  const edges = new Map();
  for (const role of policy.roles) {
    const outgoing = [
      ...role.inherits.map((target) => ({
        from: role.id,
        kind: "inherits",
        to: target,
      })),
      ...role.can_assume.map((target) => ({
        from: role.id,
        kind: "can_assume",
        to: target,
      })),
    ];
    outgoing.sort((left, right) =>
      (left.to + "\u0000" + left.kind).localeCompare(
        right.to + "\u0000" + right.kind,
      ),
    );
    edges.set(role.id, outgoing);
  }
  return edges;
}

function shortestPaths(principal, edges) {
  const paths = new Map();
  const queue = [];
  for (const role of principal.assigned_roles) {
    const witness = {
      assignment: { principal: principal.id, role },
      steps: [],
    };
    paths.set(role, witness);
    queue.push(role);
  }
  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor];
    cursor += 1;
    const witness = paths.get(current);
    for (const edge of edges.get(current)) {
      if (paths.has(edge.to)) continue;
      paths.set(edge.to, {
        assignment: { ...witness.assignment },
        steps: [...witness.steps, { ...edge }],
      });
      queue.push(edge.to);
    }
  }
  return paths;
}

function pathKey(witness) {
  return canonicalStringify(witness);
}

function chooseWitness(current, candidate) {
  if (current === undefined) return candidate;
  if (candidate.steps.length !== current.steps.length) {
    return candidate.steps.length < current.steps.length ? candidate : current;
  }
  return pathKey(candidate) < pathKey(current) ? candidate : current;
}

function roleWitness(path, reachedRole) {
  return {
    assignment: { ...path.assignment },
    reached_role: reachedRole,
    steps: path.steps.map((edge) => ({ ...edge })),
  };
}

function grantWitness(path, role, resource, action) {
  return {
    assignment: { ...path.assignment },
    grant: { action, resource, role },
    steps: path.steps.map((edge) => ({ ...edge })),
  };
}

function cutsFor(witnesses) {
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

function stronglyConnected(policy, edges) {
  const indexes = new Map();
  const low = new Map();
  const stack = [];
  const active = new Set();
  const components = [];
  let next = 0;

  const visit = (role) => {
    indexes.set(role, next);
    low.set(role, next);
    next += 1;
    stack.push(role);
    active.add(role);
    for (const edge of edges.get(role)) {
      if (!indexes.has(edge.to)) {
        visit(edge.to);
        low.set(role, Math.min(low.get(role), low.get(edge.to)));
      } else if (active.has(edge.to)) {
        low.set(role, Math.min(low.get(role), indexes.get(edge.to)));
      }
    }
    if (low.get(role) !== indexes.get(role)) return;
    const component = [];
    while (true) {
      const member = stack.pop();
      active.delete(member);
      component.push(member);
      if (member === role) break;
    }
    if (component.length > 1) components.push(component.sort());
  };

  for (const role of policy.roles.map((item) => item.id).sort()) {
    if (!indexes.has(role)) visit(role);
  }
  return components
    .sort((left, right) => left.join("\u0000").localeCompare(right.join("\u0000")))
    .map((roles) => ({
      edge_count: roles.reduce(
        (count, role) =>
          count + edges.get(role).filter((edge) => roles.includes(edge.to)).length,
        0,
      ),
      roles,
    }));
}

function analyzePrincipal(policy, principal, edges, rolesById) {
  const paths = shortestPaths(principal, edges);
  const grants = new Map();
  for (const [roleId, path] of paths) {
    const role = rolesById.get(roleId);
    for (const grant of role.grants) {
      for (const action of grant.actions) {
        const key = grant.resource + "\u0000" + action;
        const witness = grantWitness(path, roleId, grant.resource, action);
        grants.set(key, chooseWitness(grants.get(key), witness));
      }
    }
  }
  return {
    assigned_roles: [...principal.assigned_roles],
    effective_grants: [...grants.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, witness]) => ({
        action: witness.grant.action,
        resource: witness.grant.resource,
        via_role: witness.grant.role,
        witness,
      })),
    effective_roles: [...paths.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([role, path]) => ({
        role,
        witness: roleWitness(path, role),
      })),
    id: principal.id,
    paths,
    grants,
  };
}

function publicPrincipal(value) {
  return {
    assigned_roles: value.assigned_roles,
    effective_grants: value.effective_grants,
    effective_roles: value.effective_roles,
    id: value.id,
  };
}

function findingFor(constraint, principal) {
  if (constraint.kind === "deny_access") {
    const key = constraint.resource + "\u0000" + constraint.action;
    const witness = principal.grants.get(key);
    const witnesses = witness === undefined ? [] : [witness];
    return {
      action: constraint.action,
      constraint_id: constraint.id,
      kind: constraint.kind,
      principal: constraint.principal,
      resource: constraint.resource,
      severity: constraint.severity,
      status: witness === undefined ? "pass" : "violation",
      witness_cuts: cutsFor(witnesses),
      witnesses,
    };
  }
  const witnesses = constraint.roles
    .map((role) => {
      const match = principal.paths.get(role);
      return match === undefined ? undefined : roleWitness(match, role);
    })
    .filter((value) => value !== undefined)
    .sort((left, right) => left.reached_role.localeCompare(right.reached_role));
  const violated = witnesses.length === constraint.roles.length;
  return {
    constraint_id: constraint.id,
    kind: constraint.kind,
    principal: constraint.principal,
    roles: [...constraint.roles],
    severity: constraint.severity,
    status: violated ? "violation" : "pass",
    witness_cuts: violated ? cutsFor(witnesses) : [],
    witnesses: violated ? witnesses : [],
  };
}

export function analyzePolicy(policy) {
  const edges = graph(policy);
  const rolesById = new Map(policy.roles.map((role) => [role.id, role]));
  const internalPrincipals = policy.principals.map((principal) =>
    analyzePrincipal(policy, principal, edges, rolesById),
  );
  const principalsById = new Map(
    internalPrincipals.map((principal) => [principal.id, principal]),
  );
  const findings = policy.constraints.map((constraint) =>
    findingFor(constraint, principalsById.get(constraint.principal)),
  );
  const violations = findings.filter((finding) => finding.status === "violation");
  const cycles = stronglyConnected(policy, edges);
  const result = {
    cycles,
    engine: {
      algorithm: "bounded-bfs-shortest-then-lexicographic",
      name: "RoleProof",
      version: ENGINE_VERSION,
    },
    findings,
    format: ANALYSIS_FORMAT,
    policy: {
      constraints: policy.constraints.length,
      principals: policy.principals.length,
      resources: policy.resources.length,
      roles: policy.roles.length,
      sha256: sha256Hex(policy),
      title: policy.title,
    },
    principals: internalPrincipals.map(publicPrincipal),
    summary: {
      critical_violations: violations.filter(
        (finding) => finding.severity === "critical",
      ).length,
      cycle_components: cycles.length,
      high_violations: violations.filter(
        (finding) => finding.severity === "high",
      ).length,
      passes: findings.length - violations.length,
      total_constraints: findings.length,
      violations: violations.length,
    },
  };
  return {
    format: RECEIPT_FORMAT,
    policy_sha256: result.policy.sha256,
    result,
    result_sha256: sha256Hex(result),
  };
}
