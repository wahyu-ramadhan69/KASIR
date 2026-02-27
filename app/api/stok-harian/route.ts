import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated, getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// ============================================================
// Helper: buat range start/end hari dalam WIB → UTC
// Karena DB menyimpan waktu UTC, sedangkan transaksi dibuat WIB.
// WIB = UTC+7, jadi:
//   WIB 2026-02-27 00:00:00 = UTC 2026-02-26 17:00:00
//   WIB 2026-02-27 23:59:59 = UTC 2026-02-27 16:59:59
// ============================================================
function getWibDayRange(tanggalStr: string): {
  startOfDay: Date;
  endOfDay: Date;
} {
  const startOfDay = new Date(`${tanggalStr}T00:00:00+07:00`);
  const endOfDay = new Date(`${tanggalStr}T23:59:59.999+07:00`);
  return { startOfDay, endOfDay };
}

// ============================================================
// Helper: ambil tanggal WIB hari ini sebagai string YYYY-MM-DD
// ============================================================
function getTodayWib(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split("T")[0];
}

// ============================================================
// GET /api/stok-harian?tanggal=2026-02-27
// GET /api/stok-harian?tanggal=2026-02-27&barangId=1
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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalParam)) {
      return NextResponse.json(
        {
          success: false,
          message: "Format tanggal tidak valid, gunakan YYYY-MM-DD",
        },
        { status: 400 },
      );
    }

    // StokHarian.tanggal adalah @db.Date — disimpan sebagai UTC midnight
    const tanggal = new Date(`${tanggalParam}T00:00:00.000Z`);

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
// Body (opsional): { "tanggal": "2026-02-27" } — default hari ini (WIB)
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userData = await getAuthData();

    const body = await req.json().catch(() => ({}));
    const tanggalParam: string | undefined = body.tanggal;

    // Default ke hari ini dalam WIB (bukan UTC)
    const tanggalStr = tanggalParam ?? getTodayWib();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalStr)) {
      return NextResponse.json(
        {
          success: false,
          message: "Format tanggal tidak valid, gunakan YYYY-MM-DD",
        },
        { status: 400 },
      );
    }

    // ✅ FIX UTAMA: range transaksi mengikuti WIB, bukan UTC
    // Contoh tanggal 2026-02-27 WIB:
    //   startOfDay = 2026-02-26T17:00:00.000Z  (UTC)
    //   endOfDay   = 2026-02-27T16:59:59.999Z  (UTC)
    // Ini menangkap transaksi seperti PJ-20260227-0032 yang tersimpan
    // sebagai 2026-02-26 23:18 UTC (= 2026-02-27 06:18 WIB)
    const { startOfDay, endOfDay } = getWibDayRange(tanggalStr);

    // Field tanggal di StokHarian (@db.Date) disimpan sebagai UTC midnight
    const tanggalSnapshot = new Date(`${tanggalStr}T00:00:00.000Z`);

    console.log(`[Snapshot] Tanggal WIB  : ${tanggalStr}`);
    console.log(`[Snapshot] Start UTC    : ${startOfDay.toISOString()}`);
    console.log(`[Snapshot] End UTC      : ${endOfDay.toISOString()}`);

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
          // Pembelian: pakai createdAt (PembelianHeader tidak punya tanggalTransaksi)
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

          // Penjualan: pakai tanggalTransaksi (field khusus, bukan createdAt)
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
          tanggal: tanggalSnapshot,
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

    const totalKeluar = snapshotData.reduce(
      (sum, d) => sum + Number(d.totalKeluar),
      0,
    );
    const totalMasuk = snapshotData.reduce(
      (sum, d) => sum + Number(d.totalMasuk),
      0,
    );

    return NextResponse.json({
      success: true,
      message: `Snapshot stok berhasil untuk tanggal ${tanggalStr} (WIB)`,
      tanggal: tanggalStr,
      rangeUtc: {
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString(),
      },
      dijalankanOleh: userData?.username ?? "sistem",
      totalSnapshot: snapshotData.length,
      ringkasan: { totalMasuk, totalKeluar },
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
