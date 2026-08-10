# Security policy

## Supported code

Only the current default branch is supported. Historical AeroCRM revisions are
retired, are not deployed from the default branch, and must not be reused.

## RoleProof boundary

RoleProof requires no credentials, network connector, employee records, or live
IAM export. Examples and committed evidence are synthetic. Treat every imported
policy and supplied receipt as untrusted.

The input boundary caps bytes, JSON tokens, nesting, graph collections, edges,
grants, and actions. It rejects invalid UTF-8, duplicate keys, unknown fields,
invalid IDs, dangling references, symlinks, non-regular files, and files that
change while being read. The analyzer remains bounded on cyclic graphs. The
verifier reconstructs closure independently and rejects incomplete or tampered
receipts.

The local dashboard server listens only on loopback, exposes a fixed asset
inventory, validates host and request shape, and applies restrictive browser
headers. It is not intended to be exposed directly to a network.

See [the threat model](docs/threat-model.md) for assets, attacker capabilities,
controls, and residual risks.

## Claim boundary

RoleProof is an offline review aid. It is not an authorization enforcement
point, live-provider attestation, compliance certification, or guarantee that a
suggested witness cut is globally sufficient.

## Reporting

Use GitHub private vulnerability reporting. Include a minimal synthetic
reproduction where possible. Do not put credentials, personal data, production
policy exports, or undisclosed vulnerability details in public issues.
