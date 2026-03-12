import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ZKTECO_API_KEY = process.env.ZKTECO_API_KEY;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  if (!ZKTECO_API_KEY) return false;

  // Device dapat kirim key lewat header atau query param
  const headerKey = request.headers.get("x-api-key");
  const queryKey = request.nextUrl.searchParams.get("key");

  return headerKey === ZKTECO_API_KEY || queryKey === ZKTECO_API_KEY;
}

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
 * Parse format ADMS ZKTeco:
 * Setiap baris: PIN\tDateTime\tStatus\tVerify\tWorkCode\tReserved
 * Contoh:       1234\t2026-03-12 08:30:00\t0\t1\t0\t
 *
 * Status device (kita abaikan — logika check-in/out ditentukan dari DB):
 * 0 = Check In, 1 = Check Out, 4 = Overtime In, 5 = Overtime Out
 */
function parseADMSData(raw: string): Array<{ pin: string; dateTime: Date }> {
  const results: Array<{ pin: string; dateTime: Date }> = [];

  const lines = raw.trim().split("\n");
  for (const line of lines) {
    const parts = line.trim().split("\t");
    if (parts.length < 2) continue;

    const pin = parts[0].trim();
    const dateTimeStr = parts[1].trim(); // "2026-03-12 08:30:00"

    if (!pin || !dateTimeStr) continue;

    // Ganti spasi dengan T agar bisa di-parse sebagai ISO date
    const parsed = new Date(dateTimeStr.replace(" ", "T"));
    if (isNaN(parsed.getTime())) continue;

    results.push({ pin, dateTime: parsed });
  }

  return results;
}

async function processAttendance(
  pin: string,
  dateTime: Date
): Promise<{ action: "checkin" | "checkout" | "ignored"; message: string }> {
  return prisma.$transaction(async (tx) => {
    // NIK dipakai sebagai PIN di device ZKTeco
    const karyawan = await tx.karyawan.findUnique({
      where: { nik: pin },
    });

    if (!karyawan || !karyawan.isActive) {
      throw new Error(`Karyawan dengan NIK ${pin} tidak ditemukan`);
    }

    const tanggal = normalizeTanggal(dateTime);

    const existing = await tx.absensi.findFirst({
      where: { karyawanId: karyawan.id, tanggal },
    });

    if (!existing) {
      // Belum check-in hari ini → buat check-in
      const jamMasuk = mergeDateWithTime(tanggal, dateTime);
      await tx.absensi.create({
        data: {
          karyawanId: karyawan.id,
          tanggal,
          jamMasuk,
          status: "HADIR",
        },
      });
      return { action: "checkin", message: `Check-in berhasil untuk ${karyawan.nama}` };
    }

    if (!existing.jamKeluar) {
      // Sudah check-in tapi belum check-out → update check-out
      const jamKeluar = mergeDateWithTime(tanggal, dateTime);
      await tx.absensi.update({
        where: { id: existing.id },
        data: { jamKeluar },
      });
      return { action: "checkout", message: `Check-out berhasil untuk ${karyawan.nama}` };
    }

    // Sudah check-in dan check-out → abaikan
    return { action: "ignored", message: `${karyawan.nama} sudah lengkap check-in/out hari ini` };
  });
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * GET /api/zkteco/push
 * Dipakai device untuk heartbeat / registrasi awal (ADMS protocol).
 * Device ZKTeco akan GET dulu ke server sebelum mulai push data.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Response format ADMS ZKTeco: plain text, newline-separated
  const responseText = [
    "GET OPTION FROM: " + request.nextUrl.host,
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
 * POST /api/zkteco/push
 *
 * Menerima data absensi push dari device ZKTeco (ADMS push protocol).
 * Body: application/x-www-form-urlencoded
 *   SN=DEVICE_SERIAL&table=ATTLOG&Stamp=9999&data=PIN\tDateTime\tStatus\t...\n...
 *
 * Konfigurasi di device:
 *   - Server Address: http://yourserver.com/api/zkteco/push?key=API_KEY_KAMU
 *   - Server Port: 80 (atau 443 untuk HTTPS)
 *
 * Auth: API key via query param `key` atau header `x-api-key`
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let rawData: string | null = null;
  let table: string | null = null;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    table = params.get("table");
    rawData = params.get("data");
  } else {
    // Fallback: JSON body untuk testing manual
    try {
      const body = await request.json();
      table = body.table ?? "ATTLOG";
      rawData = body.data ?? null;
    } catch {
      return NextResponse.json(
        { success: false, error: "Format body tidak dikenali" },
        { status: 400 }
      );
    }
  }

  // Hanya proses tabel ATTLOG (attendance log)
  if (table !== "ATTLOG") {
    // Device juga kirim tabel lain (OPERLOG, dll) — cukup balas OK
    return new NextResponse("OK", { status: 200 });
  }

  if (!rawData) {
    return new NextResponse("OK", { status: 200 });
  }

  const records = parseADMSData(rawData);

  if (records.length === 0) {
    return new NextResponse("OK", { status: 200 });
  }

  const results = [];
  const errors = [];

  for (const record of records) {
    try {
      const result = await processAttendance(record.pin, record.dateTime);
      results.push({ pin: record.pin, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error tidak diketahui";
      errors.push({ pin: record.pin, error: message });
    }
  }

  // ZKTeco ADMS mengharapkan plain text "OK" sebagai response sukses
  // Kita tetap return JSON agar mudah di-debug, tapi dengan status 200
  return NextResponse.json(
    {
      success: true,
      processed: results.length,
      errors: errors.length,
      results,
      ...(errors.length > 0 ? { errorDetails: errors } : {}),
    },
    { status: 200 }
  );
}
