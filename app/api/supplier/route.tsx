// app/api/supplier/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Helper function to convert BigInt to number safely
function bigIntToNumber(value: any): number {
  if (value == null) return 0;
  if (typeof value === "bigint") {
    return Number(value);
  }
  return Number(value);
}

// Deep serialize to handle all BigInt in nested objects
function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return Number(obj);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSerialize);
  }

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

    const supplier = await prisma.supplier.create({
      data: {
        namaSupplier: namaSupplier.trim(),
        alamat: alamat.trim(),
        noHp: noHp.trim(),
        limitHutang: BigInt(limitHutang),
        hutang: BigInt(hutang),
      },
      include: {
        barang: { where: { isActive: true } },
      },
    });

    // Deep serialize to convert all BigInt
    const serialized = deepSerialize(supplier);

    return NextResponse.json(
      {
        success: true,
        message: "Supplier berhasil ditambahkan",
        data: serialized,
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

    // Deep serialize to convert ALL BigInt fields recursively
    const serialized = deepSerialize(suppliers);

    return NextResponse.json(
      {
        success: true,
        data: serialized,
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
