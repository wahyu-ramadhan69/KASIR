import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// POST - Retur atau Tambah Barang (Langsung Apply)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const penjualanId = parseInt(id);
    const body = await request.json();
    const { items, keterangan } = body;

    // Validasi penjualan harus sudah selesai
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

    if (penjualan.statusTransaksi !== "SELESAI") {
      return NextResponse.json(
        {
          success: false,
          error: "Hanya transaksi SELESAI yang bisa di-adjust",
        },
        { status: 400 }
      );
    }

    // Validasi items
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Items tidak boleh kosong" },
        { status: 400 }
      );
    }

    // Validasi setiap item
    for (const item of items) {
      const { barangId, jenisPerubahan, jumlahDus, jumlahPcs } = item;

      if (!["RETUR", "TAMBAH"].includes(jenisPerubahan)) {
        return NextResponse.json(
          { success: false, error: "jenisPerubahan harus RETUR atau TAMBAH" },
          { status: 400 }
        );
      }

      const originalItem = penjualan.items.find((i) => i.barangId === barangId);

      if (jenisPerubahan === "RETUR") {
        // Validasi item harus ada di penjualan
        if (!originalItem) {
          return NextResponse.json(
            {
              success: false,
              error: `Barang ID ${barangId} tidak ada dalam penjualan`,
            },
            { status: 400 }
          );
        }

        const barang = originalItem.barang;
        const totalReturPcs =
          BigInt(jumlahDus) * barang.jumlahPerKemasan + BigInt(jumlahPcs);
        const totalBeliPcs =
          originalItem.jumlahDus * barang.jumlahPerKemasan +
          originalItem.jumlahPcs;

        // Validasi jumlah retur tidak boleh lebih dari yang dibeli
        if (totalReturPcs > totalBeliPcs) {
          return NextResponse.json(
            {
              success: false,
              error: `Jumlah retur ${barang.namaBarang} melebihi jumlah pembelian`,
            },
            { status: 400 }
          );
        }
      } else if (jenisPerubahan === "TAMBAH") {
        // Cek stok barang
        const barang = await prisma.barang.findUnique({
          where: { id: barangId },
        });

        if (!barang) {
          return NextResponse.json(
            { success: false, error: `Barang ID ${barangId} tidak ditemukan` },
            { status: 404 }
          );
        }

        const totalTambahPcs =
          BigInt(jumlahDus) * barang.jumlahPerKemasan + BigInt(jumlahPcs);
        if (totalTambahPcs > barang.stok) {
          return NextResponse.json(
            {
              success: false,
              error: `Stok ${barang.namaBarang} tidak mencukupi`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Proses dalam transaksi
    const result = await prisma.$transaction(async (tx) => {
      let totalSelisih = BigInt(0);
      const logAdjustment: any[] = [];

      for (const item of items) {
        const { barangId, jenisPerubahan, jumlahDus, jumlahPcs } = item;
        const originalItem = penjualan.items.find(
          (i) => i.barangId === barangId
        );

        if (jenisPerubahan === "RETUR") {
          const barang = originalItem!.barang;
          const totalReturPcs =
            BigInt(jumlahDus) * barang.jumlahPerKemasan + BigInt(jumlahPcs);

          // Hitung harga retur (proporsional)
          const hargaPerPcs =
            originalItem!.hargaJual /
            (originalItem!.jumlahDus * barang.jumlahPerKemasan +
              originalItem!.jumlahPcs);
          const totalHargaRetur = hargaPerPcs * totalReturPcs;

          // Update stok (kembalikan)
          await tx.barang.update({
            where: { id: barangId },
            data: {
              stok: {
                increment: totalReturPcs,
              },
            },
          });

          // Update atau hapus item penjualan
          const newJumlahDus = originalItem!.jumlahDus - BigInt(jumlahDus);
          const newJumlahPcs = originalItem!.jumlahPcs - BigInt(jumlahPcs);

          if (newJumlahDus <= 0 && newJumlahPcs <= 0) {
            // Hapus item jika quantity jadi 0
            await tx.penjualanItem.delete({
              where: { id: originalItem!.id },
            });

            logAdjustment.push({
              barang: barang.namaBarang,
              jenis: "RETUR",
              jumlah: `${jumlahDus} dus ${jumlahPcs} pcs`,
              nilai: `-Rp ${totalHargaRetur.toString()}`,
            });
          } else {
            // Update quantity
            const newTotalPcs =
              newJumlahDus * barang.jumlahPerKemasan + newJumlahPcs;
            const newHargaJual = hargaPerPcs * newTotalPcs;
            const newHargaBeli =
              (originalItem!.hargaBeli /
                (originalItem!.jumlahDus * barang.jumlahPerKemasan +
                  originalItem!.jumlahPcs)) *
              newTotalPcs;
            const newLaba = newHargaJual - newHargaBeli;

            await tx.penjualanItem.update({
              where: { id: originalItem!.id },
              data: {
                jumlahDus: newJumlahDus,
                jumlahPcs: newJumlahPcs,
                hargaJual: newHargaJual,
                hargaBeli: newHargaBeli,
                laba: newLaba,
              },
            });

            logAdjustment.push({
              barang: barang.namaBarang,
              jenis: "RETUR",
              jumlah: `${jumlahDus} dus ${jumlahPcs} pcs`,
              nilai: `-Rp ${totalHargaRetur.toString()}`,
            });
          }

          totalSelisih -= totalHargaRetur;
        } else if (jenisPerubahan === "TAMBAH") {
          const barang = await tx.barang.findUnique({
            where: { id: barangId },
          });

          const totalTambahPcs =
            BigInt(jumlahDus) * barang!.jumlahPerKemasan + BigInt(jumlahPcs);

          // Update stok (kurangi)
          await tx.barang.update({
            where: { id: barangId },
            data: {
              stok: {
                decrement: totalTambahPcs,
              },
            },
          });

          if (originalItem) {
            // Update item yang sudah ada
            const hargaPerPcs =
              originalItem.hargaJual /
              (originalItem.jumlahDus * barang!.jumlahPerKemasan +
                originalItem.jumlahPcs);

            const newJumlahDus = originalItem.jumlahDus + BigInt(jumlahDus);
            const newJumlahPcs = originalItem.jumlahPcs + BigInt(jumlahPcs);
            const newTotalPcs =
              newJumlahDus * barang!.jumlahPerKemasan + newJumlahPcs;

            const newHargaJual = hargaPerPcs * newTotalPcs;
            const newHargaBeli =
              (originalItem.hargaBeli /
                (originalItem.jumlahDus * barang!.jumlahPerKemasan +
                  originalItem.jumlahPcs)) *
              newTotalPcs;
            const newLaba = newHargaJual - newHargaBeli;

            const totalHargaTambah = hargaPerPcs * totalTambahPcs;

            await tx.penjualanItem.update({
              where: { id: originalItem.id },
              data: {
                jumlahDus: newJumlahDus,
                jumlahPcs: newJumlahPcs,
                hargaJual: newHargaJual,
                hargaBeli: newHargaBeli,
                laba: newLaba,
              },
            });

            totalSelisih += totalHargaTambah;

            logAdjustment.push({
              barang: barang!.namaBarang,
              jenis: "TAMBAH",
              jumlah: `${jumlahDus} dus ${jumlahPcs} pcs`,
              nilai: `+Rp ${totalHargaTambah.toString()}`,
            });
          } else {
            // Buat item baru
            const hargaJual = barang!.hargaJual * totalTambahPcs;
            const hargaBeli = barang!.hargaBeli * totalTambahPcs;
            const laba = hargaJual - hargaBeli;

            await tx.penjualanItem.create({
              data: {
                penjualanId,
                barangId,
                jumlahDus: BigInt(jumlahDus),
                jumlahPcs: BigInt(jumlahPcs),
                hargaJual,
                hargaBeli,
                diskonPerItem: BigInt(0),
                laba,
              },
            });

            totalSelisih += hargaJual;

            logAdjustment.push({
              barang: barang!.namaBarang,
              jenis: "TAMBAH (Baru)",
              jumlah: `${jumlahDus} dus ${jumlahPcs} pcs`,
              nilai: `+Rp ${hargaJual.toString()}`,
            });
          }
        }
      }

      // Hitung ulang total penjualan
      const updatedItems = await tx.penjualanItem.findMany({
        where: { penjualanId },
      });

      const newSubtotal = updatedItems.reduce(
        (sum, item) => sum + item.hargaJual,
        BigInt(0)
      );
      const newTotalHarga = newSubtotal - penjualan.diskonNota;

      // Hitung pembayaran
      const pembayaranSebelum = penjualan.jumlahDibayar;
      let newJumlahDibayar = pembayaranSebelum;
      let newKembalian = penjualan.kembalian;
      let newStatusPembayaran = penjualan.statusPembayaran;

      // Jika ada selisih, adjust pembayaran
      if (totalSelisih !== BigInt(0)) {
        if (totalSelisih > 0) {
          // Customer harus bayar tambahan
          newJumlahDibayar = pembayaranSebelum + totalSelisih;
        } else {
          // Customer dapat pengembalian
          newKembalian =
            penjualan.kembalian + BigInt(Math.abs(Number(totalSelisih)));
        }
      }

      // Update status pembayaran berdasarkan total
      if (newJumlahDibayar >= newTotalHarga) {
        newStatusPembayaran = "LUNAS";
        newKembalian = newJumlahDibayar - newTotalHarga;
      } else {
        newStatusPembayaran = "HUTANG";
        newKembalian = BigInt(0);
      }

      // Update piutang customer jika ada
      if (penjualan.customerId) {
        const selisihPiutang =
          newTotalHarga -
          newJumlahDibayar -
          (penjualan.totalHarga - pembayaranSebelum);

        if (selisihPiutang !== BigInt(0)) {
          await tx.customer.update({
            where: { id: penjualan.customerId },
            data: {
              piutang: {
                increment: selisihPiutang,
              },
            },
          });
        }
      }

      // Update header penjualan
      const updatedPenjualan = await tx.penjualanHeader.update({
        where: { id: penjualanId },
        data: {
          subtotal: newSubtotal,
          totalHarga: newTotalHarga,
          jumlahDibayar: newJumlahDibayar,
          kembalian: newKembalian,
          statusPembayaran: newStatusPembayaran,
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

      return {
        penjualan: updatedPenjualan,
        adjustment: {
          totalSelisih,
          detail: logAdjustment,
          keterangan,
        },
      };
    });

    // Format response message
    let message = "Adjustment berhasil diterapkan. ";
    if (result.adjustment.totalSelisih > 0) {
      message += `Customer perlu membayar tambahan: Rp ${result.adjustment.totalSelisih.toString()}`;
    } else if (result.adjustment.totalSelisih < 0) {
      message += `Customer menerima pengembalian: Rp ${Math.abs(
        Number(result.adjustment.totalSelisih)
      ).toString()}`;
    } else {
      message += "Tidak ada selisih pembayaran";
    }

    return NextResponse.json({
      success: true,
      data: result,
      message,
    });
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
