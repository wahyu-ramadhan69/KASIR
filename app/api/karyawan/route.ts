// app/api/karyawan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";

    const where: any = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { nama: { contains: search, mode: "insensitive" } },
        { nik: { contains: search, mode: "insensitive" } },
      ];
    }

    const karyawan = await prisma.karyawan.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: {
          id: parseInt(cursor),
        },
      }),
      orderBy: {
        id: "desc",
      },
    });

    let nextCursor: number | null = null;
    if (karyawan.length > limit) {
      const nextItem = karyawan.pop();
      nextCursor = nextItem!.id;
    }

    return NextResponse.json({
      data: karyawan,
      nextCursor,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch karyawan" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const karyawan = await prisma.karyawan.create({
      data: {
        nama: body.nama,
        nik: body.nik,
        noHp: body.noHp,
        alamat: body.alamat,
        jenis: body.jenis,
        gajiPokok: body.gajiPokok,
        tunjanganMakan: body.tunjanganMakan,
        totalPinjaman: body.totalPinjaman || 0,
        sisaPinjaman: body.sisaPinjaman || 0,
        cicilanPerBulan: body.cicilanPerBulan || 0,
      },
    });

    return NextResponse.json(karyawan, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create karyawan" },
      { status: 500 }
    );
  }
}
