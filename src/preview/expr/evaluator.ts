import type { BinaryOperator, ExprNode } from "./ast.js";
import { ExpressionError } from "./errors.js";
import { callFunction, type HelperContext } from "./functions.js";
import {
  BloggerDate,
  HtmlString,
  getMember,
  isInvokable,
  isMap,
  isTruthy,
  toNumber,
  toText,
  type Invokable,
  type Value,
  type ValueMap,
} from "../values.js";

export interface EvalHost {
  report(code: string, message: string, start: number, end: number): void;
}

export interface EvalLimits {
  maxDepth: number;
  maxSteps: number;
}

const DEFAULT_LIMITS: EvalLimits = { maxDepth: 64, maxSteps: 200000 };

/** A lexical scope. Bound variables are reached as `data:name` or bare `name`. */
export class Scope {
  private readonly bindings: Map<string, Value>;
  private readonly parent?: Scope;

  constructor(bindings: Map<string, Value> = new Map(), parent?: Scope) {
    this.bindings = bindings;
    this.parent = parent;
  }

  static root(values: ValueMap): Scope {
    return new Scope(new Map(Object.entries(values)));
  }

  child(values: ValueMap): Scope {
    return new Scope(new Map(Object.entries(values)), this);
  }

  withBinding(name: string, value: Value): Scope {
    return new Scope(new Map([[name, value]]), this);
  }

  get(name: string): Value | undefined {
    if (this.bindings.has(name)) return this.bindings.get(name);
    return this.parent?.get(name);
  }

  has(name: string): boolean {
    return this.bindings.has(name) || this.parent?.has(name) === true;
  }
}

class Closure implements Invokable {
  private readonly params: string[];
  private readonly body: ExprNode;
  private readonly scope: Scope;
  private readonly evaluator: Evaluator;

  constructor(params: string[], body: ExprNode, scope: Scope, evaluator: Evaluator) {
    this.params = params;
    this.body = body;
    this.scope = scope;
    this.evaluator = evaluator;
  }

  invoke(args: Value[]): Value {
    const bindings = new Map<string, Value>();
    this.params.forEach((param, index) => bindings.set(param, args[index] ?? null));
    return this.evaluator.evaluate(this.body, new Scope(bindings, this.scope));
  }
}

export class Evaluator {
  private readonly rootData: ValueMap;
  private readonly host: EvalHost;
  private readonly limits: EvalLimits;
  private steps = 0;
  private depth = 0;
  private readonly helperContext: HelperContext;

  constructor(rootData: ValueMap, host: EvalHost, limits: EvalLimits = DEFAULT_LIMITS) {
    this.rootData = rootData;
    this.host = host;
    this.limits = limits;
    this.helperContext = {
      invoke: (callable, args) => this.invoke(callable, args),
      report: (code, message) =>
        this.host.report(code, message, 0, 0),
    };
  }

  evaluate(node: ExprNode, scope: Scope): Value {
    if (++this.steps > this.limits.maxSteps) {
      throw new ExpressionError(
        "BLOGGER_PREVIEW_LIMIT",
        "expression evaluation exceeded the step limit",
        node.start,
        node.end
      );
    }
    if (++this.depth > this.limits.maxDepth) {
      this.depth--;
      throw new ExpressionError(
        "BLOGGER_PREVIEW_LIMIT",
        "expression evaluation exceeded the depth limit",
        node.start,
        node.end
      );
    }
    try {
      return this.evaluateInner(node, scope);
    } finally {
      this.depth--;
    }
  }

  private evaluateInner(node: ExprNode, scope: Scope): Value {
    switch (node.kind) {
      case "literal":
        return node.value;
      case "reference":
        return this.resolveReference(node.name, scope);
      case "member":
        return getMember(this.evaluate(node.object, scope), node.property);
      case "index": {
        const object = this.evaluate(node.object, scope);
        const index = this.evaluate(node.index, scope);
        return indexValue(object, index);
      }
      case "unary":
        return !isTruthy(this.evaluate(node.argument, scope));
      case "binary":
        return this.evaluateBinary(node.operator, node, scope);
      case "conditional":
        return isTruthy(this.evaluate(node.test, scope))
          ? this.evaluate(node.consequent, scope)
          : this.evaluate(node.alternate, scope);
      case "coalesce": {
        const left = this.evaluate(node.left, scope);
        return isTruthy(left) ? left : this.evaluate(node.right, scope);
      }
      case "array":
        return node.elements.map((element) => this.evaluate(element, scope));
      case "set":
        return node.elements.map((element) => this.evaluate(element, scope));
      case "map": {
        const output: ValueMap = {};
        for (const entry of node.entries) {
          output[entry.key] = this.evaluate(entry.value, scope);
        }
        return output;
      }
      case "lambda":
        return new Closure(node.params, node.body, scope, this);
      case "call":
        return this.evaluateCall(node, scope);
      default:
        return null;
    }
  }

