import type { ExprNode } from "./ast.js";
import { ExpressionError } from "./errors.js";
import { decodeEntities, tokenize, type Token } from "./tokenizer.js";

const BINARY_PRECEDENCE: Record<string, number> = {
  or: 1,
  and: 2,
  "==": 3,
  "!=": 3,
  "<": 3,
  ">": 3,
  "<=": 3,
  ">=": 3,
  in: 3,
  "not in": 3,
  contains: 3,
  "+": 4,
};

const RESERVED = new Set(["and", "or", "not", "in", "contains", "true", "false", "null"]);

class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ExprNode {
    if (this.peek().type === "eof") {
      throw new ExpressionError(
        "BLOGGER_PREVIEW_UNSUPPORTED_EXPRESSION",
        "empty expression",
        0,
        0
      );
    }
    const expression = this.parseTernary();
    const trailing = this.peek();
    if (trailing.type !== "eof") {
      throw new ExpressionError(
        "BLOGGER_PREVIEW_UNSUPPORTED_EXPRESSION",
        `unexpected "${trailing.value}" after expression`,
        trailing.start,
        trailing.end
      );
    }
    return expression;
  }

  private peek(offset = 0): Token {
    return this.tokens[this.index + offset] ?? this.tokens[this.tokens.length - 1]!;
  }

  private next(): Token {
    const token = this.peek();
    if (token.type !== "eof") this.index++;
    return token;
  }

  private isPunct(value: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.type === "punct" && token.value === value;
  }

  private isName(value: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.type === "name" && token.value === value;
  }

  private expectPunct(value: string): Token {
    const token = this.peek();
    if (token.type !== "punct" || token.value !== value) {
      throw new ExpressionError(
        "BLOGGER_PREVIEW_UNSUPPORTED_EXPRESSION",
        `expected "${value}" but found "${token.value || token.type}"`,
        token.start,
        token.end
      );
    }
    return this.next();
  }

  private parseTernary(): ExprNode {
    const test = this.parseBinary(1);
    if (this.isPunct("?:")) {
      const token = this.next();
      const right = this.parseTernary();
      return { kind: "coalesce", left: test, right, start: test.start, end: right.end };
    }
    if (this.isPunct("?")) {
      this.next();
      const consequent = this.parseTernary();
      this.expectPunct(":");
      const alternate = this.parseTernary();
      return {
        kind: "conditional",
        test,
        consequent,
        alternate,
        start: test.start,
        end: alternate.end,
      };
    }
    return test;
  }

  private parseBinary(minPrecedence: number): ExprNode {
    let left = this.parseUnary();
    while (true) {
      const operator = this.peekBinaryOperator();
      if (operator === undefined) break;
      const precedence = BINARY_PRECEDENCE[operator.name] ?? 0;
      if (precedence < minPrecedence) break;
      for (let consumed = 0; consumed < operator.tokens; consumed++) this.next();
      const right = this.parseBinary(precedence + 1);
      left = {
        kind: "binary",
        operator: operator.name as never,
        left,
        right,
        start: left.start,
        end: right.end,
      };
    }
    return left;
  }

  private peekBinaryOperator(): { name: string; tokens: number } | undefined {
    const token = this.peek();
    if (token.type === "punct" && BINARY_PRECEDENCE[token.value] !== undefined) {
      return { name: token.value, tokens: 1 };
    }
    if (token.type === "name") {
      if (
        token.value === "and" ||
        token.value === "or" ||
        token.value === "in" ||
        token.value === "contains"
      ) {
        return { name: token.value, tokens: 1 };
      }
      if (token.value === "not" && this.isName("in", 1)) {
        return { name: "not in", tokens: 2 };
      }
    }
    return undefined;
  }

  private parseUnary(): ExprNode {
    const token = this.peek();
    if ((token.type === "name" && token.value === "not") || (token.type === "punct" && token.value === "!")) {
      this.next();
      const argument = this.parseUnary();
      return {
        kind: "unary",
        operator: token.value === "!" ? "!" : "not",
        argument,
        start: token.start,
        end: argument.end,
      };
    }
    return this.parseApplication();
  }

  private parseApplication(): ExprNode {
    let value = this.parsePostfix();
    while (true) {
      const token = this.peek();
      if (token.type !== "name" || RESERVED.has(token.value)) break;
      this.next();
      const argument = this.parseArgument();
      value = {
        kind: "call",
        callee: value,
        name: token.value,
        args: argument === undefined ? [] : [argument],
        start: value.start,
        end: argument === undefined ? token.end : argument.end,
      };
    }
    return value;
  }

  private parseArgument(): ExprNode | undefined {
    const token = this.peek();
    if (token.type === "string" || token.type === "number") return this.parsePrimary();
    if (token.type === "name") {
      if (token.value === "true" || token.value === "false" || token.value === "null") {
        return this.parsePrimary();
      }
      if (this.isPunct("=>", 1)) return this.parsePrimary();
      return this.parsePostfix();
    }
    if (token.type === "punct" && (token.value === "(" || token.value === "[" || token.value === "{")) {
      return this.parsePrimary();
    }
    return undefined;
  }

  private parsePostfix(): ExprNode {
    let value = this.parsePrimary();
    while (true) {
      if (this.isPunct(".")) {
        this.next();
        const name = this.peek();
        if (name.type !== "name") {
          throw new ExpressionError(
            "BLOGGER_PREVIEW_UNSUPPORTED_EXPRESSION",
            "expected a property name after \".\"",
            name.start,
            name.end
          );
        }
        this.next();
        value = { kind: "member", object: value, property: name.value, start: value.start, end: name.end };
        continue;
      }
      if (this.isPunct("[")) {
        this.next();
        const index = this.parseTernary();
        const close = this.expectPunct("]");
        value = { kind: "index", object: value, index, start: value.start, end: close.end };
        continue;
      }
      break;
    }
    return value;
  }

  private parsePrimary(): ExprNode {
    const token = this.peek();

    if (token.type === "string") {
      this.next();
      return { kind: "literal", value: token.value, start: token.start, end: token.end };
    }

    if (token.type === "number") {
      this.next();
      return { kind: "literal", value: Number(token.value), start: token.start, end: token.end };
    }

    if (token.type === "name") {
      if (token.value === "true" || token.value === "false") {
        this.next();
        return { kind: "literal", value: token.value === "true", start: token.start, end: token.end };
      }
      if (token.value === "null") {
        this.next();
        return { kind: "literal", value: null, start: token.start, end: token.end };
      }
      if (this.isPunct("=>", 1)) {
        this.next();
        this.next();
        const body = this.parseTernary();
        return { kind: "lambda", params: [token.value], body, start: token.start, end: body.end };
      }
      this.next();
      if (this.isPunct("(")) {
        const args = this.parseCallArguments();
        const last = args[args.length - 1];
        return {
          kind: "call",
          callee: { kind: "reference", name: token.value, start: token.start, end: token.end },
          name: token.value,
          args,
          start: token.start,
          end: last === undefined ? token.end : last.end,
        };
      }
      return { kind: "reference", name: token.value, start: token.start, end: token.end };
    }

    if (token.type === "punct") {
      if (token.value === "(") return this.parseParenOrLambda();
      if (token.value === "[") return this.parseArray();
      if (token.value === "{") return this.parseMapOrSet();
    }

    throw new ExpressionError(
      "BLOGGER_PREVIEW_UNSUPPORTED_EXPRESSION",
      `unexpected "${token.value || token.type}" in expression`,
      token.start,
      token.end
    );
  }

  private parseCallArguments(): ExprNode[] {
    this.expectPunct("(");
    const args: ExprNode[] = [];
    if (this.isPunct(")")) {
      this.next();
      return args;
    }
    while (true) {
      args.push(this.parseTernary());
      if (this.isPunct(",")) {
        this.next();
        continue;
      }
      break;
    }
    this.expectPunct(")");
    return args;
  }

  private parseParenOrLambda(): ExprNode {
    const open = this.expectPunct("(");
    const params = this.tryLambdaParams();
    if (params !== undefined) {
      this.expectPunct("=>");
      const body = this.parseTernary();
      return { kind: "lambda", params, body, start: open.start, end: body.end };
    }
    const expression = this.parseTernary();
    this.expectPunct(")");
    return expression;
  }

  /** Consumes `)` and returns the parameter names when a lambda follows. */
  private tryLambdaParams(): string[] | undefined {
    const save = this.index;
    const params: string[] = [];
    if (this.isPunct(")")) {
      // zero parameters
    } else {
      while (true) {
        const token = this.peek();
        if (token.type !== "name") {
          this.index = save;
          return undefined;
        }
        params.push(token.value);
        this.next();
        if (this.isPunct(",")) {
          this.next();
          continue;
        }
        break;
      }
      if (!this.isPunct(")")) {
        this.index = save;
        return undefined;
      }
    }
    if (this.isPunct("=>", 1)) {
      this.next();
      return params;
    }
    this.index = save;
    return undefined;
  }

  private parseArray(): ExprNode {
    const open = this.expectPunct("[");
    const elements: ExprNode[] = [];
    if (this.isPunct("]")) {
      const close = this.next();
      return { kind: "array", elements, start: open.start, end: close.end };
    }
    while (true) {
      elements.push(this.parseTernary());
      if (this.isPunct(",")) {
        this.next();
        if (this.isPunct("]")) break;
        continue;
      }
      break;
    }
    const close = this.expectPunct("]");
    return { kind: "array", elements, start: open.start, end: close.end };
  }

  private parseMapOrSet(): ExprNode {
    const open = this.expectPunct("{");
    if (this.isPunct("}")) {
      const close = this.next();
      return { kind: "map", entries: [], start: open.start, end: close.end };
    }

    const entries: { key: string; value: ExprNode }[] = [];
    const elements: ExprNode[] = [];
    let mode: "map" | "set" | undefined;

    while (true) {
      const token = this.peek();
      const isKey =
        (token.type === "name" || token.type === "string") && this.isPunct(":", 1);
      if (isKey) {
        if (mode === "set") {
          throw new ExpressionError(
            "BLOGGER_PREVIEW_UNSUPPORTED_EXPRESSION",
            "a literal cannot mix map entries and set elements",
            token.start,
            token.end
          );
        }
        mode = "map";
        this.next();
        this.next();
        entries.push({ key: token.value, value: this.parseTernary() });
      } else {
        if (mode === "map") {
          throw new ExpressionError(
            "BLOGGER_PREVIEW_UNSUPPORTED_EXPRESSION",
            "a literal cannot mix map entries and set elements",
            token.start,
            token.end
          );
        }
        mode = "set";
        elements.push(this.parseTernary());
      }
      if (this.isPunct(",")) {
        this.next();
        if (this.isPunct("}")) break;
        continue;
      }
      break;
    }

    const close = this.expectPunct("}");
    if (mode === "set") {
      return { kind: "set", elements, start: open.start, end: close.end };
    }
    return { kind: "map", entries, start: open.start, end: close.end };
  }
}

export function parseExpression(input: string): ExprNode {
  const decoded = decodeEntities(input);
  return new Parser(tokenize(decoded)).parse();
}
