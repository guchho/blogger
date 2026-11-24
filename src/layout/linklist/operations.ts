import {
  linkListLinks,
  linkListSettingsFromLinks,
  linkListSortName,
  normalizeLinkListSettings,
} from "./serialization.js";
import {
  LINKLIST_SETTING,
  LINKLIST_SORTING,
  type LinkListLink,
  type LinkListSorting,
} from "./types.js";

function currentSorting(settings: Readonly<Record<string, string>>): LinkListSorting {
  const value = normalizeLinkListSettings(settings)[LINKLIST_SETTING.sorting];
  if (value === LINKLIST_SORTING.alphabetical || value === LINKLIST_SORTING.reverseAlphabetical) {
    return value;
  }
  return LINKLIST_SORTING.none;
}

export function addLinkListLink(
  settings: Readonly<Record<string, string>>,
  link: LinkListLink
): Record<string, string> {
  return linkListSettingsFromLinks(settings, [...linkListLinks(settings), { ...link }]);
}

export function editLinkListLink(
  settings: Readonly<Record<string, string>>,
  index: number,
  link: LinkListLink
): Record<string, string> {
  const links: LinkListLink[] = [...linkListLinks(settings)];
  if (index < 0 || index >= links.length) return { ...settings };
  links[index] = { ...link };
  return linkListSettingsFromLinks(settings, links);
}

export function deleteLinkListLink(
  settings: Readonly<Record<string, string>>,
  index: number
): Record<string, string> {
  const links: LinkListLink[] = [...linkListLinks(settings)];
  if (index < 0 || index >= links.length) return { ...settings };
  links.splice(index, 1);
  return linkListSettingsFromLinks(settings, links);
}

export function moveLinkListLink(
  settings: Readonly<Record<string, string>>,
  index: number,
  direction: "up" | "down"
): Record<string, string> {
  const links: LinkListLink[] = [...linkListLinks(settings)];
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= links.length || target < 0 || target >= links.length) {
    return { ...settings };
  }
  const moved = links.splice(index, 1)[0] as LinkListLink;
  links.splice(target, 0, moved);
  return linkListSettingsFromLinks(settings, links);
}

export function sortLinkListLinks(
  settings: Readonly<Record<string, string>>,
  sorting: string = currentSorting(settings)
): Record<string, string> {
  const links = linkListLinks(settings);
  if (sorting === LINKLIST_SORTING.none || links.length < 2) {
    return linkListSettingsFromLinks(settings, links, sorting);
  }
  const direction = sorting === LINKLIST_SORTING.reverseAlphabetical ? -1 : 1;
  const ordered = links
    .map((link, position) => ({ link, position }))
    .sort((left, right) => {
      const a = linkListSortName(left.link.name);
      const b = linkListSortName(right.link.name);
      if (a < b) return -1 * direction;
      if (a > b) return 1 * direction;
      return left.position - right.position;
    })
    .map((item) => item.link);
  return linkListSettingsFromLinks(settings, ordered, sorting);
}
