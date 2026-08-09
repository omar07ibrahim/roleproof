import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, "web");
const destination = path.join(root, "dist");
const expected = ["index.html", "styles.css"];

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: false, mode: 0o755 });

const entries = await readdir(source, { withFileTypes: true });
const names = entries.map((entry) => entry.name).sort();
if (
  names.length !== expected.length ||
  names.some((name, index) => name !== expected[index]) ||
  entries.some((entry) => !entry.isFile() || entry.isSymbolicLink())
) {
  throw new Error("unexpected static source inventory");
}
for (const name of expected) {
  await copyFile(path.join(source, name), path.join(destination, name));
}
console.log("containment site: PASS (2 reviewed static files)");
