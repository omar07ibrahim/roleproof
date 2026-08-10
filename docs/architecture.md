# Architecture

RoleProof turns one bounded policy into two independently computed views of
reachability, then publishes a closed receipt and a static exploration surface.

![RoleProof verification architecture](evidence/roleproof-verification-architecture.svg)

## Data flow

1. `readPolicyFile` performs a race-aware regular-file read and passes bytes to
   the custom JSON decoder.
2. `parsePolicyBytes` enforces the complete `roleproof.policy.v1` schema and
   normalizes every set-like collection.
3. `analyzePolicy` hashes the normalized policy, builds typed adjacency, finds
   shortest witnesses, identifies SCCs, evaluates all constraints, and derives
   cuts on each chosen witness.
4. `verifyReceipt` receives the policy and receipt but never imports the
   analyzer. It builds its own role index and Floyd–Warshall closure, then
   checks finding completeness, cycle components, principal reachability,
   witness steps, grants, shortest lengths, cuts, summaries, and hashes.
5. `buildAuditBundle` emits the normalized policy, analysis receipt,
   verification, and a file manifest.
6. `build-site.mjs` copies an exact three-file frontend and binds it to the same
   generated audit data and source-derived role graph.
7. The dashboard constructs its UI with DOM text nodes and explores only the
   verified static receipt.

## Trust boundaries

| Boundary | Accepted input | Output |
|---|---|---|
| Decoder | Untrusted bytes from one regular file | Fully validated normalized policy |
| Analyzer | Normalized policy | Deterministic receipt |
| Verifier | Normalized policy plus untrusted receipt | Verified status or sanitized failure |
| Bundle writer | In-memory closed bundle | New private directory with fixed files |
| Site build | Repository-owned frontend plus synthetic policy | Nine-file static site |
| HTTP server | Local GET/HEAD request | One allowlisted immutable asset |
| Evidence job | Read-only source tree plus built site | Source-bound screenshots, diagrams, JSON, manifest |

## Deterministic witnesses

Every outgoing edge is typed as `inherits` or `can_assume` and sorted. The
analyzer uses breadth-first search, so the first reachable path has the fewest
edges. Equal-length candidates are resolved lexicographically. Access witnesses
append the exact grant that reaches an action/resource pair.

This gives reviewers stable output across runs and makes path-length validation
possible. It does not claim to find the cheapest organizational remediation.

## Cycles

Role inheritance and assumption may be cyclic even when direct self-edges are
forbidden. Tarjan's algorithm reports strongly connected components in
`O(V + E)` time. Traversal tracks visited roles, so cycles do not create
unbounded recursion or repeated paths.

## Independent verification

The verifier intentionally duplicates reachability logic with a different
algorithm. Floyd–Warshall costs `O(R³)`, which is acceptable because the
contract caps `R` at 64 roles. This independence is more valuable here than
micro-optimizing a small graph:

- analyzer BFS proves a concrete shortest witness;
- verifier closure proves whether reachability exists at all;
- verifier edge/grant checks prove the concrete witness is legal;
- verifier shortest-distance checks reject longer substituted paths; and
- canonical hashes reject semantic changes even when a receipt is reserialized.

A rehashed receipt is not automatically trusted. The verifier reconstructs the
expected constraint set and summary, so omitted violations and false passes
still fail.

## Witness cuts

A cut is one assignment, typed role edge, or grant appearing on the selected
witness. Removing it would break that witness. Cuts are labeled
`chosen_witness_only` because another witness may survive. Global minimum cut,
risk scoring, and provider-specific remediation are intentionally outside
version 1.

## Storage and publication

The CLI creates an output directory only if it does not exist. Files are staged
under a private temporary directory, written with restrictive modes, checked
against an exact inventory, and published atomically. This prevents partial or
silently overwritten review bundles.

The static dashboard is a projection of generated JSON; it does not calculate
policy findings in the browser. The loopback server has no directory listing,
fallback routes, request-body handling, template rendering, or remote bind
mode.

## Source map

| Module | Role |
|---|---|
| `src/json.mjs` | Bounded duplicate-aware JSON tokenizer/parser |
| `src/contracts.mjs` | Schema, limits, normalization, safe file read |
| `src/analyze.mjs` | BFS witnesses, Tarjan SCCs, constraints, cuts |
| `src/verify.mjs` | Independent closure and receipt validation |
| `src/canonical.mjs` | Canonical serialization and SHA-256 |
| `src/io.mjs` | Strict JSON reads and atomic no-clobber writes |
| `src/bundle.mjs` | Portable receipt bundle |
| `src/render-svg.mjs` | Source-derived role graph |
| `src/server.mjs` | Guarded loopback static delivery |
| `web/app.js` | Receipt explorer with safe DOM construction |

See [the policy contract](policy-contract.md),
[threat model](threat-model.md), and
[evidence method](evidence-method.md).
