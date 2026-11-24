// =====================================================
// PATH: app/api/permintaan-edit-penjualan/count/route.ts
// Jumlah permintaan edit yang menunggu approval (badge lonceng admin)
// =====================================================
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function GET() {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (authData.role !== "ADMIN") {
    return NextResponse.json({ success: true, pending: 0 });
  }

  try {
    const pending = await prisma.permintaanEditPenjualan.count({
      where: { status: "PENDING" },
    });
    return NextResponse.json({ success: true, pending });
  } catch (error) {
    console.error("Error counting permintaan edit:", error);
    return NextResponse.json(
      { success: false, pending: 0 },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
