// app/api/supplier/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { namaSupplier, alamat, noHp, limitHutang, hutang } = body;

    if (
      !namaSupplier ||
      !alamat ||
      !noHp ||
      limitHutang == null ||
      hutang == null
    ) {
      return NextResponse.json(
        { success: false, error: "Semua field harus diisi" },
        { status: 400 }
      );
    }

    if (
      typeof namaSupplier !== "string" ||
      typeof alamat !== "string" ||
      typeof noHp !== "string"
    ) {
      return NextResponse.json(
        { success: false, error: "Nama, alamat, dan noHp harus berupa string" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        namaSupplier: namaSupplier.trim(),
        alamat: alamat.trim(),
        noHp: noHp.trim(),
        limitHutang: Number(limitHutang),
        hutang: Number(hutang),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Supplier berhasil ditambahkan",
        data: supplier,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating supplier:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Terjadi kesalahan saat menambahkan supplier",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { id: "desc" },
      include: {
        barang: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: suppliers,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching supplier:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Terjadi kesalahan saat mengambil data supplier",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
