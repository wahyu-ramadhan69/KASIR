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

// Helper to serialize customer data with BigInt conversion
function serializeCustomer(customer: any) {
  return {
    ...customer,
    limit_piutang: bigIntToNumber(customer.limit_piutang),
    piutang: bigIntToNumber(customer.piutang),
  };
}

export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { nik, nama, alamat, namaToko, noHp, limit_piutang, piutang } = body;

    if (!nik || !nama || !alamat || !namaToko || !noHp) {
      return NextResponse.json(
        { success: false, error: "Semua field wajib harus diisi" },
        { status: 400 }
      );
    }

    // CEK JIKA NIK SUDAH TERDAFTAR
    const exist = await prisma.customer.findUnique({
      where: { nik },
    });

    if (exist) {
      return NextResponse.json(
        { success: false, error: "NIK sudah terdaftar" },
        { status: 400 }
      );
    }

    // Convert to BigInt for database
    const limitPiutang = limit_piutang ? BigInt(limit_piutang) : BigInt(0);
    const piutangValue = piutang ? BigInt(piutang) : BigInt(0);

    const customer = await prisma.customer.create({
      data: {
        nik,
        nama,
        alamat,
        namaToko,
        noHp,
        limit_piutang: limitPiutang,
        piutang: piutangValue,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Customer berhasil ditambahkan",
        data: serializeCustomer(customer),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creating customer:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat membuat customer" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET customers with pagination
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
    const totalCount = await prisma.customer.count();

    // Get customers with pagination
    const customers = await prisma.customer.findMany({
      orderBy: { id: "desc" },
      skip,
      take: limit,
    });

    // Serialize all customers to convert BigInt to number
    const serializedCustomers = customers.map(serializeCustomer);

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      success: true,
      data: serializedCustomers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasMore,
      },
    });
  } catch (err) {
    console.error("Error fetching customers:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengambil data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
