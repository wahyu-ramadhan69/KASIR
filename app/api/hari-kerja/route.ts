import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated, getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

async function getOrCreateHariKerja() {
  let data = await prisma.hariKerja.findFirst();
  if (!data) {
    data = await prisma.hariKerja.create({
      data: { senin: true, selasa: true, rabu: true, kamis: true, jumat: true, sabtu: true, minggu: false },
    });
  }
  return data;
}

export async function GET() {
  try {
    const data = await getOrCreateHariKerja();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/hari-kerja error:", error);
    return NextResponse.json({ success: false, error: "Gagal mengambil konfigurasi hari kerja" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await isAuthenticated();
  const authdata = await getAuthData();
  if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (authdata?.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const fields = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"] as const;

    const update: Record<string, boolean> = {};
    for (const field of fields) {
      if (typeof body[field] !== "boolean") {
        return NextResponse.json({ success: false, error: `Field '${field}' harus boolean` }, { status: 400 });
      }
      update[field] = body[field];
    }

    const existing = await getOrCreateHariKerja();
    const data = await prisma.hariKerja.update({ where: { id: existing.id }, data: update });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("PUT /api/hari-kerja error:", error);
    return NextResponse.json({ success: false, error: "Gagal menyimpan konfigurasi hari kerja" }, { status: 500 });
  }
}
