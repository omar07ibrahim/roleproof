# Threat model

## Scope and assets

RoleProof protects the integrity and reviewability of a bounded offline analysis
over synthetic or properly redacted policy data.

Assets in scope:

- the normalized policy and its SHA-256 identity;
- finding completeness and deterministic witness paths;
- the independent verification result;
- bundle atomicity and file permissions;
- the local dashboard's fixed static surface; and
- the provenance of committed portfolio evidence.

Live IAM state, cloud credentials, provider APIs, enforcement, compliance
certification, and multi-tenant hosting are outside scope.

## Attacker capabilities considered

An attacker may provide malformed UTF-8 or JSON, duplicate keys, excessive
nesting or tokens, oversized collections, invalid identifiers, dangling
references, cyclic roles, a symlink or changing file, a fabricated receipt, a
receipt whose hashes were recomputed after tampering, a pre-existing output
path, or malformed HTTP requests to the local server.

The evidence pipeline also treats browser tooling and Python wheels as
supply-chain inputs that must be pinned before source-derived images are
accepted.

## Controls

| Threat | Control |
|---|---|
| Parser resource exhaustion | 64 KiB byte cap plus token, depth, string, and collection limits |
| Ambiguous JSON | Custom duplicate-key rejection; unknown and missing fields fail closed |
| Graph explosion | 64-role bound, outgoing-edge/grant caps, finite visited sets |
| Cyclic traversal | Iterative bounded traversal and explicit Tarjan SCC reporting |
| Filesystem substitution | Regular-file and symlink checks, size checks, descriptor-based read, change detection |
| Receipt fabrication | Independent closure, complete constraint reconstruction, exact witness/grant/cut checks |
| Rehashed omission or false pass | Expected finding IDs, statuses, summaries, and shortest distances are recomputed |
| Partial output | Private staging directory, fixed inventory, restrictive modes, atomic no-clobber publication |
| Browser injection | Repository-owned static shell, text-node rendering, escaped source-derived SVG, restrictive CSP |
| Local HTTP confusion | Loopback-only bind, host allowlist, exact paths, GET/HEAD only, request/time limits |
| Evidence drift | Manifest hashes every artifact and source record; CI regenerates and compares every byte |
| Evidence supply chain | Hash-locked wheels and a platform-manifest-pinned Playwright image |
| Capture-time exfiltration | Container network disabled, source mounted read-only, capabilities dropped |

## Evidence container boundary

The visual job runs pinned Chromium in a container with:

- `--network=none` and `--read-only`;
- all Linux capabilities dropped;
- `no-new-privileges`;
- CPU, memory, process, and shared-memory limits;
- a temporary executable filesystem only for browser/runtime state;
- a read-only repository mount; and
- only the runner's temporary output directory writable.

The initial evidence adoption required two complete runs to be byte-identical.
The permanent workflow is read-only and fails on any artifact drift.

## Residual risks and non-goals

- SHA-256 binds bytes and canonical values; it does not make an untrusted
  policy truthful.
- The model omits groups, conditions, deny precedence, time, external identity
  providers, and provider-specific semantics.
- A witness cut blocks only the displayed witness and is not a global minimum
  remediation.
- The local server is hardened for loopback review, not designed as an
  internet-facing service.
- A user who can replace the executable source or runtime can change program
  behavior; signed release provenance is not implemented in version 1.
- Generic action/resource strings model declared facts and do not attest that a
  provider enforces them.
- Synthetic evidence is suitable for demonstration, not performance or
  compliance claims.

## Secret and privacy handling

No secret is required by RoleProof. Do not commit live policies, names, email
addresses, account IDs, tokens, or provider exports. Public examples and
evidence must remain synthetic or irreversibly redacted. The evidence verifier
rejects common credential patterns, email-like strings, absolute home paths,
and unsafe SVG elements.

Report vulnerabilities through the private process in
[SECURITY.md](../SECURITY.md).
