// app/api/penjualan/[id]/bayar-hutang/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Deep serialize to handle all BigInt in nested objects
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

// Helper to convert BigInt to number safely
function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

// POST: Bayar hutang penjualan
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
    const penjualanId = parseInt(id);
    const body = await request.json();
    const { jumlahBayar, metodePembayaran = "CASH", catatan } = body;

    if (!jumlahBayar || jumlahBayar <= 0) {
      return NextResponse.json(
        { success: false, error: "Jumlah pembayaran tidak valid" },
        { status: 400 }
      );
    }

    // Validasi penjualan
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
      include: {
        customer: true,
        karyawan: true,
      },
    });

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (penjualan.statusTransaksi !== "SELESAI") {
      return NextResponse.json(
        { success: false, error: "Penjualan belum selesai" },
        { status: 400 }
      );
    }

    if (penjualan.statusPembayaran === "LUNAS") {
      return NextResponse.json(
        { success: false, error: "Penjualan sudah lunas" },
        { status: 400 }
      );
    }

    // Hitung sisa hutang
    const totalHarga = toNumber(penjualan.totalHarga);
    const jumlahDibayarLama = toNumber(penjualan.jumlahDibayar);
    const kembalianLama = toNumber(penjualan.kembalian);
    const sisaHutang = totalHarga - jumlahDibayarLama;
    const jumlahDibayarBaru = jumlahDibayarLama + jumlahBayar;

    // Determine new status and kembalian
    const isLunas = jumlahDibayarBaru >= totalHarga;
    const kembalianBaru = isLunas ? jumlahDibayarBaru - totalHarga : 0;

    // Hitung berapa yang benar-benar mengurangi piutang
    // Jika bayar lebih dari sisa hutang, yang mengurangi piutang hanya sebesar sisa hutang
    const penguranganPiutang = Math.min(jumlahBayar, sisaHutang);

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Kurangi piutang customer jika ada
      if (penjualan.customerId && penguranganPiutang > 0) {
        await tx.customer.update({
          where: { id: penjualan.customerId },
          data: {
            piutang: { decrement: BigInt(penguranganPiutang) },
          },
        });
      }

      // Update penjualan
      const updated = await tx.penjualanHeader.update({
        where: { id: penjualanId },
        data: {
          jumlahDibayar: BigInt(
            Math.min(jumlahDibayarBaru, totalHarga + kembalianBaru)
          ),
          kembalian: BigInt(kembalianLama + kembalianBaru),
          statusPembayaran: isLunas ? "LUNAS" : "HUTANG",
        },
        include: {
          customer: true,
          karyawan: true,
        },
      });

      if (jumlahBayar > 0) {
        const pembayaranDate = new Date();
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
            nominal: BigInt(jumlahBayar),
            metode: metodePembayaran,
            catatan: catatan || null,
          },
        });
      }

      return updated;
    });

    const sisaHutangBaru = isLunas ? 0 : totalHarga - jumlahDibayarBaru;

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: isLunas
          ? `Pembayaran berhasil - LUNAS${
              kembalianBaru > 0
                ? ` (Kembalian: Rp ${kembalianBaru.toLocaleString("id-ID")})`
                : ""
            }`
          : `Pembayaran berhasil - Sisa hutang: Rp ${sisaHutangBaru.toLocaleString(
              "id-ID"
            )}`,
        data: {
          penjualan: result,
          pembayaran: {
            jumlahBayar,
            penguranganPiutang,
            sisaHutangSebelum: sisaHutang,
            sisaHutangSesudah: sisaHutangBaru,
            kembalian: kembalianBaru,
            statusPembayaran: result.statusPembayaran,
            piutangCustomer: result.customer?.piutang || 0,
          },
          tipePenjualan: result.karyawanId ? "sales" : "toko",
        },
      })
    );
  } catch (err) {
    console.error("Error paying debt:", err);
    return NextResponse.json(
      { success: false, error: "Gagal melakukan pembayaran" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
