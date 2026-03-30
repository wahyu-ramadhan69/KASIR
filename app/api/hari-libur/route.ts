import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated, getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");

    const where: { tanggal?: { gte: Date; lt: Date } } = {};
    if (year) {
      const y = Number(year);
      where.tanggal = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
    }

    const data = await prisma.hariLibur.findMany({ where, orderBy: { tanggal: "asc" } });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/hari-libur error:", error);
    return NextResponse.json({ success: false, error: "Gagal mengambil daftar hari libur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  const authdata = await getAuthData();
  if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (authdata?.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const { tanggal, keterangan } = body;

    if (!tanggal || typeof tanggal !== "string") {
      return NextResponse.json({ success: false, error: "Tanggal wajib diisi (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!keterangan || typeof keterangan !== "string" || !keterangan.trim()) {
      return NextResponse.json({ success: false, error: "Keterangan wajib diisi" }, { status: 400 });
    }

    const [y, m, d] = tanggal.split("-").map(Number);
    const tanggalDate = new Date(y, m - 1, d, 0, 0, 0, 0);

    const data = await prisma.hariLibur.create({
      data: { tanggal: tanggalDate, keterangan: keterangan.trim() },
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/hari-libur error:", error);
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ success: false, error: "Tanggal tersebut sudah terdaftar sebagai hari libur" }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: "Gagal menambah hari libur" }, { status: 500 });
  }
}
