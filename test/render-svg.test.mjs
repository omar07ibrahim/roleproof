import assert from "node:assert/strict";
import test from "node:test";

import { analyzePolicy } from "../src/analyze.mjs";
import { readPolicyFile } from "../src/contracts.mjs";
import { renderRoleGraph } from "../src/render-svg.mjs";

test("the source-derived role graph is deterministic and complete", async () => {
  const policy = await readPolicyFile("examples/orion.synthetic.json");
  const receipt = analyzePolicy(policy);
  const first = renderRoleGraph(policy, receipt);
  const second = renderRoleGraph(policy, receipt);
  assert.deepEqual(first, second);
  const svg = first.toString("utf8");
  assert.match(svg, /^<\?xml version="1.0"/);
  assert.match(svg, /viewBox="0 0 1400 820"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /data-role-id="prod-admin"/);
  for (const role of policy.roles) {
    assert.match(svg, new RegExp('data-role-id="' + role.id + '"'));
  }
  assert.equal((svg.match(/data-role-id=/g) ?? []).length, policy.roles.length);
  assert.equal(svg.includes("<script"), false);
  assert.equal(svg.includes("<foreignObject"), false);
  const namespace = "http://www.w3.org/2000/svg";
  assert.equal((svg.match(/http:\/\//g) ?? []).length, 1);
  assert.equal(svg.includes(namespace), true);
  assert.equal(svg.replace(namespace, "").includes("http://"), false);
  assert.equal(svg.includes("https://"), false);
  assert.equal(svg.includes(" href="), false);
  assert.equal(svg.includes("/home/"), false);
});

test("XML-sensitive identifiers and titles never enter markup unescaped", async () => {
  const policy = await readPolicyFile("examples/orion.synthetic.json");
  const receipt = analyzePolicy(policy);
  const svg = renderRoleGraph(
    { ...policy, title: "Synthetic <unsafe> & review" },
    receipt,
  ).toString("utf8");
  assert.equal(svg.includes("<unsafe>"), false);
});
