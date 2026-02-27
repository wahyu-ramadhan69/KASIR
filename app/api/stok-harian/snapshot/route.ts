import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated, getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// ============================================================
// GET /api/stok-harian?tanggal=2025-01-30
// GET /api/stok-harian?tanggal=2025-01-30&barangId=1
// Ambil data snapshot stok pada tanggal tertentu
// ============================================================
export async function GET(req: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Ambil snapshot 1 barang
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
            message: `Belum ada snapshot untuk barangId ${barangId} pada tanggal ${tanggalParam}`,
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        tanggal: tanggalParam,
        data: serializeStokHarian(stokHarian),
      });
    }

    // Ambil snapshot semua barang
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
      data: stokHarianList.map(serializeStokHarian),
    });
  } catch (error) {
    console.error("[GET /api/stok-harian]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================
// POST /api/stok-harian
// Body (opsional): { "tanggal": "2025-01-30" } — default hari ini
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ambil data user untuk log siapa yang menjalankan snapshot
    const userData = await getAuthData();

    // Opsional: batasi hanya role tertentu
    // if (userData?.role !== "ADMIN") {
    //   return NextResponse.json(
    //     { error: "Hanya admin yang boleh menjalankan snapshot" },
    //     { status: 403 }
    //   );
    // }

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

    // Ambil semua barang aktif
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

    // Hitung totalMasuk & totalKeluar per barang di hari tersebut
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

    // Upsert semua dalam 1 transaksi database
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
      dijalankanOleh: userData?.username ?? "sistem",
      totalSnapshot: snapshotData.length,
    });
  } catch (error) {
    console.error("[POST /api/stok-harian]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================
// Helper: serialize BigInt ke string untuk JSON response
// ============================================================
function serializeStokHarian(item: any) {
  return {
    ...item,
    stok: item.stok.toString(),
    totalMasuk: item.totalMasuk.toString(),
    totalKeluar: item.totalKeluar.toString(),
    barang: item.barang
      ? {
          ...item.barang,
          jumlahPerKemasan: item.barang.jumlahPerKemasan.toString(),
        }
      : null,
  };
}
