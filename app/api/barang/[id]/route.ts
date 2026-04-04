// app/api/barang/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

type RouteCtx = { params: Promise<{ id: string }> };

function bigIntToNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

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
  return !id || Number.isNaN(num) ? null : num;
}

// GET detail barang per ID
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const idNum = parseId(id);
  if (idNum === null)
    return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

  try {
    const barang = await prisma.barang.findUnique({
      where: { id: idNum },
      include: { supplier: true, kategori: true },
    });

    if (!barang || !barang.isActive)
      return NextResponse.json({ success: false, error: "Barang tidak ditemukan" }, { status: 404 });

    return NextResponse.json({ success: true, data: serializeBarang(barang) }, { status: 200 });
  } catch (error) {
    console.error("Error fetching barang:", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// PUT update barang
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const idNum = parseId(id);
  if (idNum === null)
    return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

  try {
    const body = await request.json();
    const {
      namaBarang, hargaBeli, hargaJual, stok, jenisKemasan,
      jumlahPerKemasan, supplierId, berat, limitPenjualan,
      kategoriId, gambar, tampilDiHalaman,
    } = body;

    if (!namaBarang || hargaBeli == null || hargaJual == null ||
        !jenisKemasan || jumlahPerKemasan == null || supplierId == null) {
      return NextResponse.json(
        { success: false, error: "Semua field wajib diisi" },
        { status: 400 }
      );
    }

    const updateData: any = {
      namaBarang: String(namaBarang).trim(),
      hargaBeli: BigInt(hargaBeli),
      hargaJual: BigInt(hargaJual),
      jenisKemasan: String(jenisKemasan).trim(),
      jumlahPerKemasan: BigInt(jumlahPerKemasan),
      supplierId: Number(supplierId),
      kategoriId: kategoriId ? Number(kategoriId) : null,
      gambar: gambar ? String(gambar).trim() : null,
      tampilDiHalaman: tampilDiHalaman === true,
    };

    if (stok != null) updateData.stok = BigInt(stok);
    if (limitPenjualan != null) updateData.limitPenjualan = BigInt(limitPenjualan);
    if (berat != null) updateData.berat = BigInt(berat);

    const barang = await prisma.barang.update({
      where: { id: idNum },
      data: updateData,
      include: { supplier: true, kategori: true },
    });

    return NextResponse.json(
      { success: true, message: "Barang berhasil diperbarui", data: serializeBarang(barang) },
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

// PATCH - Toggle tampilDiHalaman
export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const idNum = parseId(id);
  if (idNum === null)
    return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

  try {
    const body = await request.json();
    const { tampilDiHalaman } = body;

    const barang = await prisma.barang.update({
      where: { id: idNum },
      data: { tampilDiHalaman: Boolean(tampilDiHalaman) },
      include: { supplier: true, kategori: true },
    });

    return NextResponse.json(
      { success: true, message: "Status tampil berhasil diperbarui", data: serializeBarang(barang) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating tampilDiHalaman:", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE Barang (Soft Delete)
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const idNum = parseId(id);
  if (idNum === null)
    return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

  try {
    const barang = await prisma.barang.findUnique({ where: { id: idNum } });
    if (!barang)
      return NextResponse.json({ success: false, error: "Barang tidak ditemukan" }, { status: 404 });

    await prisma.barang.update({ where: { id: idNum }, data: { isActive: false } });

    return NextResponse.json({ success: true, message: "Barang berhasil dihapus" }, { status: 200 });
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
