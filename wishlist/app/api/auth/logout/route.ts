import { NextResponse } from "next/server";
import { getAdminCookieName } from "../../../lib/wishlist-server";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getAdminCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}