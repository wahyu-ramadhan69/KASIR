import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function normalizeTanggal(value?: string | null): Date | null {
  if (!value) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function parseIds(value?: string | null): number[] | null {
  if (!value) return null;
  const ids = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  return ids.length > 0 ? ids : null;
}

function parseTimeOnDate(
  tanggal: Date,
  value: string | null | undefined
): Date | null {
  if (value === null) return null;
  if (value === undefined) return undefined as unknown as Date | null;
  if (value === "") return null;

  if (/^\d{2}:\d{2}$/.test(value)) {
    const [hh, mm] = value.split(":").map((v) => Number(v));
    if (
      Number.isNaN(hh) ||
      Number.isNaN(mm) ||
      hh < 0 ||
      hh > 23 ||
      mm < 0 ||
      mm > 59
    ) {
      return undefined as unknown as Date | null;
    }
    const result = new Date(tanggal);
    result.setHours(hh, mm, 0, 0);
    return result;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined as unknown as Date | null;
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tanggalParam = searchParams.get("tanggal");
    const idsParam = searchParams.get("ids");

    const tanggal = normalizeTanggal(tanggalParam);
    if (!tanggal) {
      return NextResponse.json(
        { success: false, error: "Format tanggal tidak valid" },
        { status: 400 }
      );
    }

    const nextDay = new Date(tanggal);
    nextDay.setDate(nextDay.getDate() + 1);

    const ids = parseIds(idsParam);

    const absensi = await prisma.absensi.findMany({
      where: {
        tanggal: {
          gte: tanggal,
          lt: nextDay,
        },
        ...(ids ? { karyawanId: { in: ids } } : {}),
      },
      select: {
        id: true,
        karyawanId: true,
        jamMasuk: true,
        jamKeluar: true,
        status: true,
        catatan: true,
        tanggal: true,
      },
    });

    return NextResponse.json({ success: true, data: absensi });
  } catch (error) {
    console.error("Error fetching absensi:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil status absensi" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const karyawanId = Number(body.karyawanId);
    const tanggal = normalizeTanggal(body.tanggal);

    if (!karyawanId || Number.isNaN(karyawanId)) {
      return NextResponse.json(
        { success: false, error: "karyawanId wajib diisi" },
        { status: 400 }
      );
    }

    if (!tanggal) {
      return NextResponse.json(
        { success: false, error: "Format tanggal tidak valid" },
        { status: 400 }
      );
    }

    const hasJamMasuk = "jamMasuk" in body;
    const hasJamKeluar = "jamKeluar" in body;
    if (!hasJamMasuk && !hasJamKeluar) {
      return NextResponse.json(
        { success: false, error: "Jam masuk/keluar wajib diisi" },
        { status: 400 }
      );
    }

    const jamMasuk = hasJamMasuk
      ? parseTimeOnDate(tanggal, body.jamMasuk)
      : undefined;
    const jamKeluar = hasJamKeluar
      ? parseTimeOnDate(tanggal, body.jamKeluar)
      : undefined;

    if (
      (hasJamMasuk && jamMasuk === undefined) ||
      (hasJamKeluar && jamKeluar === undefined)
    ) {
      return NextResponse.json(
        { success: false, error: "Format jam tidak valid" },
        { status: 400 }
      );
    }

    const existing = await prisma.absensi.findFirst({
      where: {
        karyawanId,
        tanggal,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Data absensi tidak ditemukan" },
        { status: 404 }
      );
    }

    const updated = await prisma.absensi.update({
      where: { id: existing.id },
      data: {
        ...(hasJamMasuk ? { jamMasuk } : {}),
        ...(hasJamKeluar ? { jamKeluar } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating absensi:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengupdate absensi" },
      { status: 500 }
    );
  }
}
