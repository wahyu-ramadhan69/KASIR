import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";

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

// GET: Ambil pengembalian barang dengan filter dan pagination
export async function GET(request: NextRequest) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const barangId = searchParams.get("barangId");
    const kondisiBarang = searchParams.get("kondisiBarang");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const withoutPerjalanan = searchParams.get("withoutPerjalanan") === "true";
    const withKaryawan = searchParams.get("withKaryawan") === "true";
    const karyawanId = searchParams.get("karyawanId");

    const where: any = {};
    const roleUpper = authData.role?.toUpperCase();
    const userId = Number(authData.userId);
    const shouldFilterByUser = roleUpper !== "ADMIN" && !Number.isNaN(userId);

    if (barangId) {
      where.barangId = parseInt(barangId);
    }

    if (withoutPerjalanan) {
      where.perjalananId = null;
    } else if (withKaryawan) {
      where.perjalananId = { not: null };
    }

    if (karyawanId) {
      where.perjalanan = {
        karyawanId: parseInt(karyawanId),
      };
    }

    if (kondisiBarang && kondisiBarang !== "all") {
      where.kondisiBarang = kondisiBarang;
    }

    if (search) {
      where.OR = [
        { barang: { namaBarang: { contains: search, mode: "insensitive" } } },
        { keterangan: { contains: search, mode: "insensitive" } },
      ];
    }

    if (startDate || endDate) {
      where.tanggalPengembalian = {};
      if (startDate) {
        where.tanggalPengembalian.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.tanggalPengembalian.lte = end;
      }
    }

    if (shouldFilterByUser) {
      where.userId = userId;
    }

    const totalCount = await prisma.pengembalianBarang.count({ where });

    const pengembalian = await prisma.pengembalianBarang.findMany({
      where,
      include: {
        barang: {
          select: {
            id: true,
            namaBarang: true,
            jumlahPerKemasan: true,
          },
        },
        ...(withKaryawan && {
          perjalanan: {
            select: {
              id: true,
              karyawan: {
                select: {
                  id: true,
                  nama: true,
                  nik: true,
                },
              },
            },
          },
        }),
      },
      orderBy: { tanggalPengembalian: "desc" },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: pengembalian,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasMore,
        },
      })
    );
  } catch (err) {
    console.error("Error fetching pengembalian:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data pengembalian" },
      { status: 500 }
    );
  }
}

// POST: Catat pengembalian barang (perjalanan sales)
export async function POST(request: NextRequest) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { pengembalianBarang } = body;

    if (!pengembalianBarang || pengembalianBarang.length === 0) {
      return NextResponse.json(
        { success: false, message: "Data pengembalian tidak boleh kosong" },
        { status: 400 }
      );
    }

    const barangIds: number[] = pengembalianBarang.map(
      (item: any) => item.barangId
    );

    const barangList = await prisma.barang.findMany({
      where: {
        id: { in: barangIds },
      },
    });

    const pengembalianData = [];
    const barangUpdates: any[] = [];

    for (const item of pengembalianBarang) {
      const barang = barangList.find((b) => b.id === item.barangId);
      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message: `Barang dengan ID ${item.barangId} tidak ditemukan`,
          },
          { status: 404 }
        );
      }

      const totalKembaliPcs =
        Number(item.jumlahDus) * Number(barang.jumlahPerKemasan) +
        Number(item.jumlahPcs);

      pengembalianData.push({
        barangId: item.barangId,
        jumlahDus: BigInt(item.jumlahDus),
        jumlahPcs: BigInt(item.jumlahPcs),
        kondisiBarang: item.kondisiBarang,
        keterangan: item.keterangan,
        userId: Number(authData.userId),
      });

      if (item.kondisiBarang === "BAIK") {
        barangUpdates.push(
          prisma.barang.update({
            where: { id: item.barangId },
            data: {
              stok: {
                increment: BigInt(totalKembaliPcs),
              },
            },
          })
        );
      }
    }

    await prisma.$transaction([
      ...barangUpdates,
      prisma.pengembalianBarang.createMany({
        data: pengembalianData,
      }),
    ]);

    const createdPengembalian = await prisma.pengembalianBarang.findMany({
      where: {
        id: {
          in: (
            await prisma.pengembalianBarang.findMany({
              orderBy: { id: "desc" },
              take: pengembalianData.length,
            })
          ).map((p) => p.id),
        },
      },
      include: {
        barang: {
          select: {
            id: true,
            namaBarang: true,
            jumlahPerKemasan: true,
          },
        },
      },
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Pengembalian barang berhasil dicatat",
        data: createdPengembalian,
      }),
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Error creating pengembalian:", err);
    return NextResponse.json(
      {
        success: false,
        message: err.message || "Gagal mencatat pengembalian barang",
      },
      { status: 500 }
    );
  }
}
