import { createHash } from "node:crypto";

function encode(value, stack) {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite number");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError("value is not canonical JSON");
  }
  if (stack.has(value)) throw new TypeError("cyclic value");
  stack.add(value);
  try {
    if (Array.isArray(value)) {
      return "[" + value.map((item) => encode(item, stack)).join(",") + "]";
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("non-plain object");
    }
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + encode(value[key], stack))
        .join(",") +
      "}"
    );
  } finally {
    stack.delete(value);
  }
}

export function canonicalStringify(value) {
  return encode(value, new Set());
}

export function canonicalBytes(value) {
  return Buffer.from(canonicalStringify(value), "utf8");
}

export function sha256Hex(value) {
  const payload = Buffer.isBuffer(value) ? value : canonicalBytes(value);
  return createHash("sha256").update(payload).digest("hex");
}
