import {
  LINKLIST_DEFAULT_SETTINGS,
  LINKLIST_SETTING,
  LINKLIST_SORTING_VALUES,
  type LinkListIndexedLink,
  type LinkListLink,
} from "./types.js";

const INDEXED_KEY = /^(text|link)-(\d+)$/;

export function isLinkListIndexedKey(key: string): boolean {
  return INDEXED_KEY.test(key);
}

export function withoutLinkListIndexedSettings(
  settings: Readonly<Record<string, string>>
): Record<string, string> {
  const out = { ...settings };
  delete out[LINKLIST_SETTING.legacyLinks];
  for (const key of Object.keys(out)) if (isLinkListIndexedKey(key)) delete out[key];
  return out;
}

export function linkListSortName(value: string): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .toLowerCase();
}

export function linkListLinkIndices(settings: Readonly<Record<string, string>>): number[] {
  const indices = new Set<number>();
  for (const key of Object.keys(settings)) {
    const match = INDEXED_KEY.exec(key);
    if (match) indices.add(Number.parseInt(match[2] as string, 10));
  }
  return [...indices].sort((a, b) => a - b);
}

export function linkListLinks(
  settings: Readonly<Record<string, string>>
): LinkListIndexedLink[] {
  return linkListLinkIndices(settings).map((index) => ({
    index,
    name: settings[`text-${index}`] ?? "",
    url: settings[`link-${index}`] ?? "",
  }));
}

export function linkListTextKey(index: number): string {
  return `text-${index}`;
}

export function linkListUrlKey(index: number): string {
  return `link-${index}`;
}

export function normalizeLinkListShownum(value: string | undefined): string {
  const raw = String(value ?? "").trim();
  if (raw === "") return "";
  return /^[1-9]\d*$/.test(raw) ? String(Number.parseInt(raw, 10)) : "";
}

function normalizeLinkListSorting(value: string | undefined): string {
  const raw = String(value ?? "");
  return LINKLIST_SORTING_VALUES.includes(raw)
    ? raw
    : (LINKLIST_DEFAULT_SETTINGS[LINKLIST_SETTING.sorting] as string);
}

export function parseLinkListText(value: string): LinkListLink[] {
  const links: LinkListLink[] = [];
  for (const line of String(value ?? "").split(/\r?\n/)) {
    const separator = line.indexOf("|");
    const name = (separator < 0 ? line : line.slice(0, separator)).trim();
    const url = separator < 0 ? "" : line.slice(separator + 1).trim();
    if (name === "" && url === "") continue;
    links.push({ name, url });
  }
  return links;
}

export function linkListTextFromLinks(links: readonly LinkListLink[]): string {
  return links
    .map((link) => `${String(link.name ?? "").replace(/\r?\n/g, " ")} | ${String(link.url ?? "").replace(/\r?\n/g, " ")}`)
    .join("\n");
}

export function migrateLegacyLinkListSettings(
  settings: Readonly<Record<string, string>>
): Record<string, string> {
  const out = { ...settings };
  const legacy = out[LINKLIST_SETTING.legacyLinks];
  if (legacy === undefined) return out;
  const hasIndexed = Object.keys(out).some(isLinkListIndexedKey);
  if (!hasIndexed) {
    const links = parseLinkListText(legacy);
    links.forEach((link, index) => {
      out[linkListTextKey(index)] = link.name;
      out[linkListUrlKey(index)] = link.url;
    });
  }
  delete out[LINKLIST_SETTING.legacyLinks];
  return out;
}

export function normalizeLinkListSettings(
  settings: Readonly<Record<string, string>> = {}
): Record<string, string> {
  const migrated = migrateLegacyLinkListSettings(settings);
  const out: Record<string, string> = { ...migrated };
  out[LINKLIST_SETTING.sorting] = normalizeLinkListSorting(out[LINKLIST_SETTING.sorting]);
  out[LINKLIST_SETTING.shownum] = normalizeLinkListShownum(out[LINKLIST_SETTING.shownum]);
  return out;
}

export function linkListSettingsFromLinks(
  settings: Readonly<Record<string, string>>,
  links: readonly LinkListLink[],
  sorting: string | undefined = settings[LINKLIST_SETTING.sorting],
  shownum: string | undefined = settings[LINKLIST_SETTING.shownum]
): Record<string, string> {
  const out: Record<string, string> = { ...settings };
  for (const key of Object.keys(out)) if (isLinkListIndexedKey(key)) delete out[key];
  delete out[LINKLIST_SETTING.legacyLinks];
  out[LINKLIST_SETTING.sorting] = normalizeLinkListSorting(sorting);
  out[LINKLIST_SETTING.shownum] = normalizeLinkListShownum(shownum);
  links.forEach((link, index) => {
    out[linkListTextKey(index)] = String(link.name ?? "");
    out[linkListUrlKey(index)] = String(link.url ?? "");
  });
  return out;
}

export function linkListWritableSettings(
  settings: Readonly<Record<string, string>>
): Record<string, string> {
  const out: Record<string, string> = {
    [LINKLIST_SETTING.sorting]: normalizeLinkListSorting(settings[LINKLIST_SETTING.sorting]),
    [LINKLIST_SETTING.shownum]: normalizeLinkListShownum(settings[LINKLIST_SETTING.shownum]),
  };
  for (const link of linkListLinks(settings)) {
    out[linkListTextKey(link.index)] = link.name;
    out[linkListUrlKey(link.index)] = link.url;
  }
  return out;
}
