import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

type RouteCtx = {
  params: Promise<{ id: string }>;
};

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

function parseId(id: string | undefined) {
  const num = Number(id);
  if (!id || Number.isNaN(num)) return null;
  return num;
}

// GET detail sales
export async function GET(_request: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const idNum = parseId(id);

  if (idNum === null) {
    return NextResponse.json(
      { success: false, error: "ID tidak valid" },
      { status: 400 }
    );
  }

  try {
    const sales = await prisma.sales.findUnique({
      where: { id: idNum },
    });

    if (!sales) {
      return NextResponse.json(
        { success: false, error: "Sales tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeSales(sales),
    });
  } catch (err) {
    console.error("Error fetching sales:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(request: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const idNum = parseId(id);

  if (idNum === null) {
    return NextResponse.json(
      { success: false, error: "ID tidak valid" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { nik, namaSupplier, alamat, noHp, limitHutang, hutang } = body;

    // CEK APAKAH SALES ADA
    const current = await prisma.sales.findUnique({
      where: { id: idNum },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, error: "Sales tidak ditemukan" },
        { status: 404 }
      );
    }

    // CEK JIKA NIK DIGUNAKAN SALES LAIN
    if (nik && nik !== current.nik) {
      const nikExist = await prisma.sales.findUnique({
        where: { nik },
      });

      if (nikExist) {
        return NextResponse.json(
          { success: false, error: "NIK sudah terdaftar" },
          { status: 400 }
        );
      }
    }

    // Build update data object with BigInt conversion
    const updateData: {
      nik?: string;
      namaSupplier?: string;
      alamat?: string;
      noHp?: string;
      limitHutang?: bigint;
      hutang?: bigint;
    } = {};

    if (nik !== undefined) updateData.nik = nik;
    if (namaSupplier !== undefined) updateData.namaSupplier = namaSupplier;
    if (alamat !== undefined) updateData.alamat = alamat;
    if (noHp !== undefined) updateData.noHp = noHp;
    if (limitHutang !== undefined) updateData.limitHutang = BigInt(limitHutang);
    if (hutang !== undefined) updateData.hutang = BigInt(hutang);

    const updated = await prisma.sales.update({
      where: { id: idNum },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Sales berhasil diperbarui",
      data: serializeSales(updated),
    });
  } catch (err) {
    console.error("Error updating sales:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui sales" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE sales
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const idNum = parseId(id);

  if (idNum === null) {
    return NextResponse.json(
      { success: false, error: "ID tidak valid" },
      { status: 400 }
    );
  }

  try {
    await prisma.sales.update({
      where: { id: idNum },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Sales berhasil dihapus",
    });
  } catch (err) {
    console.error("Error deleting sales:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus sales" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
