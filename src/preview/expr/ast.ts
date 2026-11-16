// The expression AST. Positions are offsets into the decoded expression text;
// the renderer knows which attribute or element produced that text, so a
// diagnostic can be mapped back to a `file:line:column` location.

export interface NodeBase {
  start: number;
  end: number;
}

export interface LiteralNode extends NodeBase {
  kind: "literal";
  value: string | number | boolean | null;
}

/** A bare name, a `data:*` reference or a variable such as `p` or `i`. */
export interface ReferenceNode extends NodeBase {
  kind: "reference";
  name: string;
}

export interface MemberNode extends NodeBase {
  kind: "member";
  object: ExprNode;
  property: string;
}

export interface IndexNode extends NodeBase {
  kind: "index";
  object: ExprNode;
  index: ExprNode;
}

export interface UnaryNode extends NodeBase {
  kind: "unary";
  operator: "not" | "!";
  argument: ExprNode;
}

export type BinaryOperator =
  | "or"
  | "and"
  | "=="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "in"
  | "not in"
  | "contains"
  | "+";

export interface BinaryNode extends NodeBase {
  kind: "binary";
  operator: BinaryOperator;
  left: ExprNode;
  right: ExprNode;
}

export interface ConditionalNode extends NodeBase {
  kind: "conditional";
  test: ExprNode;
  consequent: ExprNode;
  alternate: ExprNode;
}

export interface CoalesceNode extends NodeBase {
  kind: "coalesce";
  left: ExprNode;
  right: ExprNode;
}

export interface ArrayNode extends NodeBase {
  kind: "array";
  elements: ExprNode[];
}

export interface MapNode extends NodeBase {
  kind: "map";
  entries: { key: string; value: ExprNode }[];
}

export interface SetNode extends NodeBase {
  kind: "set";
  elements: ExprNode[];
}

export interface LambdaNode extends NodeBase {
  kind: "lambda";
  params: string[];
  body: ExprNode;
}

/**
 * A helper invocation. Postfix form is `value helper arg` with zero or one
 * argument; direct form is `helper(a, b, c)` with any number.
 */
export interface CallNode extends NodeBase {
  kind: "call";
  callee: ExprNode;
  name: string;
  args: ExprNode[];
}

export type ExprNode =
  | LiteralNode
  | ReferenceNode
  | MemberNode
  | IndexNode
  | UnaryNode
  | BinaryNode
  | ConditionalNode
  | CoalesceNode
  | ArrayNode
  | MapNode
  | SetNode
  | LambdaNode
  | CallNode;
