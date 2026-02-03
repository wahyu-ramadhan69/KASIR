import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function parseMonth(value?: string | null): { start: Date; end: Date } | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return null;
  }
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const monthParam = searchParams.get("month");
    const karyawanIdParam = searchParams.get("karyawanId");

    const range = parseMonth(monthParam);
    if (!range) {
      return NextResponse.json(
        { success: false, error: "Format bulan tidak valid" },
        { status: 400 }
      );
    }

    const karyawanId = karyawanIdParam ? Number(karyawanIdParam) : null;
    if (karyawanIdParam && (!karyawanId || Number.isNaN(karyawanId))) {
      return NextResponse.json(
        { success: false, error: "karyawanId tidak valid" },
        { status: 400 }
      );
    }

    const absensi = await prisma.absensi.findMany({
      where: {
        tanggal: {
          gte: range.start,
          lt: range.end,
        },
        ...(karyawanId ? { karyawanId } : {}),
      },
      include: {
        karyawan: {
          select: {
            id: true,
            nama: true,
            nik: true,
            jenis: true,
          },
        },
      },
      orderBy: [
        { tanggal: "asc" },
        { karyawanId: "asc" },
      ],
    });

    return NextResponse.json({ success: true, data: absensi });
  } catch (error) {
    console.error("Error fetching absensi bulanan:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data absensi bulanan" },
      { status: 500 }
    );
  }
}
