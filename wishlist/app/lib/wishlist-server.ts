import { createHmac } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { PreviewData, WishlistCategory, WishlistData, WishlistItem } from "./wishlist-types";

const wishlistFilePath = path.join(process.cwd(), "data", "wishlist.json");
const adminCookieName = "wishlist-admin";
const sessionPurpose = "wishlist-admin-session";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const normalizePreview = (value: unknown): PreviewData | null => {
  if (!isRecord(value)) {
    return null;
  }

  const url = normalizeString(value.url);
  if (!url) {
    return null;
  }

  return {
    url,
    title: typeof value.title === "string" ? value.title : null,
    description: typeof value.description === "string" ? value.description : null,
    image: typeof value.image === "string" ? value.image : null,
    siteName: typeof value.siteName === "string" ? value.siteName : null,
  };
};

const normalizeItem = (value: unknown): WishlistItem | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeString(value.id);
  const title = normalizeString(value.title);
  const url = normalizeString(value.url);
  if (!id || !title || !url) {
    return null;
  }

  return {
    id,
    title,
    url,
    notes: normalizeString(value.notes),
    preview: normalizePreview(value.preview),
    createdAt: normalizeString(value.createdAt, new Date().toISOString()),
  };
};

const normalizeCategory = (value: unknown): WishlistCategory | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeString(value.id);
  const name = normalizeString(value.name);
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    createdAt: normalizeString(value.createdAt, new Date().toISOString()),
    items: Array.isArray(value.items) ? (value.items.map(normalizeItem).filter(Boolean) as WishlistItem[]) : [],
  };
};

export const getAdminPassword = () => process.env.WISHLIST_ADMIN_PASSWORD ?? "wishlist-demo";

export const getAdminToken = () =>
  createHmac("sha256", getAdminPassword()).update(sessionPurpose).digest("hex");

export const isValidAdminToken = (token: string | undefined | null) => token === getAdminToken();

export const getAdminCookieName = () => adminCookieName;

export const readWishlist = async (): Promise<WishlistData> => {
  try {
    const file = await readFile(wishlistFilePath, "utf8");
    const parsed = JSON.parse(file) as unknown;
    if (!isRecord(parsed)) {
      throw new Error("Invalid wishlist file");
    }

    return {
      categories: Array.isArray(parsed.categories)
        ? (parsed.categories.map(normalizeCategory).filter(Boolean) as WishlistCategory[])
        : [],
      updatedAt: normalizeString(parsed.updatedAt, new Date().toISOString()),
    };
  } catch {
    return {
      categories: [],
      updatedAt: new Date().toISOString(),
    };
  }
};

export const saveWishlist = async (wishlist: WishlistData) => {
  await mkdir(path.dirname(wishlistFilePath), { recursive: true });
  await writeFile(wishlistFilePath, JSON.stringify(wishlist, null, 2), "utf8");
};