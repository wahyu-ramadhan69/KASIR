import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

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
    return sum + (pb.totalHarga - pb.jumlahDibayar);
  }, 0);

  await tx.supplier.update({
    where: { id: supplierId },
    data: { hutang: Math.max(0, totalHutang) }, // Pastikan tidak minus
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

    // Hitung subtotal
    const subtotal = pembelian.items.reduce((total, item) => {
      const totalHarga = item.hargaPokok * item.jumlahDus;
      const totalDiskon = item.diskonPerItem * item.jumlahDus;
      return total + (totalHarga - totalDiskon);
    }, 0);

    const finalDiskonNota =
      diskonNota !== undefined ? diskonNota : pembelian.diskonNota;
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
        (hutangExisting._sum.totalHarga || 0) -
        (hutangExisting._sum.jumlahDibayar || 0);
      const totalHutangBaru = totalHutangExisting + sisaHutangBaru;

      if (totalHutangBaru > pembelian.supplier.limitHutang) {
        return NextResponse.json(
          {
            success: false,
            error: `Melebihi limit hutang supplier. Limit: Rp ${pembelian.supplier.limitHutang.toLocaleString(
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
        const totalUnit = item.jumlahDus * item.barang.jumlahPerkardus;
        await tx.barang.update({
          where: { id: item.barangId },
          data: {
            stok: { increment: totalUnit },
            hargaBeli: item.hargaPokok,
          },
        });
      }

      // Update pembelian dengan kembalian dan tanggal jatuh tempo
      const updateData: any = {
        subtotal,
        diskonNota: finalDiskonNota,
        totalHarga,
        jumlahDibayar,
        kembalian,
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

    // Buat receipt
    const receipt = {
      kodePembelian: result.kodePembelian,
      tanggal: result.updatedAt,
      supplier: {
        nama: result.supplier.namaSupplier,
        alamat: result.supplier.alamat,
        noHp: result.supplier.noHp,
      },
      items: result.items.map((item) => ({
        namaBarang: item.barang.namaBarang,
        jumlahDus: item.jumlahDus,
        totalUnit: item.jumlahDus * item.barang.jumlahPerkardus,
        hargaPokok: item.hargaPokok,
        diskonPerItem: item.diskonPerItem,
        totalHarga: item.hargaPokok * item.jumlahDus,
        totalDiskon: item.diskonPerItem * item.jumlahDus,
        subtotal:
          item.hargaPokok * item.jumlahDus -
          item.diskonPerItem * item.jumlahDus,
      })),
      subtotal: result.subtotal,
      diskonNota: result.diskonNota,
      totalHarga: result.totalHarga,
      jumlahDibayar: result.jumlahDibayar,
      kembalian: result.kembalian,
      sisaHutang:
        result.statusPembayaran === "HUTANG"
          ? result.totalHarga - result.jumlahDibayar
          : 0,
      statusPembayaran: result.statusPembayaran,
      tanggalJatuhTempo:
        result.statusPembayaran === "HUTANG" ? result.tanggalJatuhTempo : null,
    };

    return NextResponse.json({
      success: true,
      message: `Pembelian berhasil diselesaikan dengan status ${statusPembayaran}`,
      data: { pembelian: result, receipt },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Gagal menyelesaikan pembelian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