  private evaluateBinary(operator: BinaryOperator, node: ExprNode, scope: Scope): Value {
    if (node.kind !== "binary") return null;

    if (operator === "and") {
      const left = this.evaluate(node.left, scope);
      if (!isTruthy(left)) return false;
      return isTruthy(this.evaluate(node.right, scope));
    }
    if (operator === "or") {
      const left = this.evaluate(node.left, scope);
      if (isTruthy(left)) return true;
      return isTruthy(this.evaluate(node.right, scope));
    }

    const left = this.evaluate(node.left, scope);
    const right = this.evaluate(node.right, scope);

    switch (operator) {
      case "==":
        return looseEquals(left, right);
      case "!=":
        return !looseEquals(left, right);
      case "<":
        return compare(left, right) < 0;
      case ">":
        return compare(left, right) > 0;
      case "<=":
        return compare(left, right) <= 0;
      case ">=":
        return compare(left, right) >= 0;
      case "in":
        return isMember(left, right);
      case "not in":
        return !isMember(left, right);
      case "contains":
        return isMember(right, left);
      case "+":
        return add(left, right);
      default:
        return null;
    }
  }

  private evaluateCall(node: ExprNode, scope: Scope): Value {
    if (node.kind !== "call") return null;

    const direct =
      node.callee.kind === "reference" && node.callee.name === node.name;
    const args = node.args.map((arg) => this.evaluate(arg, scope));
    const fullArgs = direct ? args : [this.evaluate(node.callee, scope), ...args];

    const result = callFunction(node.name, fullArgs, this.helperContext);
    if (result !== undefined) return result;

    this.host.report(
      "BLOGGER_PREVIEW_UNSUPPORTED_HELPER",
      `unsupported Blogger helper "${node.name}"`,
      node.start,
      node.end
    );
    return null;
  }

  private invoke(callable: Value, args: Value[]): Value {
    if (isInvokable(callable)) return callable.invoke(args);
    return null;
  }

  private resolveReference(name: string, scope: Scope): Value {
    if (name.startsWith("data:")) {
      const key = name.slice("data:".length);
      const bound = scope.get(key);
      if (bound !== undefined) return bound;
      if (Object.prototype.hasOwnProperty.call(this.rootData, key)) {
        return this.rootData[key] as Value;
      }
      this.host.report(
        "BLOGGER_PREVIEW_MISSING_DATA",
        `the preview has no value for "data:${key}"`,
        0,
        0
      );
      return null;
    }
    const bound = scope.get(name);
    if (bound !== undefined) return bound;
    if (Object.prototype.hasOwnProperty.call(this.rootData, name)) {
      return this.rootData[name] as Value;
    }
    return null;
  }
}

function indexValue(object: Value, index: Value): Value {
  if (Array.isArray(object)) {
    const position = Math.trunc(toNumber(index));
    if (position < 0 || position >= object.length) return null;
    return object[position] as Value;
  }
  if (typeof object === "string" || object instanceof HtmlString) {
    const text = object instanceof HtmlString ? object.value : object;
    const position = Math.trunc(toNumber(index));
    if (position < 0 || position >= text.length) return null;
    return text[position] as string;
  }
  if (isMap(object)) {
    const key = toText(index);
    return Object.prototype.hasOwnProperty.call(object, key)
      ? (object[key] as Value)
      : null;
  }
  return null;
}

function looseEquals(left: Value, right: Value): boolean {
  if (left === right) return true;
  if (left === null || right === null) return false;
  const leftIsNumber = typeof left === "number";
  const rightIsNumber = typeof right === "number";
  if (leftIsNumber && rightIsNumber) return left === right;
  if (leftIsNumber || rightIsNumber) return toNumber(left) === toNumber(right);
  if (typeof left === "boolean" || typeof right === "boolean") {
    return isTruthy(left) === isTruthy(right);
  }
  return toText(left) === toText(right);
}

function compare(left: Value, right: Value): number {
  if (typeof left === "number" || typeof right === "number") {
    const a = toNumber(left);
    const b = toNumber(right);
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const a = toText(left);
  const b = toText(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function isMember(needle: Value, haystack: Value): boolean {
  if (Array.isArray(haystack)) {
    return haystack.some((item) => looseEquals(item, needle));
  }
  if (haystack instanceof HtmlString) {
    return haystack.value.includes(toText(needle));
  }
  if (typeof haystack === "string") {
    return haystack.includes(toText(needle));
  }
  if (isMap(haystack)) {
    return Object.prototype.hasOwnProperty.call(haystack, toText(needle));
  }
  return false;
}

function add(left: Value, right: Value): Value {
  if (typeof left === "number" && typeof right === "number") return left + right;
  return toText(left) + toText(right);
}

export function isDateValue(value: Value): value is BloggerDate {
  return value instanceof BloggerDate;
}
