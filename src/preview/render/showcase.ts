import type { WidgetRegistry } from "./widgets.js";

export function buildShowcaseTemplate(registry: WidgetRegistry): string {
  const types = [...registry.markups.keys()].sort((a, b) => a.localeCompare(b));
  const sections = types
    .map((type, index) => {
      const typeAttribute = escapeAttribute(type);
      return (
        `<b:section class='showcase' id='showcase-${index + 1}' name='${typeAttribute}'>` +
        `<b:widget id='Showcase${index + 1}' type='${typeAttribute}' title='${typeAttribute}'/>` +
        `</b:section>`
      );
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<html xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head><title>Widget showcase</title></head>
<body>
<h1>Widget showcase</h1>
<p>Every built-in and custom widget rendered with deterministic preview data.</p>
${sections}
</body>
</html>`;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
