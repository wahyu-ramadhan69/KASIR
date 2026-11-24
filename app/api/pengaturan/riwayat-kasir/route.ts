// =====================================================
// PATH: app/api/pengaturan/riwayat-kasir/route.ts
// GET : mode akses riwayat penjualan kasir (semua user login)
// PUT : ubah mode (ADMIN) -> body { toko?: "SEMUA"|"HARI_INI", sales?: ... }
// =====================================================
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";
import {
  getRiwayatModes,
  RiwayatJenis,
  RiwayatMode,
  setRiwayatMode,
} from "@/app/lib/pengaturan";

const prisma = new PrismaClient();

export async function GET() {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const modes = await getRiwayatModes(prisma);
    return NextResponse.json({ success: true, data: modes });
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(request: NextRequest) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (authData.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Hanya admin yang bisa mengubah pengaturan" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const userId = parseInt(authData.userId, 10);
    const valid = (v: unknown): v is RiwayatMode =>
      v === "SEMUA" || v === "HARI_INI";

    const updates: [RiwayatJenis, RiwayatMode][] = [];
    for (const jenis of ["toko", "sales"] as RiwayatJenis[]) {
      if (body[jenis] === undefined) continue;
      if (!valid(body[jenis])) {
        return NextResponse.json(
          { success: false, error: `Nilai ${jenis} tidak valid` },
          { status: 400 },
        );
      }
      updates.push([jenis, body[jenis]]);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada perubahan" },
        { status: 400 },
      );
    }

    for (const [jenis, mode] of updates) {
      await setRiwayatMode(prisma, jenis, mode, userId);
    }

    const modes = await getRiwayatModes(prisma);
    return NextResponse.json({
      success: true,
      message: "Pengaturan riwayat kasir disimpan",
      data: modes,
    });
  } catch (error) {
    console.error("Error menyimpan pengaturan riwayat kasir:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal menyimpan pengaturan. Pastikan migrasi tabel PengaturanAplikasi sudah dijalankan.",
      },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
