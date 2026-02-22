import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// GET /api/stok-harian?tanggal=2025-01-30
// GET /api/stok-harian?tanggal=2025-01-30&barangId=1
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

    tanggal.setHours(0, 0, 0, 0);

    if (barangIdParam) {
      const barangId = parseInt(barangIdParam);
      if (isNaN(barangId)) {
        return NextResponse.json(
          { success: false, message: "barangId harus berupa angka" },
          { status: 400 },
        );
      }

      const stokHarian = await prisma.stokHarian.findUnique({
        where: { barangId_tanggal: { barangId, tanggal } },
        include: {
          barang: {
            select: {
              namaBarang: true,
              jenisKemasan: true,
              jumlahPerKemasan: true,
            },
          },
        },
      });

      if (!stokHarian) {
        return NextResponse.json(
          {
            success: false,
            message: `Tidak ada snapshot stok untuk barangId ${barangId} pada tanggal ${tanggalParam}`,
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        tanggal: tanggalParam,
        data: {
          ...stokHarian,
          stok: stokHarian.stok.toString(),
          totalMasuk: stokHarian.totalMasuk.toString(),
          totalKeluar: stokHarian.totalKeluar.toString(),
        },
      });
    }

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

    return NextResponse.json({
      success: true,
      tanggal: tanggalParam,
      total: stokHarianList.length,
      data: stokHarianList.map((item) => ({
        ...item,
        stok: item.stok.toString(),
        totalMasuk: item.totalMasuk.toString(),
        totalKeluar: item.totalKeluar.toString(),
      })),
    });
  } catch (error) {
    console.error("[GET /api/stok-harian]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 },
    );
  }
}

// ============================================================
// POST /api/stok-harian
// Header: Authorization: Bearer <CRON_SECRET>
// Body (opsional): { "tanggal": "2025-01-30" } — default hari ini
//
// Digunakan oleh cron job untuk snapshot stok harian
// Crontab: 59 23 * * * curl -X POST http://localhost:3000/api/stok-harian
//          -H "Authorization: Bearer <secret>"
//          -H "Content-Type: application/json"
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const tanggalParam: string | undefined = body.tanggal;

    const tanggal = tanggalParam ? new Date(tanggalParam) : new Date();
    tanggal.setHours(0, 0, 0, 0);

    if (isNaN(tanggal.getTime())) {
      return NextResponse.json(
        { success: false, message: "Format tanggal tidak valid" },
        { status: 400 },
      );
    }

    const startOfDay = new Date(tanggal);
    const endOfDay = new Date(tanggal);
    endOfDay.setHours(23, 59, 59, 999);

    const semuaBarang = await prisma.barang.findMany({
      where: { isActive: true },
      select: { id: true, stok: true },
    });

    if (semuaBarang.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada barang aktif",
        totalSnapshot: 0,
      });
    }

    const snapshotData = await Promise.all(
      semuaBarang.map(async (barang) => {
        const [masuk, keluar] = await Promise.all([
          prisma.pembelianItem.aggregate({
            where: {
              barangId: barang.id,
              pembelian: {
                statusTransaksi: "SELESAI",
                createdAt: { gte: startOfDay, lte: endOfDay },
              },
            },
            _sum: { totalItem: true },
          }),
          prisma.penjualanItem.aggregate({
            where: {
              barangId: barang.id,
              penjualan: {
                statusTransaksi: "SELESAI",
                isDeleted: false,
                tanggalTransaksi: { gte: startOfDay, lte: endOfDay },
              },
            },
            _sum: { totalItem: true },
          }),
        ]);

        return {
          barangId: barang.id,
          tanggal,
          stok: barang.stok,
          totalMasuk: masuk._sum?.totalItem ?? BigInt(0),
          totalKeluar: keluar._sum?.totalItem ?? BigInt(0),
        };
      }),
    );

    await prisma.$transaction(
      snapshotData.map((d) =>
        prisma.stokHarian.upsert({
          where: {
            barangId_tanggal: { barangId: d.barangId, tanggal: d.tanggal },
          },
          update: {
            stok: d.stok,
            totalMasuk: d.totalMasuk,
            totalKeluar: d.totalKeluar,
          },
          create: d,
        }),
      ),
    );

    return NextResponse.json({
      success: true,
      message: `Snapshot stok berhasil untuk tanggal ${tanggal.toISOString().split("T")[0]}`,
      totalSnapshot: snapshotData.length,
    });
  } catch (error) {
    console.error("[POST /api/stok-harian]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 },
    );
  }
}
