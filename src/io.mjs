import { constants } from "node:fs";
import { lstat, mkdir, open, rm } from "node:fs/promises";
import path from "node:path";

import { parseJsonStrict, StrictJsonError } from "./json.mjs";

export const MAX_RECEIPT_BYTES = 512 * 1024;

export class IoBoundaryError extends Error {
  constructor(code) {
    super(code);
    this.name = "IoBoundaryError";
    this.code = code;
  }
}

function sameFile(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

export async function readStrictJsonFile(filePath, maximum = MAX_RECEIPT_BYTES) {
  let visible;
  try {
    visible = await lstat(filePath, { bigint: true });
  } catch {
    throw new IoBoundaryError("unreadable_input");
  }
  if (
    !visible.isFile() ||
    visible.isSymbolicLink() ||
    visible.size < 1 ||
    visible.size > maximum
  ) {
    throw new IoBoundaryError("invalid_input_file");
  }
  const flags =
    constants.O_RDONLY |
    (constants.O_CLOEXEC ?? 0) |
    (constants.O_NOFOLLOW ?? 0);
  let handle;
  try {
    handle = await open(filePath, flags);
    const opened = await handle.stat({ bigint: true });
    if (!sameFile(visible, opened)) throw new IoBoundaryError("input_changed");
    const payload = await handle.readFile();
    const completed = await handle.stat({ bigint: true });
    const final = await lstat(filePath, { bigint: true });
    if (!sameFile(opened, completed) || !sameFile(opened, final)) {
      throw new IoBoundaryError("input_changed");
    }
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
    } catch {
      throw new IoBoundaryError("invalid_input_encoding");
    }
    try {
      return parseJsonStrict(text, { maxDepth: 48, maxTokens: 100_000 });
    } catch (error) {
      if (error instanceof StrictJsonError) {
        throw new IoBoundaryError("invalid_input_json");
      }
      throw error;
    }
  } finally {
    if (handle !== undefined) await handle.close();
  }
}

async function writeNewFile(filePath, payload) {
  const flags =
    constants.O_WRONLY |
    constants.O_CREAT |
    constants.O_EXCL |
    (constants.O_CLOEXEC ?? 0) |
    (constants.O_NOFOLLOW ?? 0);
  const handle = await open(filePath, flags, 0o600);
  try {
    await handle.writeFile(payload);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeNewBundleDirectory(directory, bundle) {
  if (!(bundle instanceof Map) || bundle.size < 1) {
    throw new TypeError("bundle must be a non-empty Map");
  }
  const names = [...bundle.keys()].sort();
  if (
    names.some(
      (name) =>
        !/^[a-z][a-z0-9.-]{0,63}$/.test(name) ||
        path.basename(name) !== name,
    )
  ) {
    throw new TypeError("invalid bundle name");
  }

  let created = false;
  try {
    await mkdir(directory, { mode: 0o700, recursive: false });
    created = true;
    for (const name of names) {
      const payload = bundle.get(name);
      if (!Buffer.isBuffer(payload)) throw new TypeError("invalid bundle payload");
      await writeNewFile(path.join(directory, name), payload);
    }
    const flags =
      constants.O_RDONLY |
      (constants.O_DIRECTORY ?? 0) |
      (constants.O_CLOEXEC ?? 0);
    const handle = await open(directory, flags);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (created) {
      await rm(directory, { force: true, recursive: true });
    }
    if (error?.code === "EEXIST") {
      throw new IoBoundaryError("output_exists");
    }
    if (error instanceof IoBoundaryError) throw error;
    throw new IoBoundaryError("output_failed");
  }
}
