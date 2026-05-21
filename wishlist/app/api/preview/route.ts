import { NextResponse } from "next/server";
import type { PreviewData } from "../../lib/wishlist-types";

export const runtime = "nodejs";

const decodeEntities = (input: string) =>
  input
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");

const cleanText = (input: string) => decodeEntities(input).replace(/\s+/g, " ").trim();

const parseMeta = (html: string, name: string) => {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }

  return null;
};

const parseTitle = (html: string) => {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return titleMatch?.[1] ? cleanText(titleMatch[1]) : null;
};

const normalizeUrl = (value: string) => {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = normalizeUrl(searchParams.get("url") ?? "");

  if (!url) {
    return NextResponse.json({ preview: null }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ preview: null });
    }

    const html = await response.text();
    const preview: PreviewData = {
      url,
      title: parseMeta(html, "og:title") ?? parseTitle(html),
      description: parseMeta(html, "og:description") ?? parseMeta(html, "description"),
      image: parseMeta(html, "og:image"),
      siteName: parseMeta(html, "og:site_name") ?? new URL(url).hostname.replace(/^www\./, ""),
    };

    return NextResponse.json({ preview });
  } catch {
    return NextResponse.json({ preview: null });
  } finally {
    clearTimeout(timeout);
  }
}