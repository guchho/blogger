import { linkListLinks, migrateLegacyLinkListSettings } from "./serialization.js";
import {
  LINKLIST_SETTING,
  LINKLIST_SORTING_VALUES,
  LINKLIST_TITLE_MAX_LENGTH,
  type LinkListValidationIssue,
} from "./types.js";

export function isLinkListUrl(value: string): boolean {
  const url = String(value ?? "").trim();
  if (url === "" || /[\s<>"']/.test(url)) return false;
  if (/^https?:\/\/[^\s]+$/i.test(url)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false;
  return true;
}

export function validateLinkListTitle(
  title: string
): LinkListValidationIssue | undefined {
  const value = String(title ?? "");
  if (value.length > LINKLIST_TITLE_MAX_LENGTH) {
    return {
      key: "title",
      message: `Title must be at most ${LINKLIST_TITLE_MAX_LENGTH} characters.`,
    };
  }
  return undefined;
}

export function validateLinkListSettings(
  settings: Readonly<Record<string, string>> = {}
): LinkListValidationIssue[] {
  const issues: LinkListValidationIssue[] = [];
  const sorting = settings[LINKLIST_SETTING.sorting];
  if (sorting !== undefined && sorting !== "" && !LINKLIST_SORTING_VALUES.includes(sorting)) {
    issues.push({ key: LINKLIST_SETTING.sorting, message: "Sort links has an invalid value." });
  }
  const shownum = String(settings[LINKLIST_SETTING.shownum] ?? "").trim();
  if (shownum !== "" && !/^[1-9]\d*$/.test(shownum)) {
    issues.push({
      key: LINKLIST_SETTING.shownum,
      message: "Show must be a whole number of at least 1, or blank to show all links.",
    });
  }
  const links = linkListLinks(migrateLegacyLinkListSettings(settings));
  links.forEach((link, position) => {
    const number = position + 1;
    if (link.name.trim() === "") {
      issues.push({ key: `text-${link.index}`, message: `Site Name is required for link ${number}.` });
    }
    if (link.url.trim() === "") {
      issues.push({ key: `link-${link.index}`, message: `Site URL is required for link ${number}.` });
    } else if (!isLinkListUrl(link.url)) {
      issues.push({
        key: `link-${link.index}`,
        message: `Site URL for link ${number} must be relative or start with http:// or https://.`,
      });
    }
  });
  return issues;
}
