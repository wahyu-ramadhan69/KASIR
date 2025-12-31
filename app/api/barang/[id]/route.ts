// app/api/barang/[id]/route.ts
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

// Helper to serialize barang data with BigInt conversion
function serializeBarang(barang: any) {
  return {
    ...barang,
    hargaBeli: bigIntToNumber(barang.hargaBeli),
    hargaJual: bigIntToNumber(barang.hargaJual),
    stok: bigIntToNumber(barang.stok),
    jumlahPerKemasan: bigIntToNumber(barang.jumlahPerKemasan),
    berat: bigIntToNumber(barang.berat),
    limitStok: bigIntToNumber(barang.limitStok),
    limitPenjualan: bigIntToNumber(barang.limitPenjualan),
    supplier: barang.supplier
      ? {
          ...barang.supplier,
          limitHutang: bigIntToNumber(barang.supplier.limitHutang),
          hutang: bigIntToNumber(barang.supplier.hutang),
        }
      : undefined,
  };
}

function parseId(id: string | undefined) {
  const num = Number(id);
  if (!id || Number.isNaN(num)) return null;
  return num;
}

// GET detail barang per ID
export async function GET(_req: NextRequest, { params }: RouteCtx) {
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
    const barang = await prisma.barang.findUnique({
      where: { id: idNum },
      include: { supplier: true },
    });

    if (!barang || barang.isActive === false) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: serializeBarang(barang) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching barang:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengambil data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// UPDATE / EDIT Barang
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
    const {
      namaBarang,
      hargaBeli,
      hargaJual,
      stok,
      jenisKemasan,
      jumlahPerKemasan,
      supplierId,
      berat,
      limitPenjualan,
    } = body;

    if (
      !namaBarang ||
      hargaBeli == null ||
      hargaJual == null ||
      !jenisKemasan ||
      jumlahPerKemasan == null ||
      supplierId == null
    ) {
      return NextResponse.json(
        { success: false, error: "Semua field wajib diisi" },
        { status: 400 }
      );
    }

    // Convert to BigInt for database
    const updateData: any = {
      namaBarang: String(namaBarang).trim(),
      hargaBeli: BigInt(hargaBeli),
      hargaJual: BigInt(hargaJual),
      jenisKemasan: String(jenisKemasan).trim(),
      jumlahPerKemasan: BigInt(jumlahPerKemasan),
      supplierId: Number(supplierId),
    };

    // Hanya update stok jika dikirim; kalau tidak, biarkan nilai sebelumnya
    if (stok != null) {
      updateData.stok = BigInt(stok);
    }

    // Update limitPenjualan jika dikirim
    if (limitPenjualan != null) {
      updateData.limitPenjualan = BigInt(limitPenjualan);
    }

    if (berat != null) {
      updateData.berat = BigInt(berat);
    }

    const barang = await prisma.barang.update({
      where: { id: idNum },
      data: updateData,
      include: {
        supplier: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Barang berhasil diperbarui",
        data: serializeBarang(barang),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating barang:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat memperbarui barang" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE Barang (Soft Delete)
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
    // Cek apakah barang ada
    const barang = await prisma.barang.findUnique({
      where: { id: idNum },
    });

    if (!barang) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan" },
        { status: 404 }
      );
    }

    // Soft delete - set isActive to false
    await prisma.barang.update({
      where: { id: idNum },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Barang berhasil dihapus",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting barang:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat menghapus barang" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
