import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return Number(value || 0);
}

function parseDate(dateParam: string, endOfDay = false): Date {
  const date = new Date(dateParam);
  if (isNaN(date.getTime())) {
    throw new Error("Tanggal tidak valid");
  }
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

export async function GET(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date") || searchParams.get("tanggal");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (dateParam) {
      startDate = parseDate(dateParam);
      endDate = parseDate(dateParam, true);
    } else if (startDateParam || endDateParam) {
      if (startDateParam) startDate = parseDate(startDateParam);
      if (endDateParam) endDate = parseDate(endDateParam, true);
    }

    const penjualanFilter: any = {
      statusTransaksi: "SELESAI",
      isDeleted: false,
    };

    if (startDate || endDate) {
      penjualanFilter.tanggalTransaksi = {};
      if (startDate) penjualanFilter.tanggalTransaksi.gte = startDate;
      if (endDate) penjualanFilter.tanggalTransaksi.lte = endDate;
    }

    const items = await prisma.penjualanItem.findMany({
      where: {
        penjualan: penjualanFilter,
      },
      include: {
        barang: {
          select: {
            id: true,
            namaBarang: true,
            jenisKemasan: true,
            jumlahPerKemasan: true,
          },
        },
      },
    });

    const barangMap = new Map<
      number,
      {
        barangId: number;
        namaBarang: string;
        jenisKemasan: string;
        jumlahPerKemasan: number;
        totalTerjualPcs: number;
        totalTerjualKemasan: number;
      }
    >();

    for (const item of items) {
      const jumlahPerKemasan = Math.max(
        1,
        toNumber(item.barang.jumlahPerKemasan)
      );
      const totalItemTerjual = toNumber(item.totalItem);
      const totalTerjualKemasan = totalItemTerjual / jumlahPerKemasan;

      if (!barangMap.has(item.barangId)) {
        barangMap.set(item.barangId, {
          barangId: item.barangId,
          namaBarang: item.barang.namaBarang,
          jenisKemasan: item.barang.jenisKemasan,
          jumlahPerKemasan,
          totalTerjualPcs: 0,
          totalTerjualKemasan: 0,
        });
      }

      const row = barangMap.get(item.barangId)!;
      row.totalTerjualPcs += totalItemTerjual;
      row.totalTerjualKemasan += totalTerjualKemasan;
    }

    const data = Array.from(barangMap.values()).sort(
      (a, b) => b.totalTerjualKemasan - a.totalTerjualKemasan
    );

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengambil penjualan barang";
    const status = message === "Tanggal tidak valid" ? 400 : 500;
    console.error("Error fetching barang penjualan:", error);
    return NextResponse.json({ success: false, error: message }, { status });
  } finally {
    await prisma.$disconnect();
  }
}
