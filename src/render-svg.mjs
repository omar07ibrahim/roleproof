function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function roleDepths(policy, receipt) {
  const depths = new Map(policy.roles.map((role) => [role.id, Infinity]));
  for (const principal of receipt.result.principals) {
    for (const entry of principal.effective_roles) {
      depths.set(
        entry.role,
        Math.min(depths.get(entry.role), entry.witness.steps.length),
      );
    }
  }
  const reachable = [...depths.values()].filter(Number.isFinite);
  const fallback = reachable.length === 0 ? 0 : Math.max(...reachable) + 1;
  for (const [role, depth] of depths) {
    if (!Number.isFinite(depth)) depths.set(role, fallback);
  }
  return depths;
}

export function renderRoleGraph(policy, receipt) {
  const width = 1400;
  const height = 820;
  const depths = roleDepths(policy, receipt);
  const groups = new Map();
  for (const role of policy.roles) {
    const depth = depths.get(role.id);
    if (!groups.has(depth)) groups.set(depth, []);
    groups.get(depth).push(role.id);
  }
  for (const roles of groups.values()) roles.sort();
  const columns = [...groups.keys()].sort((left, right) => left - right);
  const positions = new Map();
  columns.forEach((depth, columnIndex) => {
    const roles = groups.get(depth);
    const x =
      columns.length === 1
        ? width / 2
        : 120 + columnIndex * ((width - 240) / (columns.length - 1));
    roles.forEach((role, rowIndex) => {
      const y = 205 + (rowIndex + 1) * (470 / (roles.length + 1));
      positions.set(role, { x, y });
    });
  });

  const violationRoles = new Set(
    receipt.result.findings
      .filter((finding) => finding.status === "violation")
      .flatMap((finding) =>
        finding.witnesses.flatMap((witness) => {
          const roles = [witness.assignment.role];
          for (const step of witness.steps) roles.push(step.to);
          if (witness.grant !== undefined) roles.push(witness.grant.role);
          return roles;
        }),
      ),
  );
  const assignedRoles = new Set(
    policy.principals.flatMap((principal) => principal.assigned_roles),
  );

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 820" role="img" aria-labelledby="title description">',
    '<title id="title">RoleProof effective role graph</title>',
    '<desc id="description">Source-derived role inheritance and assumption graph for the synthetic Orion policy.</desc>',
    "<defs>",
    '<marker id="arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4ee1c1"/></marker>',
    '<marker id="arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ffbb66"/></marker>',
    '<filter id="shadow" x="-20%" y="-30%" width="140%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#020817" flood-opacity=".45"/></filter>',
    "</defs>",
    '<rect width="1400" height="820" rx="28" fill="#07111f"/>',
    '<circle cx="1250" cy="40" r="280" fill="#143b52" opacity=".28"/>',
    '<circle cx="90" cy="820" r="300" fill="#153c38" opacity=".24"/>',
    '<text x="72" y="76" fill="#72ecd3" font-family="ui-monospace,monospace" font-size="15" font-weight="700" letter-spacing="2.5">ROLEPROOF · SOURCE-DERIVED GRAPH</text>',
    '<text x="72" y="126" fill="#f5f8ff" font-family="ui-sans-serif,system-ui" font-size="38" font-weight="750">How access crosses the role boundary</text>',
    '<text x="72" y="164" fill="#9fb2ca" font-family="ui-sans-serif,system-ui" font-size="18">Solid = inheritance · dashed = assumption · coral = role on a violated witness</text>',
  ];

  for (const role of policy.roles) {
    const from = positions.get(role.id);
    for (const target of role.inherits) {
      const to = positions.get(target);
      lines.push(
        '<path d="M ' +
          (from.x + 88) +
          " " +
          from.y +
          " C " +
          (from.x + 132) +
          " " +
          from.y +
          ", " +
          (to.x - 132) +
          " " +
          to.y +
          ", " +
          (to.x - 88) +
          " " +
          to.y +
          '" fill="none" stroke="#4ee1c1" stroke-width="3" opacity=".72" marker-end="url(#arrow-teal)"/>',
      );
    }
    for (const target of role.can_assume) {
      const to = positions.get(target);
      lines.push(
        '<path d="M ' +
          (from.x + 88) +
          " " +
          (from.y + 9) +
          " C " +
          (from.x + 136) +
          " " +
          (from.y + 9) +
          ", " +
          (to.x - 136) +
          " " +
          (to.y + 9) +
          ", " +
          (to.x - 88) +
          " " +
          (to.y + 9) +
          '" fill="none" stroke="#ffbb66" stroke-width="3" stroke-dasharray="9 8" opacity=".86" marker-end="url(#arrow-amber)"/>',
      );
    }
  }

  for (const role of policy.roles) {
    const position = positions.get(role.id);
    const violated = violationRoles.has(role.id);
    const assigned = assignedRoles.has(role.id);
    lines.push(
      '<g data-role-id="' +
        escapeXml(role.id) +
        '" transform="translate(' +
        (position.x - 88) +
        " " +
        (position.y - 34) +
        ')" filter="url(#shadow)">',
      '<rect width="176" height="68" rx="15" fill="' +
        (violated ? "#321b2b" : "#0d2135") +
        '" stroke="' +
        (violated ? "#ff718c" : assigned ? "#62b5ff" : "#345372") +
        '" stroke-width="' +
        (assigned ? "3" : "2") +
        '"/>',
      '<text x="88" y="31" text-anchor="middle" fill="#f5f8ff" font-family="ui-monospace,monospace" font-size="14" font-weight="700">' +
        escapeXml(role.id) +
        "</text>",
      '<text x="88" y="51" text-anchor="middle" fill="' +
        (violated ? "#ff9caf" : "#8ea5bf") +
        '" font-family="ui-sans-serif,system-ui" font-size="11">' +
        (assigned ? "assigned entry" : violated ? "violation path" : "reachable role") +
        "</text>",
      "</g>",
    );
  }

  lines.push(
    '<rect x="72" y="744" width="1256" height="1" fill="#28425e"/>',
    '<text x="72" y="782" fill="#8298b3" font-family="ui-monospace,monospace" font-size="13">policy ' +
      escapeXml(receipt.policy_sha256.slice(0, 16)) +
      " · result " +
      escapeXml(receipt.result_sha256.slice(0, 16)) +
      " · " +
      policy.roles.length +
      " roles · " +
      receipt.result.summary.violations +
      " violations</text>",
    "</svg>",
    "",
  );
  return Buffer.from(lines.join("\n"), "utf8");
}
