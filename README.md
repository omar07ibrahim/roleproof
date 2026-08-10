# RoleProof

RoleProof is a dependency-free symbolic AI and security laboratory for
explaining how a bounded RBAC graph violates explicit access constraints.

The rebuild starts with a strict roleproof.policy.v1 contract: duplicate-key
JSON rejection, bounded graph sizes, typed inheritance and assumption edges,
canonical normalization, race-aware regular-file reads, and synthetic data
only. Deterministic shortest witnesses, independent verification, the CLI,
dashboard, and reproducible evidence are added in subsequent reviewed commits.

Install with npm ci and run the current contract suite with npm test.

The synthetic Orion policy in examples/orion.synthetic.json demonstrates
multi-hop access paths without using employee records or live IAM exports.

See [the policy contract](docs/policy-contract.md) and
[the security boundary](SECURITY.md).

## Claim boundary

RoleProof analyzes only the declared bounded model. It is not a live IAM
scanner, authorization engine, compliance certification, or proof that an
external provider enforces the modeled policy.
