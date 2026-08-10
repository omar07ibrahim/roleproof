const byId = (id) => document.getElementById(id);

const state = {
  filter: "all",
  receipt: null,
  selected: null,
  verification: null,
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shortHash(value) {
  return value.slice(0, 12) + "…" + value.slice(-8);
}

function findingTarget(finding) {
  if (finding.kind === "deny_access") {
    return finding.action + " · " + finding.resource;
  }
  return finding.roles.join(" + ");
}

function findingSummary(finding) {
  if (finding.kind === "deny_access") {
    return (
      finding.principal +
      (finding.status === "violation" ? " can reach " : " cannot reach ") +
      finding.action +
      " on " +
      finding.resource +
      "."
    );
  }
  return (
    finding.principal +
    (finding.status === "violation" ? " reaches both " : " does not reach both ") +
    finding.roles.join(" and ") +
    "."
  );
}

function renderList() {
  const list = byId("finding-list");
  list.replaceChildren();
  const findings = state.receipt.result.findings.filter(
    (finding) => state.filter === "all" || finding.status === state.filter,
  );
  byId("visible-count").textContent = String(findings.length);
  for (const finding of findings) {
    const button = element("button", "finding");
    button.type = "button";
    button.dataset.constraint = finding.constraint_id;
    button.setAttribute(
      "aria-current",
      finding.constraint_id === state.selected ? "true" : "false",
    );
    const top = element("span", "finding-top");
    top.append(
      element("span", "finding-id", finding.constraint_id),
      element("span", "pill " + finding.status, finding.status),
    );
    button.append(top, element("p", "", findingTarget(finding)));
    button.addEventListener("click", () => {
      state.selected = finding.constraint_id;
      renderList();
      renderInspector();
    });
    list.append(button);
  }
}

function arrow(label) {
  const wrapper = element("span", "arrow");
  wrapper.append(element("span", "", label), element("b", "", "→"));
  return wrapper;
}

function renderWitness(witness, index) {
  const card = element("section", "witness");
  card.append(
    element(
      "p",
      "witness-label",
      witness.reached_role
        ? "ROLE WITNESS " + String(index + 1)
        : "ACCESS WITNESS " + String(index + 1),
    ),
  );
  const path = element("div", "path");
  path.append(element("span", "node", witness.assignment.role));
  for (const step of witness.steps) {
    path.append(
      arrow(step.kind === "inherits" ? "inherits" : "assumes"),
      element("span", "node", step.to),
    );
  }
  if (witness.grant) {
    path.append(
      arrow("grants " + witness.grant.action),
      element("span", "node target", witness.grant.resource),
    );
  }
  card.append(path);
  return card;
}

function cutLabel(cut) {
  if (cut.kind === "remove_assignment") {
    return "unassign " + cut.principal + " → " + cut.role;
  }
  if (cut.kind === "remove_grant") {
    return "remove " + cut.role + " · " + cut.action + ":" + cut.resource;
  }
  return (
    (cut.kind === "remove_inheritance" ? "unlink " : "revoke assume ") +
    cut.from_role +
    " → " +
    cut.to_role
  );
}

function renderInspector() {
  const finding = state.receipt.result.findings.find(
    (item) => item.constraint_id === state.selected,
  );
  if (!finding) return;
  byId("inspector-kind").textContent =
    finding.kind === "deny_access" ? "DENY ACCESS" : "SEPARATION OF DUTIES";
  byId("inspector-title").textContent = finding.constraint_id;
  byId("inspector-summary").textContent = findingSummary(finding);
  const severity = byId("inspector-severity");
  severity.textContent =
    finding.status === "pass" ? "PASS" : finding.severity;
  severity.className = "severity" + (finding.status === "pass" ? " pass" : "");

  const witnesses = byId("witnesses");
  witnesses.replaceChildren();
  if (finding.witnesses.length === 0) {
    witnesses.append(
      element("p", "empty", "No violating witness exists in the declared graph."),
    );
  } else {
    finding.witnesses.forEach((witness, index) => {
      witnesses.append(renderWitness(witness, index));
    });
  }

  const cuts = byId("cut-list");
  cuts.replaceChildren();
  if (finding.witness_cuts.length === 0) {
    cuts.append(element("span", "cut-chip", "no cut required"));
  } else {
    for (const cut of finding.witness_cuts) {
      cuts.append(element("span", "cut-chip", cutLabel(cut)));
    }
  }
}

function renderSummary() {
  const summary = state.receipt.result.summary;
  byId("metric-violations").textContent = String(summary.violations);
  byId("metric-total").textContent = String(summary.total_constraints);
  byId("metric-critical").textContent = String(summary.critical_violations);
  byId("metric-passes").textContent = String(summary.passes);
  byId("metric-cycles").textContent = String(summary.cycle_components);
  const policy = byId("policy-hash");
  const result = byId("result-hash");
  policy.textContent = shortHash(state.receipt.policy_sha256);
  policy.title = state.receipt.policy_sha256;
  result.textContent = shortHash(state.receipt.result_sha256);
  result.title = state.receipt.result_sha256;
}

function renderChecks() {
  const list = byId("proof-checks");
  list.replaceChildren();
  for (const name of Object.keys(state.verification.checks).sort()) {
    list.append(element("li", "", name.replaceAll("_", " ")));
  }
}

async function loadJson(url) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("evidence_fetch_failed");
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error("unexpected_type");
  return response.json();
}

function installFilters() {
  for (const button of document.querySelectorAll("[data-filter]")) {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      for (const candidate of document.querySelectorAll("[data-filter]")) {
        candidate.setAttribute(
          "aria-pressed",
          candidate === button ? "true" : "false",
        );
      }
      renderList();
    });
  }
}

try {
  const [receipt, verification] = await Promise.all([
    loadJson("/data/analysis.receipt.json"),
    loadJson("/data/verification.json"),
  ]);
  if (
    receipt.format !== "roleproof.receipt.v1" ||
    verification.format !== "roleproof.verification.v1" ||
    verification.status !== "verified" ||
    receipt.result_sha256 !== verification.result_sha256
  ) {
    throw new Error("evidence_binding_failed");
  }
  state.receipt = receipt;
  state.verification = verification;
  state.selected =
    receipt.result.findings.find((finding) => finding.status === "violation")
      ?.constraint_id || receipt.result.findings[0]?.constraint_id;
  renderSummary();
  renderList();
  renderInspector();
  renderChecks();
  installFilters();
  const status = byId("verification-status");
  status.classList.add("ready");
  status.lastChild.textContent = " Verified receipt";
  document.body.dataset.ready = "true";
} catch {
  byId("fatal").hidden = false;
  byId("verification-status").lastChild.textContent = " Evidence unavailable";
}
