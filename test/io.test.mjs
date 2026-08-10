import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { IoBoundaryError, readStrictJsonFile } from "../src/io.mjs";

test("strict JSON reads stay descriptor-bound and reject symbolic links", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "roleproof-io-"));
  try {
    const target = path.join(directory, "receipt.json");
    const link = path.join(directory, "receipt-link.json");
    await writeFile(target, "{\"status\":\"verified\"}\n", { mode: 0o600 });
    await symlink(target, link);

    await assert.rejects(
      () => readStrictJsonFile(link),
      (error) =>
        error instanceof IoBoundaryError &&
        error.code === "invalid_input_file",
    );
    const document = await readStrictJsonFile(target);
    assert.equal(document.status, "verified");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
