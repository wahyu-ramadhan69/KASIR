// app/api/penjualan/[id]/edit/route.ts
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

function deriveDusPcsFromTotal(totalItem: number, jumlahPerKemasan: number) {
  const perKemasan = Math.max(1, jumlahPerKemasan);
  const jumlahDus = Math.floor(totalItem / perKemasan);
  const jumlahPcs = totalItem % perKemasan;
  return { jumlahDus, jumlahPcs };
}

function getTotalItemPcs(item: any, jumlahPerKemasan: number): number {
  if (item.totalItem !== undefined && item.totalItem !== null) {
    return toNumber(item.totalItem);
  }
  const jumlahDus = toNumber(item.jumlahDus);
  const jumlahPcs = toNumber(item.jumlahPcs);
  return jumlahDus * jumlahPerKemasan + jumlahPcs;
}

// Helper function untuk mengecek total penjualan barang hari ini
async function getTotalPenjualanHariIni(
  barangId: number,
  excludePenjualanId?: number
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const items = await prisma.penjualanItem.findMany({
    where: {
      barangId,
      penjualan: {
        statusTransaksi: "SELESAI",
        tanggalTransaksi: {
          gte: today,
          lt: tomorrow,
        },
        ...(excludePenjualanId ? { NOT: { id: excludePenjualanId } } : {}),
      },
    },
    include: {
      barang: {
        select: {
          jumlahPerKemasan: true,
        },
      },
    },
  });

  const manifestData = await prisma.manifestBarang.findMany({
    where: {
      barangId,
      perjalanan: {
        tanggalBerangkat: {
          gte: today,
          lt: tomorrow,
        },
        statusPerjalanan: { not: "DIBATALKAN" },
      },
      updatedAt: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      perjalanan: true,
    },
  });

  let totalPcs = 0;
  for (const item of items) {
    const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
    totalPcs += getTotalItemPcs(item, jumlahPerKemasan);
  }

  for (const manifest of manifestData) {
    // totalItem menyimpan stok tersisa; jumlahTerjual stok yang sudah dijual
    totalPcs += toNumber(manifest.jumlahTerjual) + toNumber(manifest.totalItem);
  }

  return totalPcs;
}

// Helper function untuk menghitung total penjualan
const calculatePenjualan = (items: any[], diskonNota: number = 0) => {
  let subtotal = 0;
  let totalDiskonItem = 0;

  const calculatedItems = items.map((item) => {
    const hargaJual = toNumber(item.hargaJual);
    const diskonPerItem = toNumber(item.diskonPerItem);
    const jumlahPerKemasan = toNumber(item.barang?.jumlahPerKemasan || 1);

    const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
    const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
      totalPcs,
      jumlahPerKemasan
    );
    const hargaTotal = hargaJual * jumlahDus;
    const hargaPcs =
      jumlahPcs > 0 ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs) : 0;
    const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
    const diskon = diskonPerItem * jumlahDus;

    subtotal += totalHargaSebelumDiskon;
    totalDiskonItem += diskon;

    return {
      ...item,
      totalPcs,
      totalHargaSebelumDiskon,
      totalDiskon: diskon,
      subtotalItem: totalHargaSebelumDiskon - diskon,
    };
  });

  const totalHarga = subtotal - totalDiskonItem - diskonNota;

  return {
    items: calculatedItems,
    ringkasan: {
      subtotal,
      totalDiskonItem,
      diskonNota,
      totalHarga: Math.max(0, totalHarga),
    },
  };
};

// POST: Edit penjualan yang sudah selesai/hutang
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

    const itemsPayload = Array.isArray(body.items) ? body.items : [];
    if (itemsPayload.length === 0) {
      return NextResponse.json(
        { success: false, error: "Item penjualan tidak boleh kosong" },
        { status: 400 }
      );
    }

    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
      include: {
        customer: true,
        karyawan: true,
        items: {
          include: { barang: true },
        },
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
          error: "Hanya penjualan selesai yang bisa diedit",
        },
        { status: 400 }
      );
    }

    if (body.karyawanId !== undefined && body.karyawanId !== null) {
      const karyawan = await prisma.karyawan.findUnique({
        where: { id: parseInt(body.karyawanId) },
      });

      if (!karyawan || karyawan.jenis !== "SALES") {
        return NextResponse.json(
          { success: false, error: "Sales tidak ditemukan" },
          { status: 404 }
        );
      }
    }

    const existingItemsById = new Map(
      penjualan.items.map((item) => [item.id, item])
    );

    const barangIds = Array.from(
      new Set(itemsPayload.map((item: any) => Number(item.barangId)))
    );

    const barangList = await prisma.barang.findMany({
      where: { id: { in: barangIds } },
    });

    const barangById = new Map(barangList.map((barang) => [barang.id, barang]));
    for (const item of penjualan.items) {
      if (!barangById.has(item.barangId)) {
        barangById.set(item.barangId, item.barang);
      }
    }

    const oldQtyByBarangId = new Map<number, number>();
    for (const item of penjualan.items) {
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
      const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
      oldQtyByBarangId.set(
        item.barangId,
        (oldQtyByBarangId.get(item.barangId) || 0) + totalPcs
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
            error: "Barang tidak boleh duplikat dalam satu penjualan",
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

      if (item.id) {
        const existingItem = existingItemsById.get(Number(item.id));
        if (!existingItem) {
          return NextResponse.json(
            { success: false, error: "Item penjualan tidak ditemukan" },
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

      const jumlahPerKemasan = toNumber(barang.jumlahPerKemasan);
      const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
      newQtyByBarangId.set(
        barangId,
        (newQtyByBarangId.get(barangId) || 0) + totalPcs
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

      if (deltaQty > 0) {
        const stokTersedia = toNumber(barang.stok);
        if (stokTersedia < deltaQty) {
          return NextResponse.json(
            {
              success: false,
              error: `Stok ${barang.namaBarang} tidak cukup. Tersedia: ${stokTersedia} pcs, Dibutuhkan: ${deltaQty} pcs`,
            },
            { status: 400 }
          );
        }
      }

      const limitPenjualan = toNumber(barang.limitPenjualan);
      if (limitPenjualan > 0 && newQty > 0) {
        const totalTerjualHariIni = await getTotalPenjualanHariIni(
          barangId,
          penjualanId
        );
        const totalSetelahEdit = totalTerjualHariIni + newQty;
        if (totalSetelahEdit > limitPenjualan) {
          const sisaLimit = Math.max(0, limitPenjualan - totalTerjualHariIni);
          return NextResponse.json(
            {
              success: false,
              error: `LIMIT PENJUALAN TERLAMPAUI!\n\n📦 ${barang.namaBarang}\n⚠️ Limit: ${limitPenjualan} unit/hari\n✅ Terjual: ${totalTerjualHariIni} unit\n🔸 Sisa: ${sisaLimit} unit\n❌ Diubah menjadi: ${newQty} unit\n\nSilakan kurangi jumlah!`,
            },
            { status: 400 }
          );
        }
      }
    }

    const diskonNota = toNumber(body.diskonNota);
    const jumlahDibayar = toNumber(body.jumlahDibayar);
    const metodePembayaran =
      body.metodePembayaran === "TRANSFER" ? "TRANSFER" : "CASH";

    const oldTotalHarga = toNumber(penjualan.totalHarga);
    const oldJumlahDibayar = toNumber(penjualan.jumlahDibayar);
    const oldSisaHutang =
      penjualan.statusPembayaran === "HUTANG"
        ? Math.max(0, oldTotalHarga - oldJumlahDibayar)
        : 0;

    const updated = await prisma.$transaction(async (tx) => {
      const keptItemIds = new Set<number>();

      for (const item of itemsPayload) {
        const itemId = item.id ? Number(item.id) : null;
        const barangId = Number(item.barangId);
        const hargaJual = toNumber(item.hargaJual);
        const diskonPerItem = toNumber(item.diskonPerItem);

        const barang = barangById.get(barangId)!;
        const jumlahPerKemasan = toNumber(barang.jumlahPerKemasan);
        const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
        const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
          totalPcs,
          jumlahPerKemasan
        );

        if (itemId) {
          const existingItem = existingItemsById.get(itemId);
          if (!existingItem) {
            throw new Error("Item penjualan tidak ditemukan");
          }
          keptItemIds.add(itemId);

          const hargaBeli = toNumber(existingItem.hargaBeli);
          const hargaBeliPerPcs = Math.round(hargaBeli / jumlahPerKemasan);
          const hargaJualPerPcs = Math.round(hargaJual / jumlahPerKemasan);

          const labaPerDus = hargaJual - diskonPerItem - hargaBeli;
          const labaFromDus = labaPerDus * jumlahDus;

          const labaPerPcs = hargaJualPerPcs - hargaBeliPerPcs;
          const labaFromPcs = labaPerPcs * jumlahPcs;

          const totalLaba = labaFromDus + labaFromPcs;

          await tx.penjualanItem.update({
            where: { id: itemId },
            data: {
              totalItem: BigInt(totalPcs),
              hargaJual: BigInt(hargaJual),
              diskonPerItem: BigInt(diskonPerItem),
              laba: BigInt(totalLaba),
            },
          });
        } else {
          const hargaBeli = toNumber(barang.hargaBeli);
          const hargaBeliPerPcs = Math.round(hargaBeli / jumlahPerKemasan);
          const hargaJualPerPcs = Math.round(hargaJual / jumlahPerKemasan);

          const labaPerDus = hargaJual - diskonPerItem - hargaBeli;
          const labaFromDus = labaPerDus * jumlahDus;

          const labaPerPcs = hargaJualPerPcs - hargaBeliPerPcs;
          const labaFromPcs = labaPerPcs * jumlahPcs;

          const totalLaba = labaFromDus + labaFromPcs;

          const created = await tx.penjualanItem.create({
            data: {
              penjualanId,
              barangId,
              totalItem: BigInt(totalPcs),
              hargaJual: BigInt(hargaJual),
              hargaBeli: BigInt(hargaBeli),
              diskonPerItem: BigInt(diskonPerItem),
              laba: BigInt(totalLaba),
            },
          });
          keptItemIds.add(created.id);
        }
      }

      const deleteIds = penjualan.items
        .filter((item) => !keptItemIds.has(item.id))
        .map((item) => item.id);

      if (deleteIds.length > 0) {
        await tx.penjualanItem.deleteMany({
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
            data: { stok: { decrement: BigInt(deltaQty) } },
          });
        } else if (deltaQty < 0) {
          await tx.barang.update({
            where: { id: barangId },
            data: { stok: { increment: BigInt(Math.abs(deltaQty)) } },
          });
        }
      }

      const updatedItems = await tx.penjualanItem.findMany({
        where: { penjualanId },
        include: { barang: true },
      });

      const calculation = calculatePenjualan(updatedItems, diskonNota);
      const totalHarga = calculation.ringkasan.totalHarga;

      const kembalian =
        jumlahDibayar >= totalHarga ? jumlahDibayar - totalHarga : 0;
      const statusPembayaran =
        jumlahDibayar >= totalHarga ? "LUNAS" : "HUTANG";
      const sisaHutang =
        statusPembayaran === "HUTANG" ? totalHarga - jumlahDibayar : 0;

      let totalModal = 0;
      let totalLabaSebelum = 0;
      for (const item of updatedItems) {
        const hargaBeli = toNumber(item.hargaBeli);
        const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
        const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
        const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
          totalPcs,
          jumlahPerKemasan
        );

        const modalDus = hargaBeli * jumlahDus;
        const modalPcs =
          jumlahPcs > 0
            ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs)
            : 0;
        totalModal += modalDus + modalPcs;
        totalLabaSebelum += toNumber(item.laba);
      }

      const totalLabaSesudah = totalHarga - totalModal;

      if (diskonNota > 0 && totalLabaSebelum > 0) {
        const adjustmentFactor = totalLabaSesudah / totalLabaSebelum;
        for (const item of updatedItems) {
          const labaOriginal = toNumber(item.laba);
          const labaAdjusted = Math.round(labaOriginal * adjustmentFactor);
          await tx.penjualanItem.update({
            where: { id: item.id },
            data: { laba: BigInt(labaAdjusted) },
          });
        }
      }

      let nextCustomerId = penjualan.customerId;
      let nextNamaCustomer = penjualan.namaCustomer;

      if (body.customerId !== undefined) {
        nextCustomerId = body.customerId ? parseInt(body.customerId) : null;
        nextNamaCustomer = null;
      } else if (body.namaCustomer !== undefined) {
        nextCustomerId = null;
        nextNamaCustomer = body.namaCustomer || null;
      }

      const updateData: any = {
        subtotal: BigInt(calculation.ringkasan.subtotal),
        diskonNota: BigInt(diskonNota),
        totalHarga: BigInt(totalHarga),
        jumlahDibayar: BigInt(jumlahDibayar),
        kembalian: BigInt(kembalian),
        metodePembayaran,
        statusPembayaran,
        tanggalTransaksi: body.tanggalTransaksi
          ? new Date(body.tanggalTransaksi)
          : penjualan.tanggalTransaksi,
        tanggalJatuhTempo:
          statusPembayaran === "HUTANG"
            ? body.tanggalJatuhTempo
              ? new Date(body.tanggalJatuhTempo)
              : penjualan.tanggalJatuhTempo ||
                new Date(new Date().setDate(new Date().getDate() + 30))
            : null,
      };

      if (body.keterangan !== undefined) {
        updateData.keterangan = body.keterangan || null;
      }

      if (body.rutePengiriman !== undefined) {
        updateData.rutePengiriman = body.rutePengiriman || null;
      }

      if (body.karyawanId !== undefined) {
        const nextKaryawanId = body.karyawanId
          ? parseInt(body.karyawanId)
          : null;
        if (nextKaryawanId) {
          updateData.karyawan = { connect: { id: nextKaryawanId } };
        } else {
          updateData.karyawan = { disconnect: true };
        }
      }

      if (nextCustomerId) {
        updateData.customer = { connect: { id: nextCustomerId } };
      } else {
        updateData.customer = { disconnect: true };
      }

      const updatedHeader = await tx.penjualanHeader.update({
        where: { id: penjualanId },
        data: updateData,
        include: {
          customer: true,
          karyawan: true,
          items: {
            include: { barang: true },
          },
        },
      });

      if (!updatedHeader.karyawanId) {
        const oldCustomerId = penjualan.customerId;
        const newCustomerId = updatedHeader.customerId;
        const newSisaHutang = sisaHutang;

        if (oldCustomerId && oldCustomerId !== newCustomerId && oldSisaHutang) {
          await tx.customer.update({
            where: { id: oldCustomerId },
            data: { piutang: { decrement: BigInt(oldSisaHutang) } },
          });
        }

        if (newCustomerId && oldCustomerId !== newCustomerId && newSisaHutang) {
          await tx.customer.update({
            where: { id: newCustomerId },
            data: { piutang: { increment: BigInt(newSisaHutang) } },
          });
        }

        if (newCustomerId && oldCustomerId === newCustomerId) {
          const deltaPiutang = newSisaHutang - oldSisaHutang;
          if (deltaPiutang > 0) {
            await tx.customer.update({
              where: { id: newCustomerId },
              data: { piutang: { increment: BigInt(deltaPiutang) } },
            });
          } else if (deltaPiutang < 0) {
            await tx.customer.update({
              where: { id: newCustomerId },
              data: { piutang: { decrement: BigInt(Math.abs(deltaPiutang)) } },
            });
          }
        }
      }

      return updatedHeader;
    });

    const receipt = {
      kodePenjualan: updated.kodePenjualan,
      tanggal: updated.tanggalTransaksi,
      customer: updated.customer
        ? {
            nama: updated.customer.nama,
            namaToko: updated.customer.namaToko,
            piutang: toNumber(updated.customer.piutang),
            limit_piutang: toNumber(updated.customer.limit_piutang),
          }
        : { nama: nextNamaCustomer, namaToko: null },
      karyawan: updated.karyawan
        ? {
            id: updated.karyawan.id,
            nama: updated.karyawan.nama,
          }
        : updated.namaSales
        ? { nama: updated.namaSales }
        : null,
      items: updated.items.map((item) => ({
        namaBarang: item.barang.namaBarang,
        ...deriveDusPcsFromTotal(
          getTotalItemPcs(item, toNumber(item.barang.jumlahPerKemasan)),
          toNumber(item.barang.jumlahPerKemasan)
        ),
        hargaJual: toNumber(item.hargaJual),
        diskon:
          toNumber(item.diskonPerItem) *
          deriveDusPcsFromTotal(
            getTotalItemPcs(item, toNumber(item.barang.jumlahPerKemasan)),
            toNumber(item.barang.jumlahPerKemasan)
          ).jumlahDus,
        subtotal:
          toNumber(item.hargaJual) *
            deriveDusPcsFromTotal(
              getTotalItemPcs(item, toNumber(item.barang.jumlahPerKemasan)),
              toNumber(item.barang.jumlahPerKemasan)
            ).jumlahDus -
          toNumber(item.diskonPerItem) *
            deriveDusPcsFromTotal(
              getTotalItemPcs(item, toNumber(item.barang.jumlahPerKemasan)),
              toNumber(item.barang.jumlahPerKemasan)
            ).jumlahDus,
      })),
      subtotal: toNumber(updated.subtotal),
      diskonNota: toNumber(updated.diskonNota),
      totalHarga: toNumber(updated.totalHarga),
      metodePembayaran: updated.metodePembayaran,
      jumlahDibayar: toNumber(updated.jumlahDibayar),
      kembalian: toNumber(updated.kembalian),
      sisaHutang:
        updated.statusPembayaran === "HUTANG"
          ? Math.max(
              0,
              toNumber(updated.totalHarga) - toNumber(updated.jumlahDibayar)
            )
          : 0,
      statusPembayaran: updated.statusPembayaran,
      tanggalJatuhTempo: updated.tanggalJatuhTempo,
      tipePenjualan: updated.karyawanId ? "sales" : "toko",
    };

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Penjualan berhasil diupdate",
        data: {
          penjualan: updated,
          receipt,
        },
      })
    );
  } catch (err: any) {
    console.error("Error editing penjualan:", err);
    const message =
      err?.message === "Item penjualan tidak ditemukan"
        ? err.message
        : "Gagal mengupdate penjualan";
    const status = err?.message === "Item penjualan tidak ditemukan" ? 404 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  } finally {
    await prisma.$disconnect();
  }
}
