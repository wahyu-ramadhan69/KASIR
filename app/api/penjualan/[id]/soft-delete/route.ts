import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

type RouteCtx = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_req: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const penjualanId = Number(id);
    if (!Number.isFinite(penjualanId)) {
      return NextResponse.json(
        { success: false, error: "ID tidak valid" },
        { status: 400 }
      );
    }

    const existing = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
      include: {
        items: {
          include: { barang: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (existing.isDeleted) {
      return NextResponse.json({
        success: true,
        message: "Penjualan sudah dihapus",
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan || 1);
        const totalPcs = Number(item.totalItem || 0);
        if (totalPcs > 0) {
          await tx.barang.update({
            where: { id: item.barangId },
            data: { stok: { increment: BigInt(totalPcs) } },
          });
        }
      }

      if (existing.statusPembayaran === "HUTANG" && existing.customerId) {
        const totalHarga = BigInt(existing.totalHarga || 0);
        const jumlahDibayar = BigInt(existing.jumlahDibayar || 0);
        const sisaHutang =
          totalHarga > jumlahDibayar ? totalHarga - jumlahDibayar : BigInt(0);

        if (sisaHutang > BigInt(0)) {
          const customer = await tx.customer.findUnique({
            where: { id: existing.customerId },
            select: { piutang: true },
          });

          if (customer) {
            const currentPiutang = BigInt(customer.piutang || 0);
            const nextPiutang =
              currentPiutang > sisaHutang
                ? currentPiutang - sisaHutang
                : BigInt(0);

            await tx.customer.update({
              where: { id: existing.customerId },
              data: { piutang: nextPiutang },
            });
          }
        }
      }

      await tx.penjualanHeader.update({
        where: { id: penjualanId },
        data: { isDeleted: true },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Penjualan berhasil dihapus",
    });
  } catch (error) {
    console.error("Error soft deleting penjualan:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus penjualan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
