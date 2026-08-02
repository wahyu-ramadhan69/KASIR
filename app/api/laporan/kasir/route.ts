import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require("pdfkit/js/pdfkit.standalone");
import { Buffer } from "node:buffer";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const runtime = "nodejs";

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTanggal(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export async function GET(request: NextRequest) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const baseDate = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();

    const startDate = new Date(baseDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(baseDate);
    endDate.setHours(23, 59, 59, 999);

    const roleUpper = authData.role?.toUpperCase();
    const isAdmin = roleUpper === "ADMIN";
    const requestedUserId = searchParams.get("userId");

    let targetUserId: number | null = null;
    let targetUsername: string | null = null;

    if (isAdmin) {
      if (requestedUserId) {
        const parsedUserId = Number(requestedUserId);
        if (!Number.isNaN(parsedUserId)) {
          const targetUser = await prisma.user.findUnique({
            where: { id: parsedUserId },
            select: { id: true, username: true },
          });
          if (!targetUser) {
            return NextResponse.json(
              { error: "Kasir tidak ditemukan" },
              { status: 404 }
            );
          }
          targetUserId = targetUser.id;
          targetUsername = targetUser.username;
        }
      }
    } else {
      const selfUserId = Number(authData.userId);
      if (!Number.isNaN(selfUserId)) {
        targetUserId = selfUserId;
        targetUsername = authData.username;
      }
    }

    const shouldFilterByUser = targetUserId !== null;
    const userId = targetUserId ?? undefined;

    const totalPenjualanHariIniAgg = await prisma.penjualanHeader.aggregate({
      where: {
        tanggalTransaksi: { gte: startDate, lte: endDate },
        statusTransaksi: "SELESAI",
        isDeleted: false,
        ...(shouldFilterByUser ? { userId: userId as number } : {}),
      },
      _sum: { totalHarga: true },
    });

    const penjualanBayarAgg = await prisma.pembayaranPenjualan.aggregate({
      where: {
        tanggalBayar: { gte: startDate, lte: endDate },
        jenisPembayaran: "PENJUALAN",
        penjualan: { statusTransaksi: "SELESAI", isDeleted: false },
        ...(shouldFilterByUser ? { userId: userId as number } : {}),
      },
      _sum: { totalCash: true, totalTransfer: true },
    });

    const piutangBayarAgg = await prisma.pembayaranPenjualan.aggregate({
      where: {
        tanggalBayar: { gte: startDate, lte: endDate },
        jenisPembayaran: "PIUTANG",
        penjualan: { statusTransaksi: "SELESAI", isDeleted: false },
        ...(shouldFilterByUser ? { userId: userId as number } : {}),
      },
      _sum: { totalCash: true, totalTransfer: true },
    });

    const pengeluaranAgg = await prisma.pengeluaran.aggregate({
      where: {
        tanggalInput: { gte: startDate, lte: endDate },
        ...(shouldFilterByUser ? { userId: userId as number } : {}),
      },
      _sum: { jumlah: true },
    });

    const piutangBelumDibayar = await prisma.penjualanHeader.findMany({
      where: {
        tanggalTransaksi: { gte: startDate, lte: endDate },
        statusTransaksi: "SELESAI",
        statusPembayaran: "HUTANG",
        ...(shouldFilterByUser ? { userId: userId as number } : {}),
      },
      select: {
        totalHarga: true,
        jumlahDibayar: true,
      },
    });

    const totalPenjualanHariIni = Number(
      totalPenjualanHariIniAgg._sum.totalHarga || 0
    );
    const penjualanCash = Number(penjualanBayarAgg._sum.totalCash || 0);
    const penjualanTransfer = Number(
      penjualanBayarAgg._sum.totalTransfer || 0
    );
    const totalPembayaranPenjualan = penjualanCash + penjualanTransfer;
    const piutangCash = Number(piutangBayarAgg._sum.totalCash || 0);
    const piutangTransfer = Number(piutangBayarAgg._sum.totalTransfer || 0);
    const totalPembayaranPiutang = piutangCash + piutangTransfer;
    const totalPengeluaran = Number(pengeluaranAgg._sum.jumlah || 0);
    const totalSisaPiutang = piutangBelumDibayar.reduce((sum, item) => {
      const total = Number(item.totalHarga || 0);
      const dibayar = Number(item.jumlahDibayar || 0);
      return sum + Math.max(0, total - dibayar);
    }, 0);
    const setoranCash = penjualanCash + piutangCash;
    const setoranTransfer = penjualanTransfer + piutangTransfer;

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
    });

    const chunks: Uint8Array[] = [];
    const pdfBufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk: any) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const pageWidth = doc.page.width;
    const contentWidth =
      pageWidth - doc.page.margins.left - doc.page.margins.right;

    doc.rect(0, 0, pageWidth, 110).fill("#0f172a");

    let logoBase64: string | null = null;
    const host =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    const protoHeader = request.headers.get("x-forwarded-proto");
    const protocol =
      protoHeader ||
      (request.nextUrl?.protocol
        ? request.nextUrl.protocol.replace(":", "")
        : "http");

    if (host) {
      try {
        const logoRes = await fetch(`${protocol}://${host}/sembako.png`);
        if (logoRes.ok) {
          const logoArrayBuffer = await logoRes.arrayBuffer();
          logoBase64 = Buffer.from(logoArrayBuffer).toString("base64");
        }
      } catch {
        logoBase64 = null;
      }
    }

    if (!logoBase64) {
      try {
        const { readFile } = await import("node:fs/promises");
        const logoPath = path.join(process.cwd(), "public", "sembako.png");
        const logoBuffer = await readFile(logoPath);
        logoBase64 = logoBuffer.toString("base64");
      } catch {
        logoBase64 = null;
      }
    }

    if (logoBase64) {
      doc.image(`data:image/png;base64,${logoBase64}`, 40, 22, {
        width: 66,
        height: 66,
      });
    }

    doc
      .fillColor("#ffffff")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Laporan Kasir Harian", 120, 28, { align: "left" });

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#cbd5f5")
      .text(`Tanggal: ${formatTanggal(startDate)}`, 120, 55);

    doc
      .fontSize(10)
      .fillColor("#94a3b8")
      .text(
        shouldFilterByUser
          ? `Petugas: ${targetUsername ?? authData.username}`
          : "Ringkasan Semua Kasir",
        120,
        72
      );

    doc.fillColor("#0f172a");

    // const drawCard = (
    //   x: number,
    //   y: number,
    //   title: string,
    //   value: string,
    //   subtitle: string,
    //   color: string
    // ) => {
    //   doc.roundedRect(x, y, cardWidth, cardHeight, 10).fill(color);
    //   doc
    //     .fillColor("#ffffff")
    //     .font("Helvetica-Bold")
    //     .fontSize(12)
    //     .text(title, x + 16, y + 14, { width: cardWidth - 32 });
    //   doc.fontSize(16).text(value, x + 16, y + 36, { width: cardWidth - 32 });
    //   doc
    //     .font("Helvetica")
    //     .fontSize(9)
    //     .fillColor("#e2e8f0")
    //     .text(subtitle, x + 16, y + 60, { width: cardWidth - 32 });
    // };

    // drawCard(
    //   doc.page.margins.left,
    //   summaryTop,
    //   "Pembayaran Penjualan",
    //   formatRupiah(totalPenjualan),
    //   "Jenis pembayaran: PENJUALAN",
    //   "#6366f1"
    // );

    // drawCard(
    //   doc.page.margins.left + cardWidth + cardGap,
    //   summaryTop,
    //   "Pembayaran Piutang",
    //   formatRupiah(totalPiutang),
    //   "Jenis pembayaran: PIUTANG",
    //   "#0ea5e9"
    // );

    // drawCard(
    //   doc.page.margins.left + (cardWidth + cardGap) * 2,
    //   summaryTop,
    //   "Setoran",
    //   formatRupiah(totalSetoran),
    //   "Penjualan + Piutang - Pengeluaran - Kerugian",
    //   "#10b981"
    // );

    const detailTop = 120;
    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Rincian Keuangan", doc.page.margins.left, detailTop);

    const tableTop = detailTop + 16;
    const rowHeight = 28;
    const tableWidth = contentWidth;

    doc
      .roundedRect(doc.page.margins.left, tableTop, tableWidth, rowHeight, 6)
      .fill("#e2e8f0");

    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("Keterangan", doc.page.margins.left + 14, tableTop + 7);

    doc.text("Jumlah", doc.page.margins.left + tableWidth - 160, tableTop + 7, {
      width: 140,
      align: "right",
    });

    const rows: { label: string; value: number; indent?: boolean }[] = [
      { label: "Total Penjualan Hari Ini (Toko & Sales)", value: totalPenjualanHariIni },
      { label: "Total Pembayaran Penjualan", value: totalPembayaranPenjualan },
      { label: "Cash", value: penjualanCash, indent: true },
      { label: "Transfer", value: penjualanTransfer, indent: true },
      { label: "Total Pembayaran Piutang", value: totalPembayaranPiutang },
      { label: "Cash", value: piutangCash, indent: true },
      { label: "Transfer", value: piutangTransfer, indent: true },
      { label: "Total Piutang", value: totalSisaPiutang },
      { label: "Total Pengeluaran", value: totalPengeluaran },
      { label: "Setoran Cash", value: setoranCash },
      { label: "Setoran Transfer", value: setoranTransfer },
    ];

    rows.forEach((row, index) => {
      const y = tableTop + rowHeight + index * rowHeight;
      doc
        .roundedRect(doc.page.margins.left, y, tableWidth, rowHeight, 6)
        .fill(index % 2 === 0 ? "#f8fafc" : "#ffffff");

      doc
        .fillColor(row.indent ? "#64748b" : "#0f172a")
        .font(row.indent ? "Helvetica" : "Helvetica-Bold")
        .fontSize(row.indent ? 9 : 10)
        .text(row.label, doc.page.margins.left + (row.indent ? 28 : 14), y + 8);

      doc
        .fillColor(row.indent ? "#64748b" : "#0f172a")
        .font(row.indent ? "Helvetica" : "Helvetica-Bold")
        .fontSize(row.indent ? 9 : 10)
        .text(
          formatRupiah(row.value),
          doc.page.margins.left + tableWidth - 160,
          y + 8,
          { width: 140, align: "right" }
        );
    });

    const footerTop = tableTop + rowHeight + rows.length * rowHeight + 26;
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#64748b")
      .text(
        "Catatan: Laporan ini dihasilkan otomatis dari sistem kasir.",
        doc.page.margins.left,
        footerTop
      );

    doc.end();

    const pdfBuffer = await pdfBufferPromise;
    const namePart = shouldFilterByUser
      ? `-${(targetUsername ?? authData.username).replace(/\s+/g, "_")}`
      : "";
    const filename = `Laporan-Kasir${namePart}-${startDate
      .toISOString()
      .slice(0, 10)}.pdf`;

    // Convert Buffer to Uint8Array explicitly
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating kasir report:", error);
    return NextResponse.json(
      { success: false, error: "Gagal membuat laporan kasir" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
