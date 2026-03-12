/**
 * Catch-all untuk semua request ke /iclock/*
 * Dipakai untuk debug — menangkap path apapun yang dikirim device ZKTeco
 */
import { NextRequest, NextResponse } from "next/server";

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const fullPath = "/iclock/" + path.join("/");
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const ua = request.headers.get("user-agent") ?? "";

  let body = "";
  try {
    body = await request.text();
  } catch {}

  console.log(`[ZKTeco CATCH-ALL] ${request.method} ${fullPath}`);
  console.log(`[ZKTeco CATCH-ALL] IP: ${ip} | UA: ${ua}`);
  console.log(`[ZKTeco CATCH-ALL] Query: ${request.nextUrl.search}`);
  if (body) console.log(`[ZKTeco CATCH-ALL] Body: ${body}`);

  return new NextResponse("OK", { status: 200 });
}

export const GET = handler;
export const POST = handler;
