import { createServer } from "node:http";
import { lstat, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DEFAULT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
);
const EXPECTED = [
  "app.js",
  "data/analysis.receipt.json",
  "data/manifest.json",
  "data/policy.normalized.json",
  "data/role-graph.svg",
  "data/site.manifest.json",
  "data/verification.json",
  "index.html",
  "styles.css",
];
const MIME = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
]);
const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

async function inventory(directory, prefix = "") {
  const names = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      names.push(...(await inventory(path.join(directory, entry.name), relative)));
    } else if (entry.isFile() && !entry.isSymbolicLink()) {
      names.push(relative);
    } else {
      throw new Error("invalid_asset_inventory");
    }
  }
  return names.sort();
}

export async function loadAssets(root = DEFAULT_ROOT) {
  const names = await inventory(root);
  if (names.join("\n") !== EXPECTED.join("\n")) {
    throw new Error("invalid_asset_inventory");
  }
  const assets = new Map();
  for (const name of names) {
    const filePath = path.join(root, name);
    const status = await lstat(filePath);
    if (!status.isFile() || status.isSymbolicLink() || status.size > 1024 * 1024) {
      throw new Error("invalid_asset");
    }
    const payload = await readFile(filePath);
    const route = name === "index.html" ? "/" : "/" + name;
    assets.set(route, {
      contentType: MIME.get(path.extname(name)),
      payload,
    });
  }
  return assets;
}

function hostHeaderCount(rawHeaders) {
  let count = 0;
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index].toLowerCase() === "host") count += 1;
  }
  return count;
}

function respond(response, status, message, extra = {}) {
  const payload = Buffer.from(message, "utf8");
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Length": payload.byteLength,
    "Content-Type": "text/plain; charset=utf-8",
    ...extra,
  });
  response.end(payload);
}

export async function startServer(options = {}) {
  const requestedPort = options.port ?? 4173;
  if (
    !Number.isInteger(requestedPort) ||
    requestedPort < 0 ||
    requestedPort > 65535
  ) {
    throw new TypeError("invalid_port");
  }
  const assets = await loadAssets(options.root ?? DEFAULT_ROOT);
  let allowedHosts = new Set();

  const server = createServer({ maxHeaderSize: 8192 }, (request, response) => {
    if (hostHeaderCount(request.rawHeaders) !== 1) {
      respond(response, 400, "bad request\n");
      return;
    }
    if (!allowedHosts.has(request.headers.host)) {
      respond(response, 421, "misdirected request\n");
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      respond(response, 405, "method not allowed\n", { Allow: "GET, HEAD" });
      return;
    }
    const target = request.url;
    if (
      typeof target !== "string" ||
      target.includes("?") ||
      target.includes("#") ||
      target.includes("%") ||
      target.includes("\\") ||
      target.includes("\u0000") ||
      request.headers["transfer-encoding"] !== undefined ||
      Number(request.headers["content-length"] ?? 0) !== 0
    ) {
      respond(response, 400, "bad request\n");
      return;
    }
    const asset = assets.get(target);
    if (asset === undefined) {
      respond(response, 404, "not found\n");
      return;
    }
    response.writeHead(200, {
      ...SECURITY_HEADERS,
      "Content-Length": asset.payload.byteLength,
      "Content-Type": asset.contentType,
    });
    response.end(request.method === "HEAD" ? undefined : asset.payload);
  });

  server.requestTimeout = 5_000;
  server.headersTimeout = 3_000;
  server.keepAliveTimeout = 1_000;
  server.maxRequestsPerSocket = 100;

  await new Promise((resolve, reject) => {
    const failed = (error) => {
      server.off("listening", ready);
      reject(error);
    };
    const ready = () => {
      server.off("error", failed);
      resolve();
    };
    server.once("error", failed);
    server.once("listening", ready);
    server.listen(requestedPort, "127.0.0.1");
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("invalid_listen_address");
  }
  const port = address.port;
  allowedHosts = new Set([
    "127.0.0.1:" + port,
    "localhost:" + port,
    "[::1]:" + port,
  ]);
  return {
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    origin: "http://127.0.0.1:" + port,
    port,
    server,
  };
}

export async function runServerUntilSignal(options = {}) {
  const running = await startServer(options);
  process.stdout.write("RoleProof dashboard " + running.origin + "\n");
  await new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  await running.close();
}
