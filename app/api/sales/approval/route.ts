// =====================================================
// PATH: app/api/sales/approval/route.ts
// Endpoint approval order sales oleh KASIR/ADMIN
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData, isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

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

function calculatePenjualan(items: any[], diskonNota: number = 0) {
  let subtotal = 0;
  let totalDiskonItem = 0;

  items.forEach((item) => {
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
      jumlahPcs > 0
        ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs)
        : 0;
    const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
    const diskon = diskonPerItem * jumlahDus;

    subtotal += totalHargaSebelumDiskon;
    totalDiskonItem += diskon;
  });

  const totalHarga = subtotal - totalDiskonItem - diskonNota;

  return {
    subtotal,
    totalDiskonItem,
    totalHarga: Math.max(0, totalHarga),
  };
}

// Deep serialize to handle all BigInt and null values in nested objects
function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(deepSerialize);
  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = deepSerialize(obj[key]);
      }
    }
    return serialized;
  }
  return obj;
}

export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (authData.role !== "ADMIN" && authData.role !== "KASIR") {
      return NextResponse.json(
        { error: "Forbidden: hanya ADMIN/KASIR" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      penjualanId,
      items,
      metodePembayaran,
      jumlahDibayar,
      totalCash,
      totalTransfer,
      action,
    } = body;

    if (!penjualanId) {
      return NextResponse.json(
        { success: false, error: "penjualanId wajib diisi" },
        { status: 400 }
      );
    }

    const id = Number(penjualanId);
    const userId = Number(authData.userId);

    const result = await prisma.$transaction(async (tx) => {
      const penjualan = await tx.penjualanHeader.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              barang: true,
            },
          },
        },
      });

      if (!penjualan) {
        throw new Error("Penjualan tidak ditemukan");
      }

      if (penjualan.statusApproval !== "PENDING") {
        throw new Error("Penjualan sudah diproses approval");
      }

      if (penjualan.statusTransaksi !== "KERANJANG") {
        throw new Error("Penjualan tidak bisa di-approve");
      }

      if (action === "REJECT") {
        const updatedHeader = await tx.penjualanHeader.update({
          where: { id },
          data: {
            statusApproval: "REJECTED",
            statusTransaksi: "DIBATALKAN",
            approvedAt: new Date(),
            approvedById: userId,
          },
        });
        return updatedHeader;
      }

      let itemsToProcess = penjualan.items;
      let recalculatedTotals: { totalHarga: number } | null = null;

      // Jika ada adjustment items dari client
      if (Array.isArray(items)) {
        if (items.length === 0) {
          throw new Error("Item penjualan tidak boleh kosong");
        }
        const itemMap = new Map(penjualan.items.map((it) => [it.id, it]));
        const updatedItems: any[] = [];
        const keepIds = new Set<number>();

        for (const rawItem of items) {
          const itemId = Number(rawItem.id);
          const existing = itemMap.get(itemId);
          if (!existing) {
            throw new Error("Item penjualan tidak valid");
          }
          keepIds.add(existing.id);
          const jumlahPerKemasan = toNumber(
            existing.barang?.jumlahPerKemasan || 1
          );
          const totalPcs = getTotalItemPcs(rawItem, jumlahPerKemasan);
          if (totalPcs <= 0) {
            throw new Error("Jumlah item harus lebih dari 0");
          }

          const beratPerItem = toNumber(existing.barang?.berat || 0);
          const berat = beratPerItem > 0 ? beratPerItem * totalPcs : 0;

          const updated = await tx.penjualanItem.update({
            where: { id: existing.id },
            data: {
              totalItem: totalPcs,
              hargaJual: toNumber(rawItem.hargaJual),
              diskonPerItem: toNumber(rawItem.diskonPerItem || 0),
              berat,
            },
            include: { barang: true },
          });

          updatedItems.push(updated);
        }

        const idsToDelete = penjualan.items
          .filter((it) => !keepIds.has(it.id))
          .map((it) => it.id);

        if (idsToDelete.length > 0) {
          await tx.penjualanItem.deleteMany({
            where: { id: { in: idsToDelete } },
          });
        }

        const recalculated = calculatePenjualan(
          updatedItems,
          toNumber(penjualan.diskonNota)
        );
        await tx.penjualanHeader.update({
          where: { id },
          data: {
            subtotal: recalculated.subtotal,
            totalHarga: recalculated.totalHarga,
          },
        });
        recalculatedTotals = { totalHarga: recalculated.totalHarga };

        itemsToProcess = updatedItems;
      }

      for (const item of itemsToProcess) {
        const totalPcs = toNumber(item.totalItem);
        if (toNumber(item.barang.stok) < totalPcs) {
          throw new Error(`Stok ${item.barang.namaBarang} tidak mencukupi`);
        }
      }

      const finalMetodePembayaran =
        metodePembayaran || penjualan.metodePembayaran;
      const finalJumlahDibayar =
        jumlahDibayar !== undefined && jumlahDibayar !== null
          ? toNumber(jumlahDibayar)
          : toNumber(penjualan.jumlahDibayar);
      const totalHargaFinal = toNumber(
        recalculatedTotals?.totalHarga ?? penjualan.totalHarga
      );
      const statusPembayaranFinal =
        finalJumlahDibayar >= totalHargaFinal ? "LUNAS" : "HUTANG";
      const kembalianFinal = Math.max(0, finalJumlahDibayar - totalHargaFinal);

      if (statusPembayaranFinal === "HUTANG" && !penjualan.customerId) {
        throw new Error(
          "Customer tidak terdaftar tidak bisa mengambil hutang"
        );
      }

      let totalCashFinal = toNumber(totalCash);
      let totalTransferFinal = toNumber(totalTransfer);
      if (finalMetodePembayaran === "TRANSFER") {
        totalCashFinal = 0;
        totalTransferFinal =
          totalTransferFinal > 0 ? totalTransferFinal : finalJumlahDibayar;
      } else if (finalMetodePembayaran === "CASH_TRANSFER") {
        if (totalCashFinal === 0 && totalTransferFinal === 0) {
          totalCashFinal = finalJumlahDibayar;
        }
      } else {
        totalTransferFinal = 0;
        totalCashFinal =
          totalCashFinal > 0 ? totalCashFinal : finalJumlahDibayar;
      }

      const updatedHeader = await tx.penjualanHeader.update({
        where: { id },
        data: {
          statusApproval: "APPROVED",
          statusTransaksi: "SELESAI",
          approvedAt: new Date(),
          approvedById: userId,
          tanggalTransaksi: new Date(),
          metodePembayaran: finalMetodePembayaran,
          statusPembayaran: statusPembayaranFinal,
          jumlahDibayar: finalJumlahDibayar,
          kembalian: kembalianFinal,
        },
      });

      for (const item of itemsToProcess) {
        const totalPcs = toNumber(item.totalItem);
        await tx.barang.update({
          where: { id: item.barangId },
          data: {
            stok: {
              decrement: totalPcs,
            },
          },
        });
      }

      return updatedHeader;
    });

    const message =
      action === "REJECT"
        ? "Penjualan berhasil ditolak"
        : "Penjualan berhasil di-approve";
    return NextResponse.json(
      deepSerialize({
        success: true,
        message,
        data: result,
      }),
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error approving sales order:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal approval" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = authData.role;
    if (role !== "ADMIN" && role !== "KASIR" && role !== "SALES") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get("page") || "1");
    const rawLimit = parseInt(searchParams.get("limit") || "20");
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20;
    const skip = (page - 1) * limit;
    const statusApproval = searchParams.get("statusApproval");
    const statusTransaksi = searchParams.get("statusTransaksi");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {
      createdById: { not: null },
    };

    if (role === "SALES") {
      where.createdById = Number(authData.userId);
    }

    if (statusApproval && statusApproval !== "all") {
      where.statusApproval = statusApproval;
    }

    if (statusTransaksi && statusTransaksi !== "all") {
      where.statusTransaksi = statusTransaksi;
    }

    if (search) {
      where.OR = [
        { kodePenjualan: { contains: search, mode: "insensitive" } },
        { namaCustomer: { contains: search, mode: "insensitive" } },
        { customer: { nama: { contains: search, mode: "insensitive" } } },
        { customer: { namaToko: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (startDate || endDate) {
      where.tanggalTransaksi = {};
      if (startDate) {
        where.tanggalTransaksi.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.tanggalTransaksi.lte = end;
      }
    }

    const totalCount = await prisma.penjualanHeader.count({ where });
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    // Guard: jika page melebihi totalPages atau data memang kosong, return lebih awal
    if (totalCount === 0 || page > totalPages) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasMore: false,
        },
      });
    }

    const data = await prisma.penjualanHeader.findMany({
      where,
      select: {
        id: true,
        kodePenjualan: true,
        namaCustomer: true,
        statusApproval: true,
        statusTransaksi: true,
        statusPembayaran: true,
        metodePembayaran: true,
        subtotal: true,
        totalHarga: true,
        diskonNota: true,
        jumlahDibayar: true,
        kembalian: true,
        tanggalTransaksi: true,
        createdAt: true,
        customerId: true,
        customer: {
          select: {
            id: true,
            nama: true,
            namaToko: true,
          },
        },
        items: {
          select: {
            id: true,
            barangId: true,
            totalItem: true,
            hargaJual: true,
            diskonPerItem: true,
            barang: {
              select: {
                id: true,
                namaBarang: true,
                jumlahPerKemasan: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            role: true,
            karyawan: { select: { nama: true } },
          },
        },
        approvedBy: {
          select: { id: true, username: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        data,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasMore,
        },
      })
    );
  } catch (err: any) {
    console.error("Error fetching sales orders:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengambil data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}