import { ExpressionError } from "./errors.js";

export type TokenType = "name" | "string" | "number" | "punct" | "eof";

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

const PUNCTUATION = new Set([
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ",",
  ".",
  ":",
  "?",
  "+",
  "!",
  "<",
  ">",
]);

function isNameStart(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z_$]/.test(char);
}

function isNameChar(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_$-]/.test(char);
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

/**
 * Decodes the XML entities Blogger authors use inside attribute values so that
 * `&quot;` becomes a real quote before tokenizing. Numeric character references
 * are supported too.
 */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isNaN(code) ? whole : safeCodePoint(code, whole);
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isNaN(code) ? whole : safeCodePoint(code, whole);
    }
    switch (body) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default:
        return whole;
    }
  });
}

function safeCodePoint(code: number, fallback: string): string {
  if (code < 0 || code > 0x10ffff) return fallback;
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index] as string;

    if (char === " " || char === "\t" || char === "\n" || char === "\r") {
      index++;
      continue;
    }

    if (char === '"' || char === "'") {
      const start = index;
      index++;
      let value = "";
      let closed = false;
      while (index < input.length) {
        const current = input[index] as string;
        if (current === "\\" && index + 1 < input.length) {
          value += input[index + 1] as string;
          index += 2;
          continue;
        }
        if (current === char) {
          index++;
          closed = true;
          break;
        }
        value += current;
        index++;
      }
      if (!closed) {
        throw new ExpressionError(
          "BLOGGER_PREVIEW_UNSUPPORTED_EXPRESSION",
          "unterminated string literal",
          start,
          input.length
        );
      }
      tokens.push({ type: "string", value, start, end: index });
      continue;
    }

    if (isDigit(char)) {
      const start = index;
      while (index < input.length && /[0-9]/.test(input[index] as string)) index++;
      if (input[index] === "." && isDigit(input[index + 1])) {
        index++;
        while (index < input.length && /[0-9]/.test(input[index] as string)) index++;
      }
      const raw = input.slice(start, index);
      tokens.push({ type: "number", value: raw, start, end: index });
      continue;
    }

    if (isNameStart(char)) {
      const start = index;
      index++;
      while (index < input.length && isNameChar(input[index])) index++;
      // `data:` is the only prefix Blogger uses inside expressions. Folding the
      // colon into the name keeps `{ length: 5 }` a map literal instead of a
      // name with a trailing colon.
      if (input.slice(start, index) === "data" && input[index] === ":") {
        index++;
        while (index < input.length && isNameChar(input[index])) index++;
      }
      tokens.push({ type: "name", value: input.slice(start, index), start, end: index });
      continue;
    }

    // Multi-character punctuation before the single-character set.
    const pair = input.slice(index, index + 2);
    if (pair === "=>" || pair === "?:" || pair === "==" || pair === "!=" || pair === "<=" || pair === ">=") {
      tokens.push({ type: "punct", value: pair, start: index, end: index + 2 });
      index += 2;
      continue;
    }

    if (PUNCTUATION.has(char)) {
      tokens.push({ type: "punct", value: char, start: index, end: index + 1 });
      index++;
      continue;
    }

    throw new ExpressionError(
      "BLOGGER_PREVIEW_UNSUPPORTED_EXPRESSION",
      `unexpected character "${char}" in expression`,
      index,
      index + 1
    );
  }

  tokens.push({ type: "eof", value: "", start: index, end: index });
  return tokens;
}
