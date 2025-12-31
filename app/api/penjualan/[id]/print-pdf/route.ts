import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";

// Singleton pattern untuk Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await context.params;
    const id = parseInt(idParam);

    // Ambil data penjualan dengan relasi
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id },
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

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    // 80mm paper width in points (1mm = 2.83465 pt)
    const paperWidth = 80 * 2.83465;
    const margin = 8;
    const contentWidth = paperWidth - margin * 2;
    const baseHeight = 260;
    const perItemHeight = 16;
    const discountCount = penjualan.items.filter(
      (item) => Number(item.diskonPerItem) > 0
    ).length;
    const paperHeight = Math.max(
      420,
      baseHeight +
        penjualan.items.length * perItemHeight +
        discountCount * 8
    );

    const doc = new PDFDocument({
      size: [paperWidth, paperHeight],
      margins: { top: margin, bottom: margin, left: margin, right: margin },
    });

    const chunks: Uint8Array[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {});

    // Format rupiah
    const formatRupiah = (amount: number): string => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    // Format tanggal
    const formatDate = (dateString: string): string => {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    };

    const formatBeratKg = (grams: number | bigint): string => {
      const kg = Number(grams) / 1000;
      const trimmed = kg.toFixed(3).replace(/\.?0+$/, "");
      return trimmed.replace(".", ",");
    };

    // Header
    doc.fontSize(14).font("Helvetica-Bold").text("NOTA PENJUALAN", {
      align: "center",
    });

    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica-Bold").text("Toko ABC", {
      align: "center",
    });
    doc.font("Helvetica").text("Jl. Contoh No. 123, Jakarta", {
      align: "center",
    });
    doc.text("Telp: 021-12345678", { align: "center" });

    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(paperWidth - margin, doc.y).stroke();
    doc.moveDown(0.5);

    // Info Transaksi
    const leftCol = margin;
    let currentY = doc.y;

    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("No Nota:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(penjualan.kodePenjualan || "-", leftCol + 55, currentY);

    currentY += 12;
    doc.font("Helvetica-Bold").text("Tanggal:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(
        formatDate(penjualan.createdAt.toISOString()),
        leftCol + 55,
        currentY
      );

    currentY += 12;
    doc.font("Helvetica-Bold").text("Customer:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(penjualan.customer?.nama || "-", leftCol + 55, currentY);

    currentY += 12;
    doc.font("Helvetica-Bold").text("Sales:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(penjualan.karyawan?.nama || "-", leftCol + 55, currentY);

    currentY += 12;
    doc.font("Helvetica-Bold").text("Metode:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(penjualan.metodePembayaran || "-", leftCol + 55, currentY);

    currentY += 12;
    doc.font("Helvetica-Bold").text("Status:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(penjualan.statusPembayaran || "-", leftCol + 55, currentY);

    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(paperWidth - margin, doc.y).stroke();
    doc.moveDown(0.5);

    // Header Tabel
    currentY = doc.y;
    doc.fontSize(8.5).font("Helvetica-Bold");
    const colItem = leftCol;
    const colQty = leftCol + 96;
    const colHarga = leftCol + 140;
    const colTotal = leftCol + 178;
    doc.text("Item", colItem, currentY, { width: 92 });
    doc.text("Qty", colQty, currentY, { width: 40, align: "center" });
    doc.text("Harga", colHarga, currentY, { width: 35, align: "right" });
    doc.text("Total", colTotal, currentY, {
      width: contentWidth - (colTotal - leftCol),
      align: "right",
    });

    currentY += 10;
    doc.moveTo(margin, currentY).lineTo(paperWidth - margin, currentY).stroke();
    currentY += 5;

    // Items
    doc.font("Helvetica").fontSize(8.5);
    let subtotal = 0;

    for (const item of penjualan.items) {
      const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan) || 1;
      const jumlahTotal =
        item.totalItem !== undefined && item.totalItem !== null
          ? Number(item.totalItem)
          : item.jumlahDus * jumlahPerKemasan + item.jumlahPcs;
      const jumlahDus = Math.floor(jumlahTotal / jumlahPerKemasan);
      const jumlahPcs = jumlahTotal % jumlahPerKemasan;
      const hargaSatuan = Number(item.hargaJual);
      const totalHarga = jumlahTotal * hargaSatuan;
      const diskonTotal = Number(item.diskonPerItem) * jumlahDus;
      const totalSetelahDiskon = totalHarga - diskonTotal;

      subtotal += totalSetelahDiskon;

      // Nama barang (bisa multiline jika panjang)
      doc.text(item.barang.namaBarang, leftCol, currentY, { width: 92 });
      const textHeight = doc.heightOfString(item.barang.namaBarang, {
        width: 92,
      });

      // Qty
      const labelKemasan = item.barang?.jenisKemasan || "dus";
      const qtyText = `${jumlahDus} ${labelKemasan} + ${jumlahPcs} item`;
      doc.text(qtyText, colQty, currentY, {
        width: 40,
        align: "center",
      });

      // Harga
      doc.text(formatRupiah(hargaSatuan), colHarga, currentY, {
        width: 35,
        align: "right",
      });

      // Total
      doc.text(formatRupiah(totalSetelahDiskon), colTotal, currentY, {
        width: contentWidth - (colTotal - leftCol),
        align: "right",
      });

      currentY += Math.max(textHeight, 10) + 2;

      // Tampilkan diskon jika ada
      if (diskonTotal > 0) {
        doc.fontSize(8).fillColor("#DC2626");
        doc.text(`  Diskon: -${formatRupiah(diskonTotal)}`, leftCol, currentY, {
          width: contentWidth,
        });
        currentY += 8;
        doc.fillColor("#000000").fontSize(9);
      }
    }

    // Garis pembatas
    doc.moveDown(0.3);
    currentY = doc.y;
    doc.moveTo(margin, currentY).lineTo(paperWidth - margin, currentY).stroke();
    currentY += 8;

    // Summary
    doc.font("Helvetica").fontSize(9);
    doc.text("Subtotal:", colHarga, currentY);
    doc.text(formatRupiah(subtotal), colTotal, currentY, {
      width: contentWidth - (colTotal - leftCol),
      align: "right",
    });

    currentY += 12;
    doc.text("Total Berat:", colHarga, currentY);
    doc.text(`${formatBeratKg(penjualan.beratTotal)} kg`, colTotal, currentY, {
      width: contentWidth - (colTotal - leftCol),
      align: "right",
    });

    if (Number(penjualan.diskonNota) > 0) {
      currentY += 12;
      doc.fillColor("#DC2626");
      doc.text("Diskon Nota:", colHarga, currentY);
      doc.text(
        `-${formatRupiah(Number(penjualan.diskonNota))}`,
        colTotal,
        currentY,
        {
          width: contentWidth - (colTotal - leftCol),
          align: "right",
        }
      );
      doc.fillColor("#000000");
    }

    currentY += 15;
    doc.font("Helvetica-Bold").fontSize(11);
    doc.text("TOTAL:", colHarga, currentY);
    doc.text(
      formatRupiah(Number(penjualan.totalHarga)),
      colTotal,
      currentY,
      {
        width: contentWidth - (colTotal - leftCol),
        align: "right",
      }
    );

    currentY += 12;
    doc.font("Helvetica").fontSize(9);
    doc.text("Dibayar:", colHarga, currentY);
    doc.text(
      formatRupiah(Number(penjualan.jumlahDibayar)),
      colTotal,
      currentY,
      {
        width: contentWidth - (colTotal - leftCol),
        align: "right",
      }
    );

    currentY += 12;
    doc.fillColor("#059669");
    doc.text("Kembalian:", colHarga, currentY);
    doc.text(
      formatRupiah(Number(penjualan.kembalian)),
      colTotal,
      currentY,
      {
        width: contentWidth - (colTotal - leftCol),
        align: "right",
      }
    );
    doc.fillColor("#000000");

    // Footer
    doc.moveDown(1);
    currentY = doc.y;
    doc.moveTo(margin, currentY).lineTo(paperWidth - margin, currentY).stroke();
    doc.moveDown(0.5);

    doc
      .fontSize(8.5)
      .font("Helvetica-Bold")
      .text("Terima kasih atas pembelian Anda!", {
        align: "center",
      });
    doc.fontSize(8).text("Barang yang sudah dibeli tidak dapat dikembalikan", {
      align: "center",
    });

    doc.end();

    // Wait for PDF generation to complete
    await new Promise<void>((resolve) => {
      doc.on("end", () => resolve());
    });

    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Nota-${penjualan.kodePenjualan}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
