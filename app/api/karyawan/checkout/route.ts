import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

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
    const tanggal = normalizeTanggal(body.tanggal);
    const catatan = body.catatan ?? null;

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

      if (!existing) {
        throw new Error("Karyawan belum check-in untuk tanggal ini");
      }

      if (existing.jamKeluar) {
        throw new Error("Karyawan sudah check-out untuk tanggal ini");
      }

      return tx.absensi.update({
        where: { id: existing.id },
        data: {
          jamKeluar: now,
          ...(catatan !== null ? { catatan } : {}),
        },
      });
    });

    return NextResponse.json(
      { success: true, message: "Check-out berhasil", data: result },
      { status: 200 }
    );
  } catch (error: any) {
    const message =
      error instanceof Error ? error.message : "Gagal melakukan check-out";

    if (message === "Karyawan tidak ditemukan") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }

    if (message === "Karyawan belum check-in untuk tanggal ini") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }

    if (message === "Karyawan sudah check-out untuk tanggal ini") {
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
