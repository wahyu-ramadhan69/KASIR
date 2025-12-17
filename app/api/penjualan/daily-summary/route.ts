import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Serialize nested BigInt values safely for JSON
function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepSerialize);
  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = deepSerialize(obj[key]);
      }
    }
    return serialized;
  }
  return obj;
}

// GET: ringkasan total penjualan harian (semua kasir/sales) per barang
export async function GET(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    if (!dateParam) {
      return NextResponse.json(
        { success: false, error: "Parameter date diperlukan" },
        { status: 400 }
      );
    }

    const startDate = new Date(dateParam);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(dateParam);
    endDate.setHours(23, 59, 59, 999);

    const penjualan = await prisma.penjualanHeader.findMany({
      where: {
        tanggalTransaksi: {
          gte: startDate,
          lte: endDate,
        },
        statusTransaksi: "SELESAI",
      },
      include: {
        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    const summary: Record<number, number> = {};

    penjualan.forEach((header) => {
      header.items.forEach((item) => {
        const barangId = item.barangId;
        const jumlahDus = Number(item.jumlahDus);
        const jumlahPcs = Number(item.jumlahPcs);
        const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan);
        const totalPcs = jumlahDus * jumlahPerKemasan + jumlahPcs;

        summary[barangId] = (summary[barangId] || 0) + totalPcs;
      });
    });

    // Tambahkan terjual dari manifest perjalanan (jika ada update hari ini)
    const manifestTerjual = await prisma.manifestBarang.findMany({
      where: {
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
        jumlahTerjual: {
          gt: BigInt(0),
        },
      },
      include: {
        barang: {
          select: { jumlahPerKemasan: true },
        },
      },
    });

    manifestTerjual.forEach((m) => {
      const barangId = m.barangId;
      const totalPcs = Number(m.jumlahTerjual);
      summary[barangId] = (summary[barangId] || 0) + totalPcs;
    });

    // Tambahkan penyaluran/penjualan dari manifest perjalanan pada tanggal yang sama
    const manifestData = await prisma.manifestBarang.findMany({
      where: {
        perjalanan: {
          tanggalBerangkat: {
            gte: startDate,
            lte: endDate,
          },
          statusPerjalanan: { not: "DIBATALKAN" },
        },
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    manifestData.forEach((m) => {
      const barangId = m.barangId;
      const totalPcs =
        Number(m.jumlahTerjual) + Number(m.totalItem); // total dialokasikan di manifest hari itu
      summary[barangId] = (summary[barangId] || 0) + totalPcs;
    });

    const summaryArray = Object.entries(summary).map(
      ([barangId, totalTerjual]) => ({
        barangId: Number(barangId),
        totalTerjual,
      })
    );

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: summaryArray,
      })
    );
  } catch (error) {
    console.error("Error fetching penjualan harian:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil ringkasan penjualan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
