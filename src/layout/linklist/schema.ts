import type { GadgetDefinition } from "../gadgets.js";
import {
  LINKLIST_DEFAULT_SETTINGS,
  LINKLIST_SETTING,
  LINKLIST_SORTING_OPTIONS,
  LINKLIST_WIDGET_TYPE,
} from "./types.js";

export const LINKLIST_DEFINITION: GadgetDefinition = {
  type: LINKLIST_WIDGET_TYPE,
  label: "Link List",
  category: "Navigation",
  description: "Shows a list of custom links with native sorting and display options.",
  icon: "link",
  implemented: "full",
  capabilities: {
    configurable: true,
    duplicable: true,
    removable: true,
    movable: true,
    canHide: true,
  },
  sections: [
    {
      id: "general",
      label: "General",
      fields: [
        {
          kind: "select",
          key: LINKLIST_SETTING.sorting,
          label: "Sort links",
          options: LINKLIST_SORTING_OPTIONS.map((option) => ({ ...option })),
          defaultValue: LINKLIST_DEFAULT_SETTINGS[LINKLIST_SETTING.sorting],
        },
        {
          kind: "number",
          key: LINKLIST_SETTING.shownum,
          label: "Show",
          description: "Maximum number of links to display. Leave blank to show all.",
          min: 1,
          step: 1,
          defaultValue: LINKLIST_DEFAULT_SETTINGS[LINKLIST_SETTING.shownum],
        },
      ],
    },
  ],
  defaults: { ...LINKLIST_DEFAULT_SETTINGS },
  settingKeys: [LINKLIST_SETTING.sorting, LINKLIST_SETTING.shownum],
};
