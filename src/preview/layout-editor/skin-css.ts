const TARGET_PROPERTIES = new Set([
  "background",
  "background-color",
  "-webkit-transition",
  "transition",
  "box-sizing",
  "transform-origin",
  "outline",
  "word-wrap",
  "-webkit-appearance",
  "-moz-appearance",
  "appearance",
]);

const INTERACTIVE_PSEUDO_CLASSES = /:(?:active|hover|focus|focus-visible|target)(?![-\w])/;

export const LAYOUT_SKIN_CSS_FILE = "layout/skin.css";
export const LAYOUT_TEMPLATE_SKIN_CSS_FILE = "layout/template-skin.css";
export const LAYOUT_SKIN_CSS_URL = "/__preview/layout/skin.css";
export const LAYOUT_TEMPLATE_SKIN_CSS_URL = "/__preview/layout/template-skin.css";

export function commentLayoutSkinCss(css: string): string {
  const sanitized = removeInteractiveRules(css);
  const ranges: Array<[number, number]> = [];
  let statementStart = 0;
  let index = 0;

  while (index < sanitized.length) {
    const skipped = skipTrivia(sanitized, index);
    if (skipped !== index) {
      index = skipped;
      continue;
    }

    const character = sanitized.charAt(index);
    if (character === "(" || character === "[") {
      index = skipBalanced(sanitized, index);
      continue;
    }
    if (character === "{" || character === ";" || character === "}") {
      statementStart = index + 1;
      index += 1;
      continue;
    }
    if (character !== ":") {
      index += 1;
      continue;
    }

    const raw = sanitized.slice(statementStart, index);
    const leading = /^(\s|\/\*[\s\S]*?\*\/)*/.exec(raw)?.[0].length ?? 0;
    const property = raw
      .slice(leading)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim()
      .toLowerCase();

    if (TARGET_PROPERTIES.has(property)) {
      const end = findDeclarationEnd(sanitized, index + 1);
      ranges.push([statementStart + leading, end]);
      statementStart = end;
      index = end;
      continue;
    }

    index += 1;
  }

  let result = sanitized;
  for (let rangeIndex = ranges.length - 1; rangeIndex >= 0; rangeIndex -= 1) {
    const range = ranges[rangeIndex];
    if (!range) continue;
    const [start, end] = range;
    result = `${result.slice(0, start)}/* ${sanitized.slice(start, end)} */${result.slice(end)}`;
  }
  return result;
}

function skipTrivia(css: string, index: number): number {
  const character = css.charAt(index);
  if (character === "/" && css.charAt(index + 1) === "*") {
    const end = css.indexOf("*/", index + 2);
    return end === -1 ? css.length : end + 2;
  }
  if (character === "'" || character === '"') {
    return skipString(css, index, character);
  }
  return index;
}

function skipString(css: string, index: number, quote: string): number {
  let cursor = index + 1;
  while (cursor < css.length) {
    if (css.charAt(cursor) === "\\") {
      cursor += 2;
      continue;
    }
    if (css.charAt(cursor) === quote) return cursor + 1;
    cursor += 1;
  }
  return css.length;
}

function skipBalanced(css: string, index: number): number {
  let depth = 0;
  let cursor = index;
  while (cursor < css.length) {
    const skipped = skipTrivia(css, cursor);
    if (skipped !== cursor) {
      cursor = skipped;
      continue;
    }
    const character = css.charAt(cursor);
    if (character === "(" || character === "[") depth += 1;
    if (character === ")" || character === "]") {
      depth -= 1;
      if (depth === 0) return cursor + 1;
    }
    cursor += 1;
  }
  return css.length;
}

function findDeclarationEnd(css: string, index: number): number {
  let cursor = index;
  while (cursor < css.length) {
    const skipped = skipTrivia(css, cursor);
    if (skipped !== cursor) {
      cursor = skipped;
      continue;
    }
    const character = css.charAt(cursor);
    if (character === "(" || character === "[") {
      cursor = skipBalanced(css, cursor);
      continue;
    }
    if (character === ";") return cursor + 1;
    if (character === "}") return cursor;
    cursor += 1;
  }
  return css.length;
}

function removeInteractiveRules(css: string): string {
  const ranges: Array<[number, number]> = [];
  const starts: number[] = [0];
  let index = 0;

  while (index < css.length) {
    const skipped = skipTrivia(css, index);
    if (skipped !== index) {
      index = skipped;
      continue;
    }

    const character = css.charAt(index);
    if (character === "(" || character === "[") {
      index = skipBalanced(css, index);
      continue;
    }
    if (character === "{") {
      const segmentStart = starts.pop() ?? 0;
      if (hasInteractivePseudo(css.slice(segmentStart, index))) {
        const end = Math.min(findBlockEnd(css, index + 1) + 1, css.length);
        ranges.push([segmentStart, end]);
        starts.push(end);
        index = end;
        continue;
      }
      starts.push(index + 1);
      index += 1;
      continue;
    }
    if (character === "}") {
      starts.pop();
      starts.push(index + 1);
      index += 1;
      continue;
    }
    if (character === ";") {
      starts[starts.length - 1] = index + 1;
      index += 1;
      continue;
    }
    index += 1;
  }

  let result = css;
  for (let rangeIndex = ranges.length - 1; rangeIndex >= 0; rangeIndex -= 1) {
    const range = ranges[rangeIndex];
    if (!range) continue;
    const [start, end] = range;
    result = `${result.slice(0, start)}${result.slice(end)}`;
  }
  return result;
}

function findBlockEnd(css: string, index: number): number {
  let depth = 0;
  let cursor = index;
  while (cursor < css.length) {
    const skipped = skipTrivia(css, cursor);
    if (skipped !== cursor) {
      cursor = skipped;
      continue;
    }
    const character = css.charAt(cursor);
    if (character === "(" || character === "[") {
      cursor = skipBalanced(css, cursor);
      continue;
    }
    if (character === "{") {
      depth += 1;
      cursor += 1;
      continue;
    }
    if (character === "}") {
      if (depth === 0) return cursor;
      depth -= 1;
    }
    cursor += 1;
  }
  return css.length;
}

function hasInteractivePseudo(selector: string): boolean {
  const normalized = selector
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, " ");
  return INTERACTIVE_PSEUDO_CLASSES.test(normalized);
}
