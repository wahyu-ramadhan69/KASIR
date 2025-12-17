// app/api/supplier/search/[keyword]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Helper BigInt → Number
function bigIntToNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

// Serialize supplier
function serializeSupplier(supplier: any) {
  return {
    ...supplier,
    limitHutang: bigIntToNumber(supplier.limitHutang),
    hutang: bigIntToNumber(supplier.hutang),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ keyword: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keyword } = await params;

  if (!keyword || keyword.trim() === "") {
    return NextResponse.json(
      {
        success: false,
        error: "Keyword pencarian supplier tidak boleh kosong",
      },
      { status: 400 }
    );
  }

  try {
    const suppliers = await prisma.supplier.findMany({
      where: {
        namaSupplier: {
          contains: keyword,
          mode: "insensitive",
        },
        isActive: true,
      },
      orderBy: { id: "desc" },
    });

    const serializedData = suppliers.map(serializeSupplier);

    return NextResponse.json(
      {
        success: true,
        keyword,
        count: suppliers.length,
        data: serializedData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error searching supplier:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mencari supplier" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
