import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

const VALID_STATUS = new Set(["HADIR", "IZIN", "SAKIT", "ALPHA", "LIBUR"]);

function normalizeTanggal(value?: string | Date): Date | null {
  if (!value) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const karyawanId = Number(body.karyawanId);
    const status = body.status ?? "HADIR";
    const catatan = body.catatan ?? null;
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

    if (!VALID_STATUS.has(status)) {
      return NextResponse.json(
        { success: false, error: "Status absensi tidak valid" },
        { status: 400 }
      );
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const karyawan = await tx.karyawan.findUnique({
        where: { id: karyawanId },
      });

      if (!karyawan || !karyawan.isActive) {
        throw new Error("Karyawan tidak ditemukan");
      }

      const existing = await tx.absensi.findFirst({
        where: {
          karyawanId,
          tanggal,
        },
      });

      if (existing) {
        throw new Error("Karyawan sudah check-in untuk tanggal ini");
      }

      return tx.absensi.create({
        data: {
          karyawanId,
          tanggal,
          jamMasuk: now,
          status,
          catatan,
        },
      });
    });

    return NextResponse.json(
      { success: true, message: "Check-in berhasil", data: result },
      { status: 201 }
    );
  } catch (error: any) {
    const message =
      error instanceof Error ? error.message : "Gagal melakukan check-in";

    if (message === "Karyawan tidak ditemukan") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }

    if (message === "Karyawan sudah check-in untuk tanggal ini") {
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
