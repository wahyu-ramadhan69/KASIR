// app/api/supplier/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

type RouteCtx = {
  params: Promise<{
    id: string;
  }>;
};

function parseId(id: string | undefined) {
  const num = Number(id);
  if (!id || Number.isNaN(num)) return null;
  return num;
}

// (Opsional) GET detail supplier by ID
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
    const supplier = await prisma.supplier.findUnique({
      where: { id: idNum },
      include: {
        barang: true,
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: "Supplier tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: supplier },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching supplier:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengambil data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT / UPDATE supplier
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

    const supplier = await prisma.supplier.update({
      where: { id: idNum },
      data: {
        namaSupplier: String(namaSupplier).trim(),
        alamat: String(alamat).trim(),
        noHp: String(noHp).trim(),
        limitHutang: Number(limitHutang),
        hutang: Number(hutang),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Supplier berhasil diperbarui",
        data: supplier,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating supplier:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat memperbarui supplier" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE supplier
export async function DELETE(_request: NextRequest, { params }: RouteCtx) {
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
    const exist = await prisma.supplier.findUnique({
      where: { id: idNum },
    });

    if (!exist) {
      return NextResponse.json(
        { success: false, error: "Supplier tidak ditemukan" },
        { status: 404 }
      );
    }

    await prisma.supplier.delete({
      where: { id: idNum },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Supplier berhasil dihapus",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat menghapus supplier" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
