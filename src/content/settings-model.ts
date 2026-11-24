import { DEFAULT_FAVICON_URL } from "../defaults.js";

export interface Author {
  name: string;
  profileUrl?: string;
  aboutMe?: string;
  avatar?: string;
}

export interface SiteSettings {
  title: string;
  description: string;
  baseUrl: string;
  favicon: string;
  author: string;
  postsPerPage: number;
  categories: string[];
  authors: Author[];
}

export function defaultSettings(): SiteSettings {
  return {
    title: "Guchho Blog",
    description: "A Guchho Blogger site",
    baseUrl: "http://localhost:3000/",
    favicon: DEFAULT_FAVICON_URL,
    author: "admin",
    postsPerPage: 10,
    categories: [],
    authors: [],
  };
}

export function normalizedBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
