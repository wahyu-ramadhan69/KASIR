// app/api/supplier/route.ts
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

// Helper to serialize supplier data with BigInt conversion
function serializeSupplier(supplier: any) {
  return {
    ...supplier,
    limitHutang: bigIntToNumber(supplier.limitHutang),
    hutang: bigIntToNumber(supplier.hutang),
    barang: supplier.barang?.map((b: any) => ({
      ...b,
      hargaBeli: bigIntToNumber(b.hargaBeli),
      hargaJual: bigIntToNumber(b.hargaJual),
      stok: bigIntToNumber(b.stok),
    })),
  };
}

export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { namaSupplier, alamat, noHp, limitHutang, hutang } = body;

    if (
      !namaSupplier ||
      !alamat ||
      !noHp ||
      limitHutang == null ||
      hutang == null
    ) {
      return NextResponse.json(
        { success: false, error: "Semua field harus diisi" },
        { status: 400 }
      );
    }

    // ✅ Parse ke BigInt
    const supplier = await prisma.supplier.create({
      data: {
        namaSupplier: namaSupplier.trim(),
        alamat: alamat.trim(),
        noHp: noHp.trim(),
        limitHutang: BigInt(limitHutang),
        hutang: BigInt(hutang),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Supplier berhasil ditambahkan",
        data: serializeSupplier(supplier),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating supplier:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Terjadi kesalahan saat menambahkan supplier",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { id: "desc" },
      include: {
        barang: { where: { isActive: true } },
      },
    });

    // ✅ Convert BigInt ke number untuk JSON response
    const serializedSuppliers = suppliers.map(serializeSupplier);

    return NextResponse.json(
      {
        success: true,
        data: serializedSuppliers,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching supplier:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Terjadi kesalahan saat mengambil data supplier",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
