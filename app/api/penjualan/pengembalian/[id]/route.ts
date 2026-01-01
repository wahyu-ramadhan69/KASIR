import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepSerialize);
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

function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const pengembalianId = Number(id);
    if (!Number.isFinite(pengembalianId)) {
      return NextResponse.json(
        { success: false, error: "ID tidak valid" },
        { status: 400 }
      );
    }

    const pengembalian = await prisma.pengembalianBarang.findUnique({
      where: { id: pengembalianId },
      include: {
        barang: {
          select: {
            id: true,
            namaBarang: true,
            jumlahPerKemasan: true,
            hargaJual: true,
            jenisKemasan: true,
            stok: true,
          },
        },
      },
    });

    if (!pengembalian) {
      return NextResponse.json(
        { success: false, error: "Data pengembalian tidak ditemukan" },
        { status: 404 }
      );
    }

    const roleUpper = authData.role?.toUpperCase();
    const userId = Number(authData.userId);
    const shouldFilterByUser = roleUpper !== "ADMIN" && !Number.isNaN(userId);
    if (shouldFilterByUser && pengembalian.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: deepSerialize(pengembalian),
    });
  } catch (error) {
    console.error("Error fetching pengembalian:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data pengembalian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const pengembalianId = Number(id);
    if (!Number.isFinite(pengembalianId)) {
      return NextResponse.json(
        { success: false, error: "ID tidak valid" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      barangId,
      jumlahDus,
      jumlahPcs,
      kondisiBarang,
      keterangan,
    } = body || {};

    if (!barangId) {
      return NextResponse.json(
        { success: false, error: "Barang wajib dipilih" },
        { status: 400 }
      );
    }

    const jumlahDusNum = Math.max(0, Number(jumlahDus || 0));
    const jumlahPcsNum = Math.max(0, Number(jumlahPcs || 0));
    if (jumlahDusNum === 0 && jumlahPcsNum === 0) {
      return NextResponse.json(
        { success: false, error: "Jumlah barang tidak boleh 0" },
        { status: 400 }
      );
    }

    const kondisi = kondisiBarang as "BAIK" | "RUSAK" | "KADALUARSA";
    if (!["BAIK", "RUSAK", "KADALUARSA"].includes(kondisi)) {
      return NextResponse.json(
        { success: false, error: "Kondisi barang tidak valid" },
        { status: 400 }
      );
    }

    const existing = await prisma.pengembalianBarang.findUnique({
      where: { id: pengembalianId },
      include: {
        barang: {
          select: {
            id: true,
            jumlahPerKemasan: true,
            stok: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Data pengembalian tidak ditemukan" },
        { status: 404 }
      );
    }

    const roleUpper = authData.role?.toUpperCase();
    const userId = Number(authData.userId);
    const shouldFilterByUser = roleUpper !== "ADMIN" && !Number.isNaN(userId);
    if (shouldFilterByUser && existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const barang = await prisma.barang.findUnique({
      where: { id: Number(barangId) },
      select: { id: true, jumlahPerKemasan: true, stok: true },
    });

    if (!barang) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan" },
        { status: 404 }
      );
    }

    const oldPerKemasan = Math.max(1, Number(existing.barang.jumlahPerKemasan));
    const newPerKemasan = Math.max(1, Number(barang.jumlahPerKemasan));

    const oldTotalPcs =
      toNumber(existing.jumlahDus) * oldPerKemasan + toNumber(existing.jumlahPcs);
    const newTotalPcs = jumlahDusNum * newPerKemasan + jumlahPcsNum;

    const stockUpdates: any[] = [];

    if (
      existing.kondisiBarang === "BAIK" &&
      kondisi === "BAIK" &&
      existing.barangId === barang.id
    ) {
      const diff = newTotalPcs - oldTotalPcs;
      const currentStock = toNumber(existing.barang.stok);
      if (diff < 0 && currentStock < Math.abs(diff)) {
        return NextResponse.json(
          { success: false, error: "Stok tidak mencukupi untuk perubahan ini" },
          { status: 400 }
        );
      }
      if (diff > 0) {
        stockUpdates.push(
          prisma.barang.update({
            where: { id: existing.barangId },
            data: { stok: { increment: BigInt(diff) } },
          })
        );
      } else if (diff < 0) {
        stockUpdates.push(
          prisma.barang.update({
            where: { id: existing.barangId },
            data: { stok: { decrement: BigInt(Math.abs(diff)) } },
          })
        );
      }
    } else {
      if (existing.kondisiBarang === "BAIK") {
        const currentStock = toNumber(existing.barang.stok);
        if (currentStock < oldTotalPcs) {
          return NextResponse.json(
            { success: false, error: "Stok tidak mencukupi untuk perubahan ini" },
            { status: 400 }
          );
        }
        stockUpdates.push(
          prisma.barang.update({
            where: { id: existing.barangId },
            data: { stok: { decrement: BigInt(oldTotalPcs) } },
          })
        );
      }

      if (kondisi === "BAIK") {
        stockUpdates.push(
          prisma.barang.update({
            where: { id: barang.id },
            data: { stok: { increment: BigInt(newTotalPcs) } },
          })
        );
      }
    }

    const [updated] = await prisma.$transaction([
      ...stockUpdates,
      prisma.pengembalianBarang.update({
        where: { id: pengembalianId },
        data: {
          barangId: barang.id,
          jumlahDus: BigInt(jumlahDusNum),
          jumlahPcs: BigInt(jumlahPcsNum),
          kondisiBarang: kondisi,
          keterangan: keterangan || null,
        },
        include: {
          barang: {
            select: {
              id: true,
              namaBarang: true,
              jumlahPerKemasan: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Pengembalian berhasil diperbarui",
        data: updated,
      })
    );
  } catch (error) {
    console.error("Error updating pengembalian:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui data pengembalian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const pengembalianId = Number(id);
    if (!Number.isFinite(pengembalianId)) {
      return NextResponse.json(
        { success: false, error: "ID tidak valid" },
        { status: 400 }
      );
    }

    const existing = await prisma.pengembalianBarang.findUnique({
      where: { id: pengembalianId },
      include: {
        barang: {
          select: {
            id: true,
            jumlahPerKemasan: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Data pengembalian tidak ditemukan" },
        { status: 404 }
      );
    }

    const roleUpper = authData.role?.toUpperCase();
    const userId = Number(authData.userId);
    const shouldFilterByUser = roleUpper !== "ADMIN" && !Number.isNaN(userId);
    if (shouldFilterByUser && existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const jumlahPerDus = toNumber(existing.barang?.jumlahPerKemasan);
    const totalPcs = Math.max(
      0,
      toNumber(existing.jumlahDus) * jumlahPerDus + toNumber(existing.jumlahPcs)
    );

    const stockUpdates: any[] = [];
    if (existing.kondisiBarang === "BAIK" && totalPcs > 0) {
      stockUpdates.push(
        prisma.barang.update({
          where: { id: existing.barangId },
          data: { stok: { decrement: BigInt(totalPcs) } },
        })
      );
    }

    await prisma.$transaction([
      ...stockUpdates,
      prisma.pengembalianBarang.delete({ where: { id: pengembalianId } }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Pengembalian berhasil dihapus",
    });
  } catch (error) {
    console.error("Error deleting pengembalian:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus data pengembalian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
