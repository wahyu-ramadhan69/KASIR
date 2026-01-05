import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Utility functions
function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepSerialize);
  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = deepSerialize(obj[key]);
      }
    }
    return serialized;
  }
  return obj;
}

function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Date filter dengan range
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      where.tanggalInput = {
        gte: start,
        lte: end,
      };
    } else if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      where.tanggalInput = { gte: start };
    } else if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.tanggalInput = { lte: end };
    }

    // Search filter
    if (search) {
      where.OR = [
        { namaPengeluaran: { contains: search, mode: "insensitive" } },
        { keterangan: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count
    const totalCount = await prisma.pengeluaran.count({ where });

    // Get paginated data
    const pengeluaranList = await prisma.pengeluaran.findMany({
      where,
      skip,
      take: limit,
      orderBy: { tanggalInput: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Calculate stats for current page
    let totalPengeluaran = 0;

    pengeluaranList.forEach((pengeluaran) => {
      totalPengeluaran += toNumber(pengeluaran.jumlah);
    });

    // Calculate stats for all data (filtered)
    const allPengeluaran = await prisma.pengeluaran.findMany({
      where,
    });

    let totalPengeluaranAll = 0;

    allPengeluaran.forEach((pengeluaran) => {
      totalPengeluaranAll += toNumber(pengeluaran.jumlah);
    });

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: pengeluaranList,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasMore,
        },
        stats: {
          // Stats untuk page ini
          currentPage: {
            totalPengeluaran,
            jumlahItem: pengeluaranList.length,
          },
          // Stats keseluruhan (filtered)
          overall: {
            totalPengeluaran: totalPengeluaranAll,
            jumlahTransaksi: allPengeluaran.length,
          },
        },
      })
    );
  } catch (error) {
    console.error("Error fetching pengeluaran:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch pengeluaran data" },
      { status: 500 }
    );
  }
}
