/**
 * GET /iclock/getrequest
 * Device ZKTeco polling ini secara berkala untuk minta command dari server.
 * Jika tidak ada command, cukup balas "OK".
 */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_SN = new Set(
  (process.env.ZKTECO_ALLOWED_SN ?? "").split(",").map((s) => s.trim()).filter(Boolean)
);

export async function GET(request: NextRequest) {
  const sn = request.nextUrl.searchParams.get("SN") ?? "";
  if (ALLOWED_SN.size > 0 && !ALLOWED_SN.has(sn)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Tidak ada command → balas OK
  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
