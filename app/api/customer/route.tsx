import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nik, nama, alamat, namaToko, noHp, limit_piutang, piutang } = body;

    if (!nik || !nama || !alamat || !namaToko || !noHp) {
      return NextResponse.json(
        { success: false, error: "Semua field wajib harus diisi" },
        { status: 400 }
      );
    }

    // CEK JIKA NIK SUDAH TERDAFTAR
    const exist = await prisma.customer.findUnique({
      where: { nik },
    });

    if (exist) {
      return NextResponse.json(
        { success: false, error: "NIK sudah terdaftar" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        nik,
        nama,
        alamat,
        namaToko,
        noHp,
        limit_piutang: limit_piutang ?? 0,
        piutang: piutang ?? 0,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Customer berhasil ditambahkan",
        data: customer,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creating customer:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat membuat customer" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET all customers
export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { id: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: customers,
    });
  } catch (err) {
    console.error("Error fetching customers:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengambil data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
