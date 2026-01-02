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

// Helper to serialize sales data with conversion
function serializeSales(karyawan: any) {
  const totalPinjaman = bigIntToNumber(karyawan.totalPinjaman || 0);
  return {
    id: karyawan.id,
    namaSales: karyawan.nama,
    nik: karyawan.nik,
    alamat: karyawan.alamat,
    noHp: karyawan.noHp,
    limitHutang: totalPinjaman,
    hutang: totalPinjaman,
    isActive: karyawan.isActive,
    createdAt: karyawan.createdAt,
    updatedAt: karyawan.updatedAt,
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
    const exist = await prisma.karyawan.findUnique({
      where: { nik },
    });

    if (exist) {
      return NextResponse.json(
        { success: false, error: "NIK sudah terdaftar" },
        { status: 400 }
      );
    }

    // Convert to BigInt for database
    const hutangValue = hutang ? Number(hutang) : 0;
    const limitHutangValue = limitHutang ? Number(limitHutang) : 0;
    const totalPinjamanValue =
      hutangValue > 0 ? hutangValue : limitHutangValue;

    const sales = await prisma.karyawan.create({
      data: {
        nik,
        nama: namaSales,
        alamat,
        noHp,
        jenis: "SALES",
        gajiPokok: 0,
        tunjanganMakan: 0,
        totalPinjaman: totalPinjamanValue,
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
    const totalCount = await prisma.karyawan.count({
      where: { jenis: "SALES", isActive: true },
    });

    // Get sales with pagination
    const sales = await prisma.karyawan.findMany({
      where: { jenis: "SALES", isActive: true },
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
