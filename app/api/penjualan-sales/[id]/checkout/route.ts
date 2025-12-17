import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

// POST - Proses checkout dan pembayaran
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const penjualanId = parseInt(id);
    const body = await request.json();
    const {
      diskonNota = 0,
      jumlahDibayar,
      metodePembayaran,
      tanggalPenjualan,
      tanggalJatuhTempo,
      keterangan,
      rutePengiriman,
    } = body;

    // Validasi penjualan
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
      include: {
        items: {
          include: {
            barang: true,
          },
        },
        customer: true,
      },
    });

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (penjualan.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        { success: false, error: "Transaksi sudah diproses" },
        { status: 400 }
      );
    }

    if (!penjualan.items || penjualan.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada item dalam keranjang" },
        { status: 400 }
      );
    }

    // Hitung total
    const subtotal = penjualan.subtotal;
    const totalHarga = subtotal - BigInt(diskonNota);
    const dibayar = BigInt(jumlahDibayar);
    const kembalian = dibayar > totalHarga ? dibayar - totalHarga : BigInt(0);
    const sisaHutang = totalHarga > dibayar ? totalHarga - dibayar : BigInt(0);

    // Tentukan status pembayaran
    let statusPembayaran: "LUNAS" | "HUTANG" = "LUNAS";
    if (sisaHutang > 0) {
      statusPembayaran = "HUTANG";

      // Cek limit piutang customer jika ada
      if (penjualan.customer) {
        const totalPiutangBaru = penjualan.customer.piutang + sisaHutang;
        if (totalPiutangBaru > penjualan.customer.limit_piutang) {
          return NextResponse.json(
            {
              success: false,
              error: `Limit piutang customer akan terlampaui. Limit: ${penjualan.customer.limit_piutang}, Total piutang akan menjadi: ${totalPiutangBaru}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Mulai transaksi database
    const result = await prisma.$transaction(async (tx) => {
      // Update stok barang
      for (const item of penjualan.items) {
        const totalPcs =
          item.jumlahDus * item.barang.jumlahPerKemasan + item.jumlahPcs;

        await tx.barang.update({
          where: { id: item.barangId },
          data: {
            stok: {
              decrement: totalPcs,
            },
          },
        });
      }

      // Update piutang customer jika hutang
      if (statusPembayaran === "HUTANG" && penjualan.customerId) {
        await tx.customer.update({
          where: { id: penjualan.customerId },
          data: {
            piutang: {
              increment: sisaHutang,
            },
          },
        });
      }

      // Update penjualan header
      const updatedPenjualan = await tx.penjualanHeader.update({
        where: { id: penjualanId },
        data: {
          diskonNota: BigInt(diskonNota),
          totalHarga,
          jumlahDibayar: dibayar,
          kembalian,
          keterangan: keterangan || null,
          rutePengiriman: rutePengiriman || null,
          metodePembayaran,
          statusPembayaran,
          statusTransaksi: "SELESAI",
          tanggalJatuhTempo:
            statusPembayaran === "HUTANG" ? tanggalJatuhTempo : null,
          tanggalTransaksi: tanggalPenjualan ? new Date(tanggalPenjualan) : new Date(),
        },
        include: {
          items: {
            include: {
              barang: true,
            },
          },
          customer: true,
          karyawan: true,
        },
      });

      return updatedPenjualan;
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: result,
        message:
          statusPembayaran === "LUNAS"
            ? "Transaksi berhasil diproses"
            : `Transaksi berhasil diproses dengan sisa hutang: ${Number(sisaHutang)}`,
      })
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
