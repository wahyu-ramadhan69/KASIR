import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated, getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  const authdata = await getAuthData();
  if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (authdata?.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const parsed = Number(id);
    if (!Number.isFinite(parsed)) {
      return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });
    }

    await prisma.hariLibur.delete({ where: { id: parsed } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/hari-libur/[id] error:", error);
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2025") {
      return NextResponse.json({ success: false, error: "Hari libur tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: "Gagal menghapus hari libur" }, { status: 500 });
  }
}
