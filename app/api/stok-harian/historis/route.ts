import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// GET /api/stok-historis?tanggal=2025-01-30
// GET /api/stok-historis?tanggal=2025-01-30&barangId=1
//
// Menghitung stok pada tanggal tertentu secara langsung
// tanpa perlu tabel snapshot StokHarian.
//
// Rumus:
// stokPadaTanggal = stokSekarang
//                 - total pembelian SETELAH tanggal X
//                 + total penjualan SETELAH tanggal X
// ============================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tanggalParam = searchParams.get("tanggal");
    const barangIdParam = searchParams.get("barangId");

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
          message: "Format tanggal tidak valid, gunakan format YYYY-MM-DD",
        },
        { status: 400 },
      );
    }

    // Batas akhir hari tanggal yang dicari
    const endOfDay = new Date(tanggal);
    endOfDay.setHours(23, 59, 59, 999);

    // Hitung stok 1 barang saja jika barangId ada
    if (barangIdParam) {
      const barangId = parseInt(barangIdParam);
      if (isNaN(barangId)) {
        return NextResponse.json(
          { success: false, message: "barangId harus berupa angka" },
          { status: 400 },
        );
      }

      const result = await hitungStokHistoris({ barangId, endOfDay });

      if (!result) {
        return NextResponse.json(
          {
            success: false,
            message: `Barang dengan id ${barangId} tidak ditemukan`,
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        tanggal: tanggalParam,
        data: result,
      });
    }

    // Hitung semua barang aktif
    const semuaBarang = await prisma.barang.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const results = await Promise.all(
      semuaBarang.map((b) => hitungStokHistoris({ barangId: b.id, endOfDay })),
    );

    const data = results.filter(Boolean);

    return NextResponse.json({
      success: true,
      tanggal: tanggalParam,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error("[GET /api/stok-historis]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 },
    );
  }
}

// ============================================================
// Helper: hitung stok historis 1 barang
// ============================================================
async function hitungStokHistoris({
  barangId,
  endOfDay,
}: {
  barangId: number;
  endOfDay: Date;
}) {
  const barang = await prisma.barang.findUnique({
    where: { id: barangId },
    select: {
      id: true,
      namaBarang: true,
      jenisKemasan: true,
      jumlahPerKemasan: true,
      stok: true,
    },
  });

  if (!barang) return null;

  // Pembelian (MASUK) setelah tanggal yang dicari
  const pembelianSetelah = await prisma.pembelianItem.aggregate({
    where: {
      barangId,
      pembelian: {
        statusTransaksi: "SELESAI",
        createdAt: { gt: endOfDay },
      },
    },
    _sum: { totalItem: true },
  });

  // Penjualan (KELUAR) setelah tanggal yang dicari
  const penjualanSetelah = await prisma.penjualanItem.aggregate({
    where: {
      barangId,
      penjualan: {
        statusTransaksi: "SELESAI",
        isDeleted: false,
        tanggalTransaksi: { gt: endOfDay },
      },
    },
    _sum: { totalItem: true },
  });

  const stokSekarang = barang.stok;
  const masukSetelah = pembelianSetelah._sum?.totalItem ?? BigInt(0);
  const keluarSetelah = penjualanSetelah._sum?.totalItem ?? BigInt(0);

  // stokHistoris = stokSekarang - masukSetelah + keluarSetelah
  const stokHistoris = stokSekarang - masukSetelah + keluarSetelah;

  return {
    barangId: barang.id,
    namaBarang: barang.namaBarang,
    jenisKemasan: barang.jenisKemasan,
    jumlahPerKemasan: barang.jumlahPerKemasan.toString(),
    stokSekarang: stokSekarang.toString(),
    masukSetelahTanggal: masukSetelah.toString(),
    keluarSetelahTanggal: keluarSetelah.toString(),
    stokPadaTanggal: stokHistoris.toString(),
  };
}
