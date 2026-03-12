/**
 * GET /iclock/getrequest
 * Device ZKTeco polling ini secara berkala untuk minta command dari server.
 * Jika tidak ada command, cukup balas "OK".
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sn = request.nextUrl.searchParams.get("SN") ?? "unknown";
  console.log(`[ZKTeco GETREQUEST] SN: ${sn}`);

  // Tidak ada command → balas OK
  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
