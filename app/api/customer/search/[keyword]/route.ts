import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ keyword: string }> }
) {
  const { keyword } = await params;

  try {
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          {
            nama: {
              contains: keyword,
              mode: "insensitive",
            },
          },
          {
            namaToko: {
              contains: keyword,
              mode: "insensitive",
            },
          },
        ],
      },
      orderBy: { id: "desc" },
    });

    return NextResponse.json({
      success: true,
      keyword,
      count: customers.length,
      data: customers,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Gagal melakukan pencarian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
