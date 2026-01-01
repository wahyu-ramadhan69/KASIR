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

function toNumber(value: any): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return Number(value || 0);
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
      totalCash = 0,
      totalTransfer = 0,
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
    const totalBerat = penjualan.items.reduce(
      (sum, item) => sum + Number(item.berat || 0),
      0
    );

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
        const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan || 1);
        const totalPcs =
          item.totalItem !== null && item.totalItem !== undefined
            ? Number(item.totalItem)
            : Number(item.jumlahDus || 0) * jumlahPerKemasan +
              Number(item.jumlahPcs || 0);

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
          beratTotal: BigInt(totalBerat),
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

      if (dibayar > 0) {
        const normalizedTotalCash = toNumber(totalCash);
        const normalizedTotalTransfer = toNumber(totalTransfer);
        let totalCashFinal = normalizedTotalCash;
        let totalTransferFinal = normalizedTotalTransfer;
        const metode = metodePembayaran || "CASH";

        if (metode === "TRANSFER") {
          totalCashFinal = 0;
          totalTransferFinal =
            normalizedTotalTransfer > 0
              ? normalizedTotalTransfer
              : Number(dibayar);
        } else if (metode === "CASH_TRANSFER") {
          if (normalizedTotalCash === 0 && normalizedTotalTransfer === 0) {
            totalCashFinal = Number(dibayar);
          }
        } else {
          totalTransferFinal = 0;
          totalCashFinal =
            normalizedTotalCash > 0 ? normalizedTotalCash : Number(dibayar);
        }

        const pembayaranDate = tanggalPenjualan
          ? new Date(tanggalPenjualan)
          : new Date();
        const pembayaranDateStr = pembayaranDate
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");
        const lastPembayaran = await tx.pembayaranPenjualan.findFirst({
          where: {
            kodePembayaran: {
              startsWith: `BYR-${pembayaranDateStr}`,
            },
          },
          orderBy: {
            kodePembayaran: "desc",
          },
        });

        let nextPembayaranNumber = 1;
        if (lastPembayaran) {
          const lastNumber = parseInt(
            lastPembayaran.kodePembayaran.split("-")[2]
          );
          nextPembayaranNumber = lastNumber + 1;
        }

        const kodePembayaran = `BYR-${pembayaranDateStr}-${String(
          nextPembayaranNumber
        ).padStart(4, "0")}`;

        await tx.pembayaranPenjualan.create({
          data: {
            kodePembayaran,
            penjualanId,
            tanggalBayar: pembayaranDate,
            nominal: dibayar,
            totalCash: BigInt(totalCashFinal),
            totalTransfer: BigInt(totalTransferFinal),
            metode,
          },
        });
      }

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
