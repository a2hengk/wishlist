import { NextResponse } from "next/server";
import { getAdminCookieName, getAdminPassword, getAdminToken } from "../../../lib/wishlist-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";

  if (password !== getAdminPassword()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getAdminCookieName(),
    value: getAdminToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}