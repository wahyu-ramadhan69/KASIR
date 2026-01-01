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

// POST: Edit pembelian yang sudah selesai/hutang
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

    const itemsPayload = Array.isArray(body.items) ? body.items : [];
    if (itemsPayload.length === 0) {
      return NextResponse.json(
        { success: false, error: "Item pembelian tidak boleh kosong" },
        { status: 400 }
      );
    }

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

    if (pembelian.statusTransaksi !== "SELESAI") {
      return NextResponse.json(
        {
          success: false,
          error: "Hanya pembelian selesai yang bisa diedit",
        },
        { status: 400 }
      );
    }

    const targetSupplierId =
      body.supplierId !== undefined && body.supplierId !== null
        ? parseInt(body.supplierId)
        : pembelian.supplierId;

    const targetSupplier = await prisma.supplier.findUnique({
      where: { id: targetSupplierId },
    });

    if (!targetSupplier) {
      return NextResponse.json(
        { success: false, error: "Supplier tidak ditemukan" },
        { status: 404 }
      );
    }

    const existingItemsById = new Map(
      pembelian.items.map((item) => [item.id, item])
    );

    const barangIds: number[] = Array.from(
      new Set(itemsPayload.map((item: any) => Number(item.barangId)))
    );

    const barangList = await prisma.barang.findMany({
      where: { id: { in: barangIds } },
    });

    const barangById = new Map(barangList.map((barang) => [barang.id, barang]));
    for (const item of pembelian.items) {
      if (!barangById.has(item.barangId)) {
        barangById.set(item.barangId, item.barang);
      }
    }

    const oldQtyByBarangId = new Map<number, number>();
    for (const item of pembelian.items) {
      const totalItem = bigIntToNumber(item.totalItem);
      oldQtyByBarangId.set(
        item.barangId,
        (oldQtyByBarangId.get(item.barangId) || 0) + totalItem
      );
    }

    const newQtyByBarangId = new Map<number, number>();
    const seenBarang = new Set<number>();
    for (const item of itemsPayload) {
      const barangId = Number(item.barangId);
      if (seenBarang.has(barangId)) {
        return NextResponse.json(
          {
            success: false,
            error: "Barang tidak boleh duplikat dalam satu pembelian",
          },
          { status: 400 }
        );
      }
      seenBarang.add(barangId);

      const barang = barangById.get(barangId);
      if (!barang) {
        return NextResponse.json(
          { success: false, error: "Barang tidak ditemukan" },
          { status: 404 }
        );
      }

      if (barang.supplierId !== targetSupplierId) {
        return NextResponse.json(
          {
            success: false,
            error: "Barang tidak sesuai dengan supplier yang dipilih",
          },
          { status: 400 }
        );
      }

      if (item.id) {
        const existingItem = existingItemsById.get(Number(item.id));
        if (!existingItem) {
          return NextResponse.json(
            { success: false, error: "Item pembelian tidak ditemukan" },
            { status: 404 }
          );
        }
        if (existingItem.barangId !== barangId) {
          return NextResponse.json(
            {
              success: false,
              error: "Barang item tidak boleh diubah",
            },
            { status: 400 }
          );
        }
      }

      const jumlahPerKemasan = bigIntToNumber(barang.jumlahPerKemasan);
      const normalizedTotalItem =
        item.totalItem !== undefined
          ? Number(item.totalItem)
          : Number(item.jumlahDus) * jumlahPerKemasan;
      newQtyByBarangId.set(
        barangId,
        (newQtyByBarangId.get(barangId) || 0) + normalizedTotalItem
      );
    }

    const allBarangIds = new Set<number>([
      ...oldQtyByBarangId.keys(),
      ...newQtyByBarangId.keys(),
    ]);

    for (const barangId of allBarangIds) {
      const barang = barangById.get(barangId);
      if (!barang) {
        continue;
      }
      const newQty = newQtyByBarangId.get(barangId) || 0;
      const oldQty = oldQtyByBarangId.get(barangId) || 0;
      const deltaQty = newQty - oldQty;

      if (deltaQty < 0) {
        const stokTersedia = bigIntToNumber(barang.stok);
        if (stokTersedia < Math.abs(deltaQty)) {
          return NextResponse.json(
            {
              success: false,
              error: `Stok ${
                barang.namaBarang
              } tidak cukup untuk dikurangi. Tersedia: ${stokTersedia} pcs, Dibutuhkan: ${Math.abs(
                deltaQty
              )} pcs`,
            },
            { status: 400 }
          );
        }
      }
    }

    const diskonNota = Number(body.diskonNota) || 0;
    const jumlahDibayar = Number(body.jumlahDibayar) || 0;

    const subtotal = itemsPayload.reduce((sum: number, item: any) => {
      const hargaPokok = Number(item.hargaPokok) || 0;
      const barang = barangById.get(Number(item.barangId));
      const jumlahPerKemasan = barang
        ? bigIntToNumber(barang.jumlahPerKemasan)
        : 0;
      const normalizedTotalItem =
        item.totalItem !== undefined
          ? Number(item.totalItem)
          : Number(item.jumlahDus) * jumlahPerKemasan;
      const jumlahDus =
        jumlahPerKemasan > 0 ? normalizedTotalItem / jumlahPerKemasan : 0;
      const diskonPerItem = Number(item.diskonPerItem) || 0;
      return sum + (hargaPokok * jumlahDus - diskonPerItem * jumlahDus);
    }, 0);

    const totalHarga = subtotal - diskonNota;
    const kembalian =
      jumlahDibayar > totalHarga ? jumlahDibayar - totalHarga : 0;
    const sisaHutang =
      jumlahDibayar < totalHarga ? totalHarga - jumlahDibayar : 0;
    const statusPembayaran = jumlahDibayar >= totalHarga ? "LUNAS" : "HUTANG";

    if (statusPembayaran === "HUTANG") {
      const hutangExisting = await prisma.pembelianHeader.aggregate({
        where: {
          supplierId: targetSupplierId,
          statusPembayaran: "HUTANG",
          statusTransaksi: "SELESAI",
          NOT: { id: pembelianId },
        },
        _sum: {
          totalHarga: true,
          jumlahDibayar: true,
        },
      });

      const totalHutangExisting =
        bigIntToNumber(hutangExisting._sum.totalHarga || BigInt(0)) -
        bigIntToNumber(hutangExisting._sum.jumlahDibayar || BigInt(0));
      const totalHutangBaru = totalHutangExisting + sisaHutang;
      const limitHutang = bigIntToNumber(targetSupplier.limitHutang);

      if (totalHutangBaru > limitHutang) {
        return NextResponse.json(
          {
            success: false,
            error: `Melebihi limit hutang supplier. Limit: Rp ${limitHutang.toLocaleString(
              "id-ID"
            )}, Hutang saat ini: Rp ${totalHutangExisting.toLocaleString(
              "id-ID"
            )}, Hutang baru: Rp ${sisaHutang.toLocaleString("id-ID")}`,
          },
          { status: 400 }
        );
      }
    }

    let jatuhTempo: Date | null = null;
    if (statusPembayaran === "HUTANG") {
      if (body.tanggalJatuhTempo) {
        jatuhTempo = new Date(body.tanggalJatuhTempo);
      } else {
        jatuhTempo = pembelian.tanggalJatuhTempo
          ? new Date(pembelian.tanggalJatuhTempo)
          : new Date(new Date().setDate(new Date().getDate() + 30));
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const keptItemIds = new Set<number>();
      const hargaPokokByBarangId = new Map<number, number>();

      for (const item of itemsPayload) {
        const itemId = item.id ? Number(item.id) : null;
        const barangId = Number(item.barangId);
        const hargaPokok = Number(item.hargaPokok) || 0;
        const diskonPerItem = Number(item.diskonPerItem) || 0;
        const barang = barangById.get(barangId);
        const jumlahPerKemasan = barang
          ? bigIntToNumber(barang.jumlahPerKemasan)
          : 0;
        const normalizedTotalItem =
          item.totalItem !== undefined
            ? Number(item.totalItem)
            : Number(item.jumlahDus) * jumlahPerKemasan;

        hargaPokokByBarangId.set(barangId, hargaPokok);

        if (itemId) {
          await tx.pembelianItem.update({
            where: { id: itemId },
            data: {
              totalItem: BigInt(normalizedTotalItem),
              hargaPokok: BigInt(hargaPokok),
              diskonPerItem: BigInt(diskonPerItem),
            },
          });
          keptItemIds.add(itemId);
        } else {
          const created = await tx.pembelianItem.create({
            data: {
              pembelianId,
              barangId,
              totalItem: BigInt(normalizedTotalItem),
              hargaPokok: BigInt(hargaPokok),
              diskonPerItem: BigInt(diskonPerItem),
            },
          });
          keptItemIds.add(created.id);
        }
      }

      const deleteIds = pembelian.items
        .filter((item) => !keptItemIds.has(item.id))
        .map((item) => item.id);

      if (deleteIds.length > 0) {
        await tx.pembelianItem.deleteMany({
          where: { id: { in: deleteIds } },
        });
      }

      for (const barangId of allBarangIds) {
        const newQty = newQtyByBarangId.get(barangId) || 0;
        const oldQty = oldQtyByBarangId.get(barangId) || 0;
        const deltaQty = newQty - oldQty;

        if (deltaQty > 0) {
          await tx.barang.update({
            where: { id: barangId },
            data: { stok: { increment: BigInt(deltaQty) } },
          });
        } else if (deltaQty < 0) {
          await tx.barang.update({
            where: { id: barangId },
            data: { stok: { decrement: BigInt(Math.abs(deltaQty)) } },
          });
        }
      }

      for (const [barangId, hargaPokok] of hargaPokokByBarangId.entries()) {
        await tx.barang.update({
          where: { id: barangId },
          data: { hargaBeli: BigInt(hargaPokok) },
        });
      }

      const updateData: any = {
        supplier: {
          connect: { id: targetSupplierId },
        },
        subtotal: BigInt(subtotal),
        diskonNota: BigInt(diskonNota),
        totalHarga: BigInt(totalHarga),
        jumlahDibayar: BigInt(jumlahDibayar),
        kembalian: BigInt(kembalian),
        statusPembayaran,
        statusTransaksi: "SELESAI",
      };

      if (body.keterangan !== undefined) {
        updateData.keterangan = body.keterangan || null;
      }

      if (statusPembayaran === "HUTANG") {
        updateData.tanggalJatuhTempo = jatuhTempo;
      } else {
        updateData.tanggalJatuhTempo = null;
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

      const oldSupplierId = pembelian.supplierId;
      if (oldSupplierId !== targetSupplierId) {
        await recalculateSupplierHutang(tx, oldSupplierId);
      }
      await recalculateSupplierHutang(tx, targetSupplierId);

      return updatedPembelian;
    });

    const receipt = {
      kodePembelian: updated.kodePembelian,
      tanggal: updated.updatedAt,
      supplier: {
        nama: updated.supplier.namaSupplier,
        alamat: updated.supplier.alamat,
        noHp: updated.supplier.noHp,
      },
      items: updated.items.map((item) => {
        const hargaPokok = bigIntToNumber(item.hargaPokok);
        const totalItem = bigIntToNumber(item.totalItem);
        const diskonPerItem = bigIntToNumber(item.diskonPerItem);
        const jumlahPerKemasan = bigIntToNumber(item.barang.jumlahPerKemasan);
        const jumlahDus =
          jumlahPerKemasan > 0 ? totalItem / jumlahPerKemasan : 0;

        return {
          namaBarang: item.barang.namaBarang,
          jumlahDus,
          totalUnit: totalItem,
          hargaPokok,
          diskonPerItem,
          totalHarga: hargaPokok * jumlahDus,
          totalDiskon: diskonPerItem * jumlahDus,
          subtotal: hargaPokok * jumlahDus - diskonPerItem * jumlahDus,
        };
      }),
      subtotal,
      diskonNota,
      totalHarga,
      jumlahDibayar,
      kembalian,
      sisaHutang: statusPembayaran === "HUTANG" ? sisaHutang : 0,
      statusPembayaran,
      tanggalJatuhTempo: statusPembayaran === "HUTANG" ? jatuhTempo : null,
    };

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Pembelian berhasil diupdate",
        data: {
          pembelian: updated,
          receipt,
        },
      })
    );
  } catch (err) {
    console.error("Error editing pembelian:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengupdate pembelian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
