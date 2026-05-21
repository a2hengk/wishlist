"use client";

import { useEffect, useMemo, useState } from "react";
import type { PreviewData, WishlistCategory, WishlistData, WishlistItem } from "./lib/wishlist-types";

type PreviewState = "idle" | "loading" | "ready" | "error";

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createTimestamp = () => new Date().toISOString();

const createEmptyWishlist = (): WishlistData => ({
  categories: [],
  updatedAt: "",
});

const createCategory = (name: string): WishlistCategory => ({
  id: createId(),
  name,
  createdAt: createTimestamp(),
  items: [],
});

const createItem = (input: {
  title: string;
  url: string;
  notes: string;
  preview: PreviewData | null;
}): WishlistItem => ({
  id: createId(),
  title: input.title,
  url: input.url,
  notes: input.notes,
  preview: input.preview,
  createdAt: createTimestamp(),
});

const defaultPreview = (url: string): PreviewData => ({
  title: null,
  description: null,
  image: null,
  siteName: null,
  url,
});

export default function Home() {
  const [wishlist, setWishlist] = useState<WishlistData>(createEmptyWishlist());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [message, setMessage] = useState("");

  const selectedCategory = useMemo(
    () => wishlist.categories.find((category) => category.id === selectedCategoryId) ?? null,
    [selectedCategoryId, wishlist.categories],
  );

  const commitWishlist = async (nextWishlist: WishlistData) => {
    setWishlist(nextWishlist);
    setMessage("");

    if (!canEdit) {
      setMessage("You are in read-only mode. Sign in to edit.");
      return false;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/wishlist", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ wishlist: nextWishlist }),
      });

      if (!response.ok) {
        throw new Error("Unable to save wishlist");
      }

      const data = (await response.json()) as { wishlist: WishlistData; canEdit: boolean };
      setWishlist(data.wishlist);
      setCanEdit(data.canEdit);
      setMessage("Saved.");
      return true;
    } catch {
      setMessage("Could not save your changes.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const loadWishlist = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/wishlist", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load wishlist");
      }

      const data = (await response.json()) as { wishlist: WishlistData; canEdit: boolean };
      setWishlist(data.wishlist ?? createEmptyWishlist());
      setCanEdit(data.canEdit);
      setSelectedCategoryId((current) => current ?? data.wishlist?.categories?.[0]?.id ?? null);
    } catch {
      setLoadError("The wishlist could not be loaded right now.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await loadWishlist();
    };

    void initialize();
  }, []);

  const handleLogin = async () => {
    setAuthError("");
    setIsAuthenticating(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: authPassword }),
      });

      if (!response.ok) {
        setAuthError("That password did not unlock editing.");
        return;
      }

      setAuthPassword("");
      await loadWishlist();
    } catch {
      setAuthError("Could not contact the login endpoint. Try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCanEdit(false);
    await loadWishlist();
  };

  const handleAddCategory = async () => {
    const name = categoryName.trim();
    if (!name) {
      setMessage("Type a category name first.");
      return;
    }

    const nextCategory = createCategory(name);
    const nextWishlist: WishlistData = {
      ...wishlist,
      categories: [...wishlist.categories, nextCategory],
      updatedAt: createTimestamp(),
    };

    setCategoryName("");
    setSelectedCategoryId(nextCategory.id);
    await commitWishlist(nextWishlist);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const nextWishlist: WishlistData = {
      ...wishlist,
      categories: wishlist.categories.filter((category) => category.id !== categoryId),
      updatedAt: createTimestamp(),
    };

    if (selectedCategoryId === categoryId) {
      setSelectedCategoryId(nextWishlist.categories[0]?.id ?? null);
    }

    await commitWishlist(nextWishlist);
  };

  const handlePreview = async () => {
    const url = itemUrl.trim();
    if (!url) {
      setMessage("Paste a product link first.");
      return;
    }

    setPreviewState("loading");
    try {
      const response = await fetch(`/api/preview?url=${encodeURIComponent(url)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { preview: PreviewData | null };
      setPreview(data.preview ?? defaultPreview(url));
      if (!itemTitle.trim() && data.preview?.title) {
        setItemTitle(data.preview.title);
      }
      setPreviewState("ready");
    } catch {
      setPreview(defaultPreview(url));
      setPreviewState("error");
    }
  };

  const handleAddItem = async () => {
    if (!selectedCategory) {
      setMessage("Create a category first.");
      return;
    }

    const url = itemUrl.trim();
    const title = itemTitle.trim() || preview?.title?.trim() || url;

    if (!url) {
      setMessage("Paste a link before adding an item.");
      return;
    }

    const nextWishlist: WishlistData = {
      ...wishlist,
      categories: wishlist.categories.map((category) =>
        category.id === selectedCategory.id
          ? {
              ...category,
              items: [
                ...category.items,
                createItem({
                  title,
                  url,
                  notes: itemNotes.trim(),
                  preview: preview ?? defaultPreview(url),
                }),
              ],
            }
          : category,
      ),
      updatedAt: createTimestamp(),
    };

    setItemUrl("");
    setItemTitle("");
    setItemNotes("");
    setPreview(null);
    setPreviewState("idle");
    await commitWishlist(nextWishlist);
  };

  const handleDeleteItem = async (categoryId: string, itemId: string) => {
    const nextWishlist: WishlistData = {
      ...wishlist,
      categories: wishlist.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.filter((item) => item.id !== itemId),
            }
          : category,
      ),
      updatedAt: createTimestamp(),
    };

    await commitWishlist(nextWishlist);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,210,228,0.55),_transparent_38%),linear-gradient(180deg,_#fff8fc_0%,_#fffdfd_100%)] text-[#2a1722]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-[0_24px_80px_rgba(244,168,194,0.18)] backdrop-blur sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-pink-200/80 bg-pink-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-pink-700">
                wishlist
                <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
                read-only sharing
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-[#1f1220] sm:text-4xl">
                  My Wishlist!
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-[#6c5967] sm:text-base">
                  Heyy, this is my wishlist where i keep track of all the things i want to buy in the future.
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1.5rem] border border-pink-100 bg-pink-50/80 p-4 sm:min-w-[21rem]">
              {canEdit ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-pink-900 shadow-sm">
                    Editing is unlocked for this browser.
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-full border border-pink-200 bg-white px-4 py-2.5 text-sm font-medium text-pink-700 transition hover:border-pink-300 hover:bg-pink-50"
                  >
                    Lock editing
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-[0.25em] text-pink-700">
                      Creator password
                    </label>
                    <input
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      type="password"
                      placeholder="Enter the private password"
                      className="w-full rounded-2xl border border-pink-100 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#b99baa] focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={isAuthenticating}
                    className="w-full rounded-full bg-[#d96f9f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#c95d8d] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isAuthenticating ? "Unlocking..." : "Unlock editing"}
                  </button>
                  {authError ? <p className="text-sm text-[#b04f75]">{authError}</p> : <p className="text-sm text-[#8d7684]">The password only unlocks editing on this device.</p>}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-[2rem] border border-white/70 bg-white/72 p-4 shadow-[0_18px_60px_rgba(244,168,194,0.16)] backdrop-blur">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-700">Folders</h2>
              <p className="text-sm text-[#715d6a]">Open a category to see the items inside.</p>
            </div>

            {canEdit ? (
              <div className="space-y-3 rounded-[1.5rem] border border-pink-100 bg-pink-50/70 p-3">
                <label className="block text-xs font-medium uppercase tracking-[0.25em] text-pink-700">
                  New category
                </label>
                <div className="flex gap-2">
                  <input
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleAddCategory();
                      }
                    }}
                    placeholder="Travel, books, home..."
                    className="min-w-0 flex-1 rounded-2xl border border-pink-100 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-[#b99baa] focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="rounded-2xl bg-[#f08db2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#e57aa4]"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3">
              {isLoading ? (
                <div className="rounded-[1.5rem] border border-pink-100 bg-pink-50/60 p-4 text-sm text-[#735f6e]">
                  Loading wishlist...
                </div>
                ) : loadError ? (
                  <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
                    {loadError}
                  </div>
              ) : wishlist.categories.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-pink-200 bg-pink-50/60 p-4 text-sm text-[#735f6e]">
                  {canEdit
                    ? "No folders yet. Add your first category to start organizing links."
                    : "The creator has not added any folders yet."}
                </div>
              ) : (
                wishlist.categories.map((category) => {
                  const isActive = category.id === selectedCategoryId;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={`group flex items-start gap-3 rounded-[1.5rem] border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-pink-300 bg-pink-50 shadow-sm"
                          : "border-pink-100 bg-white/80 hover:border-pink-200 hover:bg-pink-50/80"
                      }`}
                    >
                      <div className="mt-0.5 rounded-2xl border border-pink-200 bg-gradient-to-br from-[#ffdbea] to-[#fff6fa] px-3 py-2 text-sm shadow-sm">
                        📁
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="truncate font-medium text-[#271623]">{category.name}</p>
                            <p className="text-xs text-[#8b7482]">
                              {category.items.length} item{category.items.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          {canEdit ? (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleDeleteCategory(category.id);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleDeleteCategory(category.id);
                                }
                              }}
                              className="rounded-full border border-transparent px-2 py-1 text-xs text-[#b66786] opacity-0 transition group-hover:opacity-100 hover:border-pink-200 hover:bg-white"
                            >
                              delete
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="space-y-6 rounded-[2rem] border border-white/70 bg-white/76 p-4 shadow-[0_18px_60px_rgba(244,168,194,0.16)] backdrop-blur sm:p-6">
            <div className="flex flex-col gap-4 border-b border-pink-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pink-700">Current folder</p>
                <h2 className="text-2xl font-semibold tracking-tight text-[#1f1220]">
                  {selectedCategory?.name ?? "Choose a folder"}
                </h2>
                <p className="max-w-xl text-sm leading-6 text-[#715d6a]">
                  {selectedCategory
                    ? "Drop links into this folder and the app will keep the card data for you."
                    : "Select a folder from the left. The view is public, but editing stays locked to the creator."}
                </p>
              </div>

              <div className="rounded-full border border-pink-100 bg-pink-50/80 px-4 py-2 text-sm text-pink-800">
                {isSaving ? "Saving changes..." : canEdit ? "Editable mode" : "Read-only mode"}
              </div>
            </div>

            {selectedCategory ? (
              <div className="space-y-6">
                {canEdit ? (
                  <div className="rounded-[1.75rem] border border-pink-100 bg-gradient-to-br from-[#fff3f8] to-[#fffdfd] p-4 sm:p-5">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                      <div className="space-y-3">
                        <label className="block text-xs font-medium uppercase tracking-[0.25em] text-pink-700">
                          Paste product link
                        </label>
                        <input
                          value={itemUrl}
                          onChange={(event) => {
                            setItemUrl(event.target.value);
                            setPreviewState("idle");
                          }}
                          placeholder="https://www.amazon.com/..."
                          className="w-full rounded-2xl border border-pink-100 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#b99baa] focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.25em] text-pink-700">
                              Title
                            </label>
                            <input
                              value={itemTitle}
                              onChange={(event) => setItemTitle(event.target.value)}
                              placeholder="Optional manual title"
                              className="w-full rounded-2xl border border-pink-100 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#b99baa] focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.25em] text-pink-700">
                              Notes
                            </label>
                            <input
                              value={itemNotes}
                              onChange={(event) => setItemNotes(event.target.value)}
                              placeholder="Why you want it"
                              className="w-full rounded-2xl border border-pink-100 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#b99baa] focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col justify-between gap-3 rounded-[1.5rem] border border-pink-100 bg-white p-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.25em] text-pink-700">
                            Preview
                          </p>
                          <p className="mt-1 text-sm text-[#735f6e]">
                            Pull title and image from the product page when possible.
                          </p>
                        </div>
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={handlePreview}
                            className="w-full rounded-full border border-pink-200 bg-pink-50 px-4 py-2.5 text-sm font-medium text-pink-700 transition hover:border-pink-300 hover:bg-pink-100"
                          >
                            {previewState === "loading" ? "Fetching preview..." : "Fetch preview"}
                          </button>
                          <button
                            type="button"
                            onClick={handleAddItem}
                            className="w-full rounded-full bg-[#d96f9f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#c95d8d]"
                          >
                            Add to folder
                          </button>
                        </div>
                      </div>
                    </div>

                    {preview ? (
                      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-pink-100 bg-white shadow-sm">
                        <div className="grid gap-0 lg:grid-cols-[8rem_minmax(0,1fr)]">
                          <div className="flex min-h-32 items-center justify-center bg-pink-50/80 p-4">
                            {preview.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={preview.image}
                                alt={preview.title ?? "Product preview"}
                                className="max-h-24 w-full rounded-2xl object-contain"
                              />
                            ) : (
                              <div className="rounded-2xl border border-dashed border-pink-200 px-4 py-3 text-center text-xs text-[#9b7f90]">
                                No image available
                              </div>
                            )}
                          </div>
                          <div className="space-y-2 p-4">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[#24131d]">
                                {preview.title ?? "Link preview"}
                              </p>
                              <p className="text-sm text-[#715d6a]">
                                {preview.siteName ?? new URL(preview.url).hostname}
                              </p>
                            </div>
                            {preview.description ? (
                              <p className="line-clamp-2 text-sm leading-6 text-[#6d5b68]">
                                {preview.description}
                              </p>
                            ) : null}
                            <p className="break-all text-xs text-[#a28595]">{preview.url}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {previewState === "error" ? (
                      <p className="mt-3 text-sm text-[#b04f75]">
                        Preview lookup failed. You can still save the link with a manual title.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-4">
                  {selectedCategory.items.length === 0 ? (
                    <div className="rounded-[1.75rem] border border-dashed border-pink-200 bg-pink-50/50 p-6 text-sm text-[#735f6e]">
                      This folder is empty. Add a link to start building the list.
                    </div>
                  ) : (
                    selectedCategory.items.map((item) => (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-[1.75rem] border border-pink-100 bg-white shadow-[0_14px_40px_rgba(244,168,194,0.14)]"
                      >
                        <div className="grid gap-0 lg:grid-cols-[10rem_minmax(0,1fr)]">
                          <div className="flex min-h-40 items-center justify-center bg-gradient-to-br from-[#ffe7f0] to-[#fff9fb] p-4">
                            {item.preview?.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.preview.image}
                                alt={item.title}
                                className="max-h-32 w-full rounded-2xl object-contain shadow-sm"
                              />
                            ) : (
                              <div className="rounded-[1.25rem] border border-dashed border-pink-200 px-4 py-4 text-center text-xs text-[#987a8a]">
                                Saved link card
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col justify-between gap-4 p-5">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-semibold text-[#21141d]">{item.title}</h3>
                                {item.preview?.siteName ? (
                                  <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs text-pink-700">
                                    {item.preview.siteName}
                                  </span>
                                ) : null}
                              </div>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all text-sm text-[#c05d86] underline-offset-4 transition hover:underline"
                              >
                                {item.url}
                              </a>
                              {item.notes ? (
                                <p className="text-sm leading-6 text-[#6f5d68]">{item.notes}</p>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs uppercase tracking-[0.25em] text-[#ab90a0]">
                                Added {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteItem(selectedCategory.id, item.id)}
                                  className="rounded-full border border-pink-200 px-3 py-1.5 text-xs font-medium text-pink-700 transition hover:bg-pink-50"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-pink-200 bg-pink-50/50 p-8 text-sm text-[#735f6e]">
                {isLoading
                  ? "Loading folders..."
                  : "Pick a category from the folder list to open it."}
              </div>
            )}
          </section>
        </section>

        <footer className="flex flex-col gap-2 pb-2 text-sm text-[#8d7684] sm:flex-row sm:items-center sm:justify-between">
          <p>{message || loadError || "Public visitors can view everything, but only the creator can edit."}</p>
          <p>{wishlist.updatedAt ? `Updated ${new Date(wishlist.updatedAt).toLocaleString()}` : ""}</p>
        </footer>
      </div>
    </main>
  );
}