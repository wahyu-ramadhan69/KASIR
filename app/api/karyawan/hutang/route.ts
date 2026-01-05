import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
      totalPinjaman: { gt: 0 },
    };

    if (search) {
      where.OR = [
        { nama: { contains: search, mode: "insensitive" } },
        { nik: { contains: search, mode: "insensitive" } },
      ];
    }

    const totalCount = await prisma.karyawan.count({ where });
    const karyawan = await prisma.karyawan.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      success: true,
      data: karyawan,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data hutang karyawan" },
      { status: 500 }
    );
  }
}
