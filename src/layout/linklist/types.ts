export const LINKLIST_WIDGET_TYPE = "LinkList";

export const LINKLIST_TITLE_MAX_LENGTH = 100;

export const LINKLIST_LINKS_SEPARATOR = "|";
export const LINKLIST_LINKS_HINT = `One link per line: Label ${LINKLIST_LINKS_SEPARATOR} https://example.com`;

export const LINKLIST_SETTING = {
  sorting: "sorting",
  shownum: "shownum",
  legacyLinks: "links",
} as const;

export const LINKLIST_SORTING = {
  none: "NONE",
  alphabetical: "ALPHABETICAL",
  reverseAlphabetical: "REVERSE_ALPHABETICAL",
} as const;

export type LinkListSorting = (typeof LINKLIST_SORTING)[keyof typeof LINKLIST_SORTING];

export const LINKLIST_SORTING_OPTIONS = [
  { value: LINKLIST_SORTING.none, label: "Don't sort" },
  { value: LINKLIST_SORTING.alphabetical, label: "Alphabetically" },
  { value: LINKLIST_SORTING.reverseAlphabetical, label: "Reverse Alphabetically" },
] as const;

export const LINKLIST_SORTING_VALUES: readonly string[] = LINKLIST_SORTING_OPTIONS.map(
  (option) => option.value
);

export const LINKLIST_DEFAULT_SETTINGS: Record<string, string> = {
  [LINKLIST_SETTING.sorting]: LINKLIST_SORTING.none,
  [LINKLIST_SETTING.shownum]: "",
};

export interface LinkListLink {
  name: string;
  url: string;
}

export interface LinkListIndexedLink extends LinkListLink {
  index: number;
}

export interface LinkListValidationIssue {
  key: string;
  message: string;
}
