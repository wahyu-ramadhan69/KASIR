import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// ============================================================
// GET /api/stok-harian/historis?tanggal=2025-01-30
//
// Membaca data dari tabel StokHarian (hasil snapshot).
// Dipakai oleh UI tab Penjualan di DataBarangPage.
//
// Response yang diharapkan UI:
// {
//   success: true,
//   data: [{
//     barangId,
//     namaBarang,
//     jenisKemasan,
//     jumlahPerKemasan,
//     masukSetelahTanggal,   ← dari field totalMasuk di StokHarian
//     keluarSetelahTanggal,  ← dari field totalKeluar di StokHarian
//     stokPadaTanggal,       ← dari field stok di StokHarian
//   }]
// }
//
// Cara UI menghitung totalMasuk & totalTerjual pada hari tertentu:
//   UI fetch 2 tanggal: prevDate (D-1) dan endDate (D)
//   totalMasukPcs  = masukSetelahPrev  - masukSetelahEnd
//   totalTerjualPcs = keluarSetelahPrev - keluarSetelahEnd
// ============================================================
export async function GET(req: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tanggalParam = searchParams.get("tanggal");

    if (!tanggalParam) {
      return NextResponse.json(
        {
          success: false,
          message: "Parameter 'tanggal' wajib diisi (format: YYYY-MM-DD)",
        },
        { status: 400 },
      );
    }

    const tanggal = new Date(tanggalParam);
    if (isNaN(tanggal.getTime())) {
      return NextResponse.json(
        {
          success: false,
          message: "Format tanggal tidak valid, gunakan YYYY-MM-DD",
        },
        { status: 400 },
      );
    }
    tanggal.setHours(0, 0, 0, 0);

    // Ambil semua snapshot pada tanggal tersebut dari tabel StokHarian
    const stokHarianList = await prisma.stokHarian.findMany({
      where: { tanggal },
      include: {
        barang: {
          select: {
            namaBarang: true,
            jenisKemasan: true,
            jumlahPerKemasan: true,
          },
        },
      },
      orderBy: { barang: { namaBarang: "asc" } },
    });

    // Mapping ke format yang diharapkan UI
    const data = stokHarianList.map((item) => ({
      barangId: item.barangId,
      namaBarang: item.barang?.namaBarang ?? "-",
      jenisKemasan: item.barang?.jenisKemasan ?? "-",
      jumlahPerKemasan: item.barang?.jumlahPerKemasan.toString() ?? "1",
      // Field ini dipakai UI untuk menghitung selisih antar 2 tanggal
      masukSetelahTanggal: item.totalMasuk.toString(),
      keluarSetelahTanggal: item.totalKeluar.toString(),
      stokPadaTanggal: item.stok.toString(),
    }));

    return NextResponse.json({
      success: true,
      tanggal: tanggalParam,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error("[GET /api/stok-harian/historis]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
