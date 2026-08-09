import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("the built site is a closed, non-executable boundary", async () => {
  assert.deepEqual((await readdir("dist")).sort(), ["index.html", "styles.css"]);
  const html = await readFile("dist/index.html", "utf8");
  assert.match(html, /Legacy runtime retired/);
  assert.match(html, /RoleProof/);
  for (const forbidden of [
    "/api/init-db",
    "NEXTAUTH_SECRET",
    "DATABASE_URL",
    "admin@",
    "password",
    "<script",
    "http://",
    "https://",
  ]) {
    assert.equal(html.includes(forbidden), false, forbidden);
  }
});

test("Vercel publishes only the reviewed static output", async () => {
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.equal(config.framework, null);
  assert.equal(config.buildCommand, "npm run build");
  assert.equal(config.outputDirectory, "dist");
  assert.equal(config.headers.length, 1);
  const names = config.headers[0].headers.map((entry) => entry.key).sort();
  assert.deepEqual(names, [
    "Content-Security-Policy",
    "Permissions-Policy",
    "Referrer-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
  ]);
});
