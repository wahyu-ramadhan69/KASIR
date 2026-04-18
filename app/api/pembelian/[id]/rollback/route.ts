import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function bigIntToNumber(value: any): number {
  if (value == null) return 0;
  if (typeof value === "bigint") return Number(value);
  return Number(value);
}

async function recalculateSupplierHutang(tx: any, supplierId: number) {
  const pembelianHutang = await tx.pembelianHeader.findMany({
    where: {
      supplierId,
      statusTransaksi: "SELESAI",
      statusPembayaran: "HUTANG",
    },
    select: {
      totalHarga: true,
      jumlahDibayar: true,
    },
  });

  const totalHutang = pembelianHutang.reduce((sum: number, pb: any) => {
    return sum + (bigIntToNumber(pb.totalHarga) - bigIntToNumber(pb.jumlahDibayar));
  }, 0);

  await tx.supplier.update({
    where: { id: supplierId },
    data: { hutang: BigInt(Math.max(0, totalHutang)) },
  });
}

// POST: Rollback pembelian yang sudah SELESAI
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const pembelianId = parseInt(id);

    if (isNaN(pembelianId)) {
      return NextResponse.json(
        { success: false, error: "ID pembelian tidak valid" },
        { status: 400 }
      );
    }

    const pembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
      include: {
        items: {
          include: { barang: true },
        },
      },
    });

    if (!pembelian) {
      return NextResponse.json(
        { success: false, error: "Pembelian tidak ditemukan" },
        { status: 404 }
      );
    }

    if (pembelian.statusTransaksi !== "SELESAI") {
      return NextResponse.json(
        { success: false, error: "Hanya pembelian dengan status SELESAI yang bisa di-rollback" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Kembalikan stok barang
      for (const item of pembelian.items) {
        const totalItem = bigIntToNumber(item.totalItem);
        await tx.barang.update({
          where: { id: item.barangId },
          data: {
            stok: { decrement: BigInt(totalItem) },
          },
        });
      }

      // Tandai pembelian sebagai DIBATALKAN
      await tx.pembelianHeader.update({
        where: { id: pembelianId },
        data: { statusTransaksi: "DIBATALKAN" },
      });

      // Recalculate hutang supplier
      await recalculateSupplierHutang(tx, pembelian.supplierId);
    });

    return NextResponse.json({
      success: true,
      message: "Pembelian berhasil di-rollback dan stok telah dikembalikan",
    });
  } catch (err) {
    console.error("Error rollback pembelian:", err);
    return NextResponse.json(
      { success: false, error: "Gagal melakukan rollback pembelian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
