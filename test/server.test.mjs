import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import http from "node:http";
import test from "node:test";

import { startServer } from "../src/server.mjs";

function rawRequest(port, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        method: options.method ?? "GET",
        path: options.path ?? "/",
        port,
        headers: options.headers,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers,
            status: response.statusCode,
          }),
        );
      },
    );
    request.on("error", reject);
    request.end(options.body);
  });
}

test("the dashboard server is loopback-only and fail-closed", async () => {
  execFileSync(process.execPath, ["tools/build-site.mjs"]);
  const running = await startServer({ port: 0 });
  try {
    const root = await fetch(running.origin + "/");
    assert.equal(root.status, 200);
    assert.match(await root.text(), /Trace the permission/);
    assert.match(
      root.headers.get("content-security-policy"),
      /default-src 'none'/,
    );
    assert.equal(root.headers.get("x-frame-options"), "DENY");

    const receipt = await fetch(
      running.origin + "/data/analysis.receipt.json",
    );
    assert.equal(receipt.status, 200);
    assert.equal((await receipt.json()).result.summary.violations, 4);

    const head = await fetch(running.origin + "/", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");

    const query = await fetch(running.origin + "/?debug=true");
    assert.equal(query.status, 400);
    const encoded = await rawRequest(running.port, { path: "/%2e%2e/" });
    assert.equal(encoded.status, 400);
    const missing = await fetch(running.origin + "/missing");
    assert.equal(missing.status, 404);
    const posted = await fetch(running.origin + "/", { method: "POST" });
    assert.equal(posted.status, 405);
    assert.equal(posted.headers.get("allow"), "GET, HEAD");

    const hostile = await rawRequest(running.port, {
      headers: { Host: "evil.example" },
    });
    assert.equal(hostile.status, 421);
  } finally {
    await running.close();
  }
});

test("CLI rejects privileged, malformed, and oversized ports", () => {
  for (const value of ["0", "80", "3.5", "65536", "not-a-port"]) {
    const result = (await import("node:child_process")).spawnSync(
      process.execPath,
      ["src/cli.mjs", "serve", "--port", value],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 64, value);
    assert.equal(result.stderr, "roleproof: invalid_arguments\n");
  }
});
