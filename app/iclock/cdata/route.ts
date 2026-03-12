/**
 * /iclock/cdata — Endpoint standar ADMS push protocol ZKTeco
 *
 * Flow dari device:
 *   1. GET  /iclock/cdata?SN=xxx&options=all  → server balas konfigurasi
 *   2. POST /iclock/cdata?SN=xxx&table=options → device kirim info (MAC, FW, dll)
 *   3. GET  /iclock/getrequest?SN=xxx          → device polling command
 *   4. POST /iclock/cdata?SN=xxx&table=ATTLOG  → device kirim data absensi
 *
 * Konfigurasi di device ZKTeco:
 *   Comm. Settings → Cloud Server
 *   Alamat Server : 192.168.1.19 (IP server)
 *   Server Port   : 80 (dev) / 80 atau 443 (production)
 *   Server Mode   : ADMS
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeTanggal(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mergeDateWithTime(tanggal: Date, time: Date): Date {
  const merged = new Date(tanggal);
  merged.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  return merged;
}

/**
 * Parse format ADMS dari field `data`:
 * Setiap baris: PIN\tDateTime\tStatus\tVerify\tWorkCode\tReserved
 */
function parseADMSData(raw: string): Array<{ pin: string; dateTime: Date }> {
  const results: Array<{ pin: string; dateTime: Date }> = [];
  for (const line of raw.trim().split("\n")) {
    const parts = line.trim().split("\t");
    if (parts.length < 2) continue;
    const pin = parts[0].trim();
    const dateTimeStr = parts[1].trim();
    if (!pin || !dateTimeStr) continue;
    const parsed = new Date(dateTimeStr.replace(" ", "T"));
    if (isNaN(parsed.getTime())) continue;
    results.push({ pin, dateTime: parsed });
  }
  return results;
}

async function processAttendance(pin: string, dateTime: Date) {
  console.log(`[ZKTeco DEBUG] processAttendance dipanggil: PIN="${pin}", dateTime="${dateTime.toISOString()}"`);
  return prisma.$transaction(async (tx) => {
    const karyawan = await tx.karyawan.findUnique({ where: { nik: pin } });
    console.log(`[ZKTeco DEBUG] findUnique NIK="${pin}" → karyawan:`, karyawan ? `id=${karyawan.id} nama=${karyawan.nama} isActive=${karyawan.isActive}` : "NULL");
    if (!karyawan || !karyawan.isActive) {
      throw new Error(`Karyawan NIK ${pin} tidak ditemukan`);
    }

    const tanggal = normalizeTanggal(dateTime);
    const existing = await tx.absensi.findFirst({
      where: { karyawanId: karyawan.id, tanggal },
    });

    if (!existing) {
      // Absen pertama hari ini → check-in
      await tx.absensi.create({
        data: {
          karyawanId: karyawan.id,
          tanggal,
          jamMasuk: mergeDateWithTime(tanggal, dateTime),
          status: "HADIR",
        },
      });
      console.log(`[ZKTeco] CHECK-IN: ${karyawan.nama} (${pin})`);
      return "checkin";
    }

    // Absen ke-2, 3, 4, dst → selalu update sebagai check-out terbaru
    await tx.absensi.update({
      where: { id: existing.id },
      data: { jamKeluar: mergeDateWithTime(tanggal, dateTime) },
    });
    console.log(`[ZKTeco] CHECK-OUT: ${karyawan.nama} (${pin})`);
    return "checkout";
  });
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * GET /iclock/cdata?SN=xxx&options=all
 * Device hit ini saat pertama konek untuk dapat konfigurasi dari server.
 */
export async function GET(request: NextRequest) {
  const sn = request.nextUrl.searchParams.get("SN") ?? "unknown";
  console.log(`[ZKTeco] Registrasi device SN: ${sn}`);

  const responseText = [
    `GET OPTION FROM: ${request.headers.get("host") ?? "server"}`,
    "ATTLOGStamp=9999",
    "OPERLOGStamp=9999",
    "ATTPHOTOStamp=9999",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=TransData AttLog",
    "TimeZone=7",
    "Realtime=1",
    "Encrypt=None",
  ].join("\n");

  return new NextResponse(responseText, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * POST /iclock/cdata
 *   ?table=options  → device kirim info hardware (MAC, firmware, dll) → balas OK
 *   ?table=ATTLOG   → device kirim data absensi → proses check-in/out
 *   lainnya         → abaikan, balas OK
 */
export async function POST(request: NextRequest) {
  const table = request.nextUrl.searchParams.get("table");
  const sn = request.nextUrl.searchParams.get("SN") ?? "unknown";

  // Device kirim info hardware — tidak perlu diproses, cukup balas OK
  if (table === "options") {
    console.log(`[ZKTeco] Device info diterima dari SN: ${sn}`);
    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  if (table !== "ATTLOG") {
    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // Proses data absensi (ATTLOG)
  // Body dikirim langsung sebagai tab-separated (bukan form-encoded data=...)
  const text = await request.text();
  console.log(`[ZKTeco] ATTLOG dari SN ${sn}:`, text);

  if (!text.trim()) {
    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const records = parseADMSData(text);
  console.log(`[ZKTeco DEBUG] Parsed records:`, JSON.stringify(records));
  for (const record of records) {
    try {
      await processAttendance(record.pin, record.dateTime);
    } catch (err) {
      console.error(`[ZKTeco] Error PIN ${record.pin}:`, err instanceof Error ? err.message : err);
    }
  }

  return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}
