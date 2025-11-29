import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Helper function to convert BigInt to number safely
function bigIntToNumber(value: any): number {
  if (value == null) return 0;
  if (typeof value === "bigint") {
    return Number(value);
  }
  return Number(value);
}

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

// Helper: Hitung ulang total hutang supplier dari semua transaksi
async function recalculateSupplierHutang(tx: any, supplierId: number) {
  const pembelianHutang = await tx.pembelianHeader.findMany({
    where: {
      supplierId: supplierId,
      statusTransaksi: "SELESAI",
      statusPembayaran: "HUTANG",
    },
    select: {
      totalHarga: true,
      jumlahDibayar: true,
    },
  });

  const totalHutang = pembelianHutang.reduce((sum: number, pb: any) => {
    const totalHarga = bigIntToNumber(pb.totalHarga);
    const jumlahDibayar = bigIntToNumber(pb.jumlahDibayar);
    return sum + (totalHarga - jumlahDibayar);
  }, 0);

  await tx.supplier.update({
    where: { id: supplierId },
    data: { hutang: BigInt(Math.max(0, totalHutang)) },
  });

  return totalHutang;
}

// POST: Checkout / Selesaikan transaksi
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
    const body = await request.json();
    const { diskonNota, jumlahDibayar, tanggalJatuhTempo } = body;

    // Validasi
    if (jumlahDibayar === undefined) {
      return NextResponse.json(
        { success: false, error: "Jumlah pembayaran wajib diisi" },
        { status: 400 }
      );
    }

    // Ambil pembelian dengan items
    const pembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
      include: {
        supplier: true,
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

    if (pembelian.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        { success: false, error: "Pembelian sudah tidak bisa diproses" },
        { status: 400 }
      );
    }

    if (pembelian.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Keranjang kosong, tidak bisa checkout" },
        { status: 400 }
      );
    }

    // Hitung subtotal dengan BigInt conversion
    const subtotal = pembelian.items.reduce((total, item) => {
      const hargaPokok = bigIntToNumber(item.hargaPokok);
      const jumlahDus = bigIntToNumber(item.jumlahDus);
      const diskonPerItem = bigIntToNumber(item.diskonPerItem);
      const totalHarga = hargaPokok * jumlahDus;
      const totalDiskon = diskonPerItem * jumlahDus;
      return total + (totalHarga - totalDiskon);
    }, 0);

    const finalDiskonNota =
      diskonNota !== undefined
        ? diskonNota
        : bigIntToNumber(pembelian.diskonNota);
    const totalHarga = subtotal - finalDiskonNota;

    // Cek limit hutang jika pembayaran kurang
    if (jumlahDibayar < totalHarga) {
      const sisaHutangBaru = totalHarga - jumlahDibayar;

      // Hitung total hutang existing
      const hutangExisting = await prisma.pembelianHeader.aggregate({
        where: {
          supplierId: pembelian.supplierId,
          statusPembayaran: "HUTANG",
          statusTransaksi: "SELESAI",
        },
        _sum: {
          totalHarga: true,
          jumlahDibayar: true,
        },
      });

      const totalHutangExisting =
        bigIntToNumber(hutangExisting._sum.totalHarga || BigInt(0)) -
        bigIntToNumber(hutangExisting._sum.jumlahDibayar || BigInt(0));
      const totalHutangBaru = totalHutangExisting + sisaHutangBaru;
      const limitHutang = bigIntToNumber(pembelian.supplier.limitHutang);

      if (totalHutangBaru > limitHutang) {
        return NextResponse.json(
          {
            success: false,
            error: `Melebihi limit hutang supplier. Limit: Rp ${limitHutang.toLocaleString(
              "id-ID"
            )}, Hutang saat ini: Rp ${totalHutangExisting.toLocaleString(
              "id-ID"
            )}, Hutang baru: Rp ${sisaHutangBaru.toLocaleString("id-ID")}`,
          },
          { status: 400 }
        );
      }
    }

    // Hitung kembalian dan status pembayaran
    const kembalian =
      jumlahDibayar > totalHarga ? jumlahDibayar - totalHarga : 0;
    const sisaHutang =
      jumlahDibayar < totalHarga ? totalHarga - jumlahDibayar : 0;
    const statusPembayaran = jumlahDibayar >= totalHarga ? "LUNAS" : "HUTANG";

    // Hitung tanggal jatuh tempo (default 30 hari dari sekarang jika tidak diinput)
    let jatuhTempo: Date | null = null;
    if (statusPembayaran === "HUTANG") {
      if (tanggalJatuhTempo) {
        jatuhTempo = new Date(tanggalJatuhTempo);
      } else {
        // Default 30 hari dari sekarang
        jatuhTempo = new Date();
        jatuhTempo.setDate(jatuhTempo.getDate() + 30);
      }
    }

    // Transaction: Update stok dan selesaikan pembelian
    const result = await prisma.$transaction(async (tx) => {
      // Update stok barang
      for (const item of pembelian.items) {
        const jumlahDus = bigIntToNumber(item.jumlahDus);
        const jumlahPerkardus = bigIntToNumber(item.barang.jumlahPerkardus);
        const totalUnit = jumlahDus * jumlahPerkardus;
        const hargaPokok = bigIntToNumber(item.hargaPokok);

        await tx.barang.update({
          where: { id: item.barangId },
          data: {
            stok: { increment: BigInt(totalUnit) },
            hargaBeli: BigInt(hargaPokok),
          },
        });
      }

      // Update pembelian dengan kembalian dan tanggal jatuh tempo
      const updateData: any = {
        subtotal: BigInt(subtotal),
        diskonNota: BigInt(finalDiskonNota),
        totalHarga: BigInt(totalHarga),
        jumlahDibayar: BigInt(jumlahDibayar),
        kembalian: BigInt(kembalian),
        statusPembayaran,
        statusTransaksi: "SELESAI",
      };

      // Tambahkan tanggal jatuh tempo jika status HUTANG
      if (jatuhTempo) {
        updateData.tanggalJatuhTempo = jatuhTempo;
      }

      const updatedPembelian = await tx.pembelianHeader.update({
        where: { id: pembelianId },
        data: updateData,
        include: {
          supplier: true,
          items: {
            include: { barang: true },
          },
        },
      });

      // Hitung ulang hutang supplier (setelah pembelian di-update)
      await recalculateSupplierHutang(tx, pembelian.supplierId);

      return updatedPembelian;
    });

    // Buat receipt dengan serialized data
    const receipt = {
      kodePembelian: result.kodePembelian,
      tanggal: result.updatedAt,
      supplier: {
        nama: result.supplier.namaSupplier,
        alamat: result.supplier.alamat,
        noHp: result.supplier.noHp,
      },
      items: result.items.map((item) => {
        const hargaPokok = bigIntToNumber(item.hargaPokok);
        const jumlahDus = bigIntToNumber(item.jumlahDus);
        const diskonPerItem = bigIntToNumber(item.diskonPerItem);
        const jumlahPerkardus = bigIntToNumber(item.barang.jumlahPerkardus);

        return {
          namaBarang: item.barang.namaBarang,
          jumlahDus,
          totalUnit: jumlahDus * jumlahPerkardus,
          hargaPokok,
          diskonPerItem,
          totalHarga: hargaPokok * jumlahDus,
          totalDiskon: diskonPerItem * jumlahDus,
          subtotal: hargaPokok * jumlahDus - diskonPerItem * jumlahDus,
        };
      }),
      subtotal,
      diskonNota: finalDiskonNota,
      totalHarga,
      jumlahDibayar,
      kembalian,
      sisaHutang: statusPembayaran === "HUTANG" ? sisaHutang : 0,
      statusPembayaran,
      tanggalJatuhTempo: statusPembayaran === "HUTANG" ? jatuhTempo : null,
    };

    // Deep serialize the entire response to ensure no BigInt remains
    const serializedResponse = deepSerialize({
      success: true,
      message: `Pembelian berhasil diselesaikan dengan status ${statusPembayaran}`,
      data: {
        pembelian: result,
        receipt,
      },
    });

    return NextResponse.json(serializedResponse);
  } catch (err) {
    console.error("Error checkout:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menyelesaikan pembelian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
