import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";

import { parseJsonStrict, StrictJsonError } from "./json.mjs";

export const POLICY_FORMAT = "roleproof.policy.v1";
export const MAX_POLICY_BYTES = 64 * 1024;
export const LIMITS = Object.freeze({
  principals: 64,
  roles: 64,
  resources: 64,
  constraints: 128,
  edgesPerRole: 32,
  grantsPerRole: 32,
  actionsPerGrant: 16,
});

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const SEVERITIES = new Set(["medium", "high", "critical"]);
const ROOT_KEYS = [
  "constraints",
  "principals",
  "resources",
  "roles",
  "schema_version",
  "title",
];

export class PolicyError extends Error {
  constructor(code, path = "$") {
    super(code);
    this.name = "PolicyError";
    this.code = code;
    this.path = path;
  }
}

const fail = (code, path) => {
  throw new PolicyError(code, path);
};

function record(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid_shape", path);
  }
  return value;
}

function exact(value, keys, path) {
  record(value, path);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail("invalid_fields", path);
  }
}

function list(value, path, minimum, maximum) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    fail("invalid_array", path);
  }
  return value;
}

function identifier(value, path) {
  if (typeof value !== "string" || !ID.test(value)) fail("invalid_id", path);
  return value;
}

function text(value, path, maximum) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    [...value].length > maximum ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    (typeof value.isWellFormed === "function" && !value.isWellFormed())
  ) {
    fail("invalid_text", path);
  }
  return value;
}

function uniqueIds(items, path) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) fail("duplicate_id", path);
    seen.add(item.id);
  }
}

function sortedUniqueIds(value, path, minimum = 0, maximum = LIMITS.edgesPerRole) {
  const result = list(value, path, minimum, maximum).map((item, index) =>
    identifier(item, path + "[" + index + "]"),
  );
  if (new Set(result).size !== result.length) fail("duplicate_reference", path);
  return result.sort();
}

function normalizeResource(value, index) {
  const path = "$.resources[" + index + "]";
  exact(value, ["id", "sensitivity"], path);
  const sensitivity = value.sensitivity;
  if (!["low", "medium", "high", "critical"].includes(sensitivity)) {
    fail("invalid_sensitivity", path + ".sensitivity");
  }
  return { id: identifier(value.id, path + ".id"), sensitivity };
}

function normalizeGrant(value, path) {
  exact(value, ["actions", "resource"], path);
  return {
    actions: sortedUniqueIds(
      value.actions,
      path + ".actions",
      1,
      LIMITS.actionsPerGrant,
    ),
    resource: identifier(value.resource, path + ".resource"),
  };
}

function normalizeRole(value, index) {
  const path = "$.roles[" + index + "]";
  exact(value, ["can_assume", "grants", "id", "inherits"], path);
  const grants = list(
    value.grants,
    path + ".grants",
    0,
    LIMITS.grantsPerRole,
  ).map((grant, grantIndex) =>
    normalizeGrant(grant, path + ".grants[" + grantIndex + "]"),
  );
  grants.sort((left, right) => left.resource.localeCompare(right.resource));
  if (new Set(grants.map((grant) => grant.resource)).size !== grants.length) {
    fail("duplicate_grant_resource", path + ".grants");
  }
  return {
    can_assume: sortedUniqueIds(value.can_assume, path + ".can_assume"),
    grants,
    id: identifier(value.id, path + ".id"),
    inherits: sortedUniqueIds(value.inherits, path + ".inherits"),
  };
}

function normalizePrincipal(value, index) {
  const path = "$.principals[" + index + "]";
  exact(value, ["assigned_roles", "id"], path);
  return {
    assigned_roles: sortedUniqueIds(
      value.assigned_roles,
      path + ".assigned_roles",
      1,
      LIMITS.roles,
    ),
    id: identifier(value.id, path + ".id"),
  };
}

function normalizeConstraint(value, index) {
  const path = "$.constraints[" + index + "]";
  record(value, path);
  const kind = value.kind;
  if (kind === "deny_access") {
    exact(
      value,
      ["action", "id", "kind", "principal", "resource", "severity"],
      path,
    );
    if (!SEVERITIES.has(value.severity)) {
      fail("invalid_severity", path + ".severity");
    }
    return {
      action: identifier(value.action, path + ".action"),
      id: identifier(value.id, path + ".id"),
      kind,
      principal: identifier(value.principal, path + ".principal"),
      resource: identifier(value.resource, path + ".resource"),
      severity: value.severity,
    };
  }
  if (kind === "separation_of_duties") {
    exact(value, ["id", "kind", "principal", "roles", "severity"], path);
    if (!SEVERITIES.has(value.severity)) {
      fail("invalid_severity", path + ".severity");
    }
    const roles = sortedUniqueIds(value.roles, path + ".roles", 2, 2);
    return {
      id: identifier(value.id, path + ".id"),
      kind,
      principal: identifier(value.principal, path + ".principal"),
      roles,
      severity: value.severity,
    };
  }
  fail("invalid_constraint_kind", path + ".kind");
}

export function parsePolicyBytes(payload) {
  if (!(payload instanceof Uint8Array)) throw new TypeError("payload must be bytes");
  if (payload.byteLength === 0 || payload.byteLength > MAX_POLICY_BYTES) {
    fail("invalid_size", "$");
  }
  let document;
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(payload);
    document = parseJsonStrict(decoded);
  } catch (error) {
    if (error instanceof StrictJsonError) {
      throw new PolicyError("invalid_json", "$");
    }
    if (error instanceof TypeError) {
      throw new PolicyError("invalid_encoding", "$");
    }
    throw error;
  }

  exact(document, ROOT_KEYS, "$");
  if (document.schema_version !== POLICY_FORMAT) {
    fail("invalid_schema_version", "$.schema_version");
  }
  const title = text(document.title, "$.title", 96);
  const resources = list(
    document.resources,
    "$.resources",
    1,
    LIMITS.resources,
  ).map(normalizeResource);
  const roles = list(document.roles, "$.roles", 1, LIMITS.roles).map(normalizeRole);
  const principals = list(
    document.principals,
    "$.principals",
    1,
    LIMITS.principals,
  ).map(normalizePrincipal);
  const constraints = list(
    document.constraints,
    "$.constraints",
    1,
    LIMITS.constraints,
  ).map(normalizeConstraint);

  for (const [items, path] of [
    [resources, "$.resources"],
    [roles, "$.roles"],
    [principals, "$.principals"],
    [constraints, "$.constraints"],
  ]) {
    uniqueIds(items, path);
    items.sort((left, right) => left.id.localeCompare(right.id));
  }

  const resourceIds = new Set(resources.map((item) => item.id));
  const roleIds = new Set(roles.map((item) => item.id));
  const principalIds = new Set(principals.map((item) => item.id));
  for (const role of roles) {
    for (const target of [...role.inherits, ...role.can_assume]) {
      if (!roleIds.has(target) || target === role.id) {
        fail("invalid_role_reference", "$.roles." + role.id);
      }
    }
    for (const grant of role.grants) {
      if (!resourceIds.has(grant.resource)) {
        fail("invalid_resource_reference", "$.roles." + role.id);
      }
    }
  }
  for (const principal of principals) {
    if (principal.assigned_roles.some((role) => !roleIds.has(role))) {
      fail("invalid_role_reference", "$.principals." + principal.id);
    }
  }
  for (const constraint of constraints) {
    if (!principalIds.has(constraint.principal)) {
      fail("invalid_principal_reference", "$.constraints." + constraint.id);
    }
    if (
      constraint.kind === "deny_access" &&
      !resourceIds.has(constraint.resource)
    ) {
      fail("invalid_resource_reference", "$.constraints." + constraint.id);
    }
    if (
      constraint.kind === "separation_of_duties" &&
      constraint.roles.some((role) => !roleIds.has(role))
    ) {
      fail("invalid_role_reference", "$.constraints." + constraint.id);
    }
  }

  return {
    constraints,
    principals,
    resources,
    roles,
    schema_version: POLICY_FORMAT,
    title,
  };
}

function sameFile(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

async function requireDescriptorWithin(handle, allowedRoot) {
  if (allowedRoot === undefined) return;
  const root = path.resolve(allowedRoot);
  let actual;
  try {
    actual = await realpath("/proc/self/fd/" + handle.fd);
  } catch {
    fail("invalid_file", "$");
  }
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!actual.startsWith(prefix)) fail("invalid_file", "$");
}

export async function readPolicyFile(filePath, allowedRoot = undefined) {
  if (typeof constants.O_NOFOLLOW !== "number") {
    fail("invalid_file", "$");
  }
  const flags =
    constants.O_RDONLY |
    (constants.O_CLOEXEC ?? 0) |
    constants.O_NOFOLLOW;
  let handle;
  try {
    handle = await open(filePath, flags);
  } catch {
    fail("invalid_file", "$");
  }
  try {
    const opened = await handle.stat({ bigint: true });
    await requireDescriptorWithin(handle, allowedRoot);
    if (
      !opened.isFile() ||
      opened.isSymbolicLink() ||
      opened.size > BigInt(MAX_POLICY_BYTES)
    ) {
      fail("invalid_file", "$");
    }
    const payload = await handle.readFile();
    const completed = await handle.stat({ bigint: true });
    if (!sameFile(opened, completed)) fail("file_changed", "$");
    return parsePolicyBytes(payload);
  } finally {
    await handle.close();
  }
}
