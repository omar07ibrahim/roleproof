export class StrictJsonError extends Error {
  constructor(code, offset) {
    super(code);
    this.name = "StrictJsonError";
    this.code = code;
    this.offset = offset;
  }
}

export function parseJsonStrict(text, options = {}) {
  if (typeof text !== "string") throw new TypeError("text must be a string");
  const maxDepth = options.maxDepth ?? 24;
  const maxTokens = options.maxTokens ?? 20_000;
  let offset = 0;
  let tokens = 0;

  const fail = (code) => {
    throw new StrictJsonError(code, offset);
  };
  const bump = () => {
    tokens += 1;
    if (tokens > maxTokens) fail("too_many_tokens");
  };
  const whitespace = () => {
    while (
      text[offset] === " " ||
      text[offset] === "\n" ||
      text[offset] === "\r" ||
      text[offset] === "\t"
    ) {
      offset += 1;
    }
  };

  const string = () => {
    bump();
    if (text[offset] !== '"') fail("expected_string");
    const start = offset;
    offset += 1;
    while (offset < text.length) {
      const character = text[offset];
      if (character === '"') {
        offset += 1;
        try {
          return JSON.parse(text.slice(start, offset));
        } catch {
          fail("invalid_string");
        }
      }
      if (character.charCodeAt(0) < 0x20) fail("invalid_string");
      if (character === "\\") {
        offset += 1;
        if (offset >= text.length) fail("invalid_escape");
        const escape = text[offset];
        if (escape === "u") {
          const digits = text.slice(offset + 1, offset + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(digits)) fail("invalid_escape");
          offset += 5;
          continue;
        }
        if (!'"\\/bfnrt'.includes(escape)) fail("invalid_escape");
      }
      offset += 1;
    }
    fail("unterminated_string");
  };

  const number = () => {
    bump();
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(
      text.slice(offset),
    );
    if (!match) fail("invalid_number");
    offset += match[0].length;
    const parsed = Number(match[0]);
    if (!Number.isFinite(parsed)) fail("invalid_number");
    return parsed;
  };

  const value = (depth) => {
    if (depth > maxDepth) fail("too_deep");
    whitespace();
    const character = text[offset];
    if (character === '"') return string();
    if (character === "-" || (character >= "0" && character <= "9")) {
      return number();
    }
    if (text.startsWith("true", offset)) {
      bump();
      offset += 4;
      return true;
    }
    if (text.startsWith("false", offset)) {
      bump();
      offset += 5;
      return false;
    }
    if (text.startsWith("null", offset)) {
      bump();
      offset += 4;
      return null;
    }
    if (character === "[") {
      bump();
      offset += 1;
      const result = [];
      whitespace();
      if (text[offset] === "]") {
        offset += 1;
        return result;
      }
      while (true) {
        result.push(value(depth + 1));
        whitespace();
        if (text[offset] === "]") {
          offset += 1;
          return result;
        }
        if (text[offset] !== ",") fail("expected_comma");
        offset += 1;
      }
    }
    if (character === "{") {
      bump();
      offset += 1;
      const result = Object.create(null);
      const keys = new Set();
      whitespace();
      if (text[offset] === "}") {
        offset += 1;
        return result;
      }
      while (true) {
        whitespace();
        const key = string();
        if (keys.has(key)) fail("duplicate_key");
        keys.add(key);
        whitespace();
        if (text[offset] !== ":") fail("expected_colon");
        offset += 1;
        Object.defineProperty(result, key, {
          configurable: true,
          enumerable: true,
          value: value(depth + 1),
          writable: true,
        });
        whitespace();
        if (text[offset] === "}") {
          offset += 1;
          return result;
        }
        if (text[offset] !== ",") fail("expected_comma");
        offset += 1;
      }
    }
    fail("unexpected_token");
  };

  const result = value(0);
  whitespace();
  if (offset !== text.length) fail("trailing_content");
  return result;
}
