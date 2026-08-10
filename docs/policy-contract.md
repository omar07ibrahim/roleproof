# RoleProof policy contract

roleproof.policy.v1 is a bounded, deterministic input contract for synthetic or
redacted role-based access-control graphs. It is not an IAM connector and does
not attest to live cloud state.

## Model

A principal starts with one or more assigned roles. A role may inherit other
roles, assume other roles, and grant named actions on declared resources.
RoleProof evaluates two explicit constraint types:

- deny_access: a named principal must not reach one resource/action pair.
- separation_of_duties: a named principal must not reach both named roles.

Inheritance and assumption are distinct edge kinds. Cycles are accepted as
policy data and remain bounded by the finite role set; the analyzer reports
them rather than recursing indefinitely.

## Fail-closed boundary

The decoder accepts at most 64 KiB and rejects invalid UTF-8, duplicate JSON
keys, unknown or missing fields, invalid identifiers, duplicate references,
unknown references, direct self-edges, non-regular files, symlinks, and files
that change while being read.

Version 1 caps the graph at 64 principals, 64 roles, 64 resources, 128
constraints, 32 outgoing edges per role, 32 grants per role, and 16 actions per
grant. IDs are lowercase ASCII slugs of at most 32 characters. Human-facing
titles are control-free and capped at 96 Unicode code points.

The normalized policy sorts set-like collections before hashing. A future
live-IAM importer, conditional policy language, group membership model, or
cloud-provider semantics requires a new contract.
