export type PreviewData = {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  url: string;
};

export type WishlistItem = {
  id: string;
  title: string;
  url: string;
  notes: string;
  preview: PreviewData | null;
  createdAt: string;
};

export type WishlistCategory = {
  id: string;
  name: string;
  createdAt: string;
  items: WishlistItem[];
};

export type WishlistData = {
  categories: WishlistCategory[];
  updatedAt: string;
};

export type WishlistResponse = {
  wishlist: WishlistData;
  canEdit: boolean;
};

export const createEmptyWishlist = (): WishlistData => ({
  categories: [],
  updatedAt: new Date().toISOString(),
});