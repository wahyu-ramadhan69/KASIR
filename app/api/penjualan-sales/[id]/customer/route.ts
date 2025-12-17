import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

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

// PATCH - Update customer dan sales
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const penjualanId = parseInt(id);
    const body = await request.json();
    const { customerId, karyawanId } = body;

    // Validasi penjualan harus masih dalam status KERANJANG
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
    });

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (penjualan.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        {
          success: false,
          error: "Transaksi sudah diproses, tidak bisa diubah",
        },
        { status: 400 }
      );
    }

    const updateData: any = {};

    // Update customer
    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        return NextResponse.json(
          { success: false, error: "Customer tidak ditemukan" },
          { status: 404 }
        );
      }

      updateData.customerId = customerId;
      updateData.namaCustomer = customer.nama;
    }

    // Update karyawan (sales)
    if (karyawanId) {
      const karyawan = await prisma.karyawan.findUnique({
        where: { id: karyawanId },
      });

      if (!karyawan) {
        return NextResponse.json(
          { success: false, error: "Karyawan tidak ditemukan" },
          { status: 404 }
        );
      }

      // Validasi karyawan harus sales
      if (karyawan.jenis !== "SALES") {
        return NextResponse.json(
          { success: false, error: "Karyawan harus berjenis SALES" },
          { status: 400 }
        );
      }

      updateData.karyawanId = karyawanId;
      updateData.namaSales = karyawan.nama;
    }

    const updatedPenjualan = await prisma.penjualanHeader.update({
      where: { id: penjualanId },
      data: updateData,
      include: {
        customer: true,
        karyawan: true,
        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: updatedPenjualan,
      })
    );
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
