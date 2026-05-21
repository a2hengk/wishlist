import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isValidAdminToken, readWishlist, saveWishlist } from "../../lib/wishlist-server";
import type { WishlistData, WishlistResponse } from "../../lib/wishlist-types";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const wishlist = await readWishlist();
  const canEdit = isValidAdminToken(cookieStore.get(getAdminCookieName())?.value);

  return NextResponse.json<WishlistResponse>(
    {
      wishlist,
      canEdit,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const canEdit = isValidAdminToken(cookieStore.get(getAdminCookieName())?.value);

  if (!canEdit) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { wishlist?: WishlistData } | WishlistData | null;
  const wishlist = body && "categories" in body ? body : body?.wishlist;

  if (!wishlist) {
    return NextResponse.json({ message: "Missing wishlist payload" }, { status: 400 });
  }

  await saveWishlist(wishlist);

  return NextResponse.json<WishlistResponse>({
    wishlist,
    canEdit: true,
  });
}