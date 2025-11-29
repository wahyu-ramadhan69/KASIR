import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Helper function to convert BigInt to number safely
function bigIntToNumber(value: bigint | number): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

// Helper to serialize customer data with BigInt conversion
function serializeCustomer(customer: any) {
  return {
    ...customer,
    limit_piutang: bigIntToNumber(customer.limit_piutang),
    piutang: bigIntToNumber(customer.piutang),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keyword: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keyword } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "12");
  const skip = (page - 1) * limit;

  try {
    const whereClause = {
      OR: [
        {
          nama: {
            contains: keyword,
            mode: "insensitive" as const,
          },
        },
        {
          namaToko: {
            contains: keyword,
            mode: "insensitive" as const,
          },
        },
        {
          nik: {
            contains: keyword,
          },
        },
        {
          alamat: {
            contains: keyword,
            mode: "insensitive" as const,
          },
        },
        {
          noHp: {
            contains: keyword,
          },
        },
      ],
    };

    // Get total count for search results
    const totalCount = await prisma.customer.count({
      where: whereClause,
    });

    // Get customers with pagination
    const customers = await prisma.customer.findMany({
      where: whereClause,
      orderBy: { id: "desc" },
      skip,
      take: limit,
    });

    const serializedCustomers = customers.map(serializeCustomer);
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      success: true,
      keyword,
      data: serializedCustomers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasMore,
      },
    });
  } catch (err) {
    console.error("Error searching customers:", err);
    return NextResponse.json(
      { success: false, error: "Gagal melakukan pencarian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
