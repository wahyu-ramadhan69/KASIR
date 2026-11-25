// app/api/penjualan/[id]/edit/route.ts
// Edit langsung penjualan yang sudah SELESAI.
// Logika edit ada di app/lib/penjualanEdit.ts.
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated, getAuthData } from "@/app/AuthGuard";
import {
  deepSerialize,
  editPenjualan,
  EditPenjualanError,
} from "@/app/lib/penjualanEdit";
import { kasirEditButuhApproval } from "@/app/lib/permintaanEdit";

const prisma = new PrismaClient();

// POST: Edit penjualan yang sudah selesai/hutang
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const penjualanId = parseInt(id);
    const body = await request.json();

    const authData = await getAuthData();
    const authUserId = authData?.userId
      ? parseInt(authData.userId, 10)
      : undefined;
    const isKasir = authData?.role === "KASIR";

    const result = await editPenjualan(prisma, penjualanId, body, {
      actorUserId: authUserId,
      assertPenjualan: (penjualan) => {
        // Kasir: transaksi tanggal sebelumnya wajib lewat permintaan edit
        // (approval admin). Transaksi hari ini boleh langsung.
        if (
          isKasir &&
          kasirEditButuhApproval(
            penjualan.tanggalTransaksi,
            body.tanggalTransaksi
          )
        ) {
          throw new EditPenjualanError(
            "Edit transaksi tanggal sebelumnya harus melalui permintaan edit dan disetujui admin",
            403
          );
        }
      },
    });

    if (!result) {
      throw new Error("Edit tidak menghasilkan data");
    }

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Penjualan berhasil diupdate",
        data: {
          penjualan: result.updated,
          receipt: result.receipt,
        },
      })
    );
  } catch (err: any) {
    if (err instanceof EditPenjualanError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }
    console.error("Error editing penjualan:", err);
    const message =
      err?.message === "Item penjualan tidak ditemukan"
        ? err.message
        : "Gagal mengupdate penjualan";
    const status =
      err?.message === "Item penjualan tidak ditemukan" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  } finally {
    await prisma.$disconnect();
  }
}
