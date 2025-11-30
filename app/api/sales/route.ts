import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Helper function to convert BigInt to number safely
function bigIntToNumber(value: bigint | number): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

// Helper to serialize sales data with BigInt conversion
function serializeSales(sales: any) {
  return {
    ...sales,
    limitHutang: bigIntToNumber(sales.limitHutang),
    hutang: bigIntToNumber(sales.hutang),
  };
}

export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { nik, namaSales, alamat, noHp, limitHutang, hutang } = body;

    if (!nik || !namaSales || !alamat || !noHp) {
      return NextResponse.json(
        { success: false, error: "Semua field wajib harus diisi" },
        { status: 400 }
      );
    }

    // CEK JIKA NIK SUDAH TERDAFTAR
    const exist = await prisma.sales.findUnique({
      where: { nik },
    });

    if (exist) {
      return NextResponse.json(
        { success: false, error: "NIK sudah terdaftar" },
        { status: 400 }
      );
    }

    // Convert to BigInt for database
    const limitHutangValue = limitHutang ? BigInt(limitHutang) : BigInt(0);
    const hutangValue = hutang ? BigInt(hutang) : BigInt(0);

    const sales = await prisma.sales.create({
      data: {
        nik,
        namaSales,
        alamat,
        noHp,
        limitHutang: limitHutangValue,
        hutang: hutangValue,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Sales berhasil ditambahkan",
        data: serializeSales(sales),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creating sales:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat membuat sales" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET sales with pagination
export async function GET(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const skip = (page - 1) * limit;

    // Get total count
    const totalCount = await prisma.sales.count();

    // Get sales with pagination
    const sales = await prisma.sales.findMany({
      where: { isActive: true },
      orderBy: { id: "desc" },
      skip,
      take: limit,
    });

    // Serialize all sales to convert BigInt to number
    const serializedSales = sales.map(serializeSales);

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      success: true,
      data: serializedSales,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasMore,
      },
    });
  } catch (err) {
    console.error("Error fetching sales:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengambil data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
