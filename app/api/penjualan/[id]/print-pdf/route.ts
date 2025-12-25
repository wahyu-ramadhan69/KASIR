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

    // Ukuran A6 dalam points (1 inch = 72 points)
    // A6 = 105mm x 148mm = 297.6 x 419.5 points
    const doc = new PDFDocument({
      size: [297.6, 419.5],
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
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

    // Header
    doc.fontSize(14).font("Helvetica-Bold").text("NOTA PENJUALAN", {
      align: "center",
    });

    doc.moveDown(0.3);
    doc.fontSize(8).font("Helvetica").text("Toko ABC", { align: "center" });
    doc.text("Jl. Contoh No. 123, Jakarta", { align: "center" });
    doc.text("Telp: 021-12345678", { align: "center" });

    doc.moveDown(0.5);
    doc.moveTo(20, doc.y).lineTo(277.6, doc.y).stroke();
    doc.moveDown(0.5);

    // Info Transaksi
    const leftCol = 20;
    const rightCol = 150;
    let currentY = doc.y;

    doc.fontSize(8).font("Helvetica-Bold");
    doc.text("No Nota:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(penjualan.kodePenjualan || "-", leftCol + 60, currentY);

    currentY += 12;
    doc.font("Helvetica-Bold").text("Tanggal:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(
        formatDate(penjualan.createdAt.toISOString()),
        leftCol + 60,
        currentY
      );

    currentY += 12;
    doc.font("Helvetica-Bold").text("Customer:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(penjualan.customer?.nama || "-", leftCol + 60, currentY);

    currentY += 12;
    doc.font("Helvetica-Bold").text("Sales:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(penjualan.karyawan?.nama || "-", leftCol + 60, currentY);

    currentY += 12;
    doc.font("Helvetica-Bold").text("Metode:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(penjualan.metodePembayaran || "-", leftCol + 60, currentY);

    currentY += 12;
    doc.font("Helvetica-Bold").text("Status:", leftCol, currentY);
    doc
      .font("Helvetica")
      .text(penjualan.statusPembayaran || "-", leftCol + 60, currentY);

    doc.moveDown(0.5);
    doc.moveTo(20, doc.y).lineTo(277.6, doc.y).stroke();
    doc.moveDown(0.5);

    // Header Tabel
    currentY = doc.y;
    doc.fontSize(7).font("Helvetica-Bold");
    doc.text("Item", leftCol, currentY, { width: 110 });
    doc.text("Qty", leftCol + 115, currentY, { width: 40, align: "center" });
    doc.text("Harga", leftCol + 155, currentY, { width: 50, align: "right" });
    doc.text("Total", leftCol + 205, currentY, { width: 52.6, align: "right" });

    currentY += 10;
    doc.moveTo(20, currentY).lineTo(277.6, currentY).stroke();
    currentY += 5;

    // Items
    doc.font("Helvetica").fontSize(7);
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
      doc.text(item.barang.namaBarang, leftCol, currentY, { width: 110 });
      const textHeight = doc.heightOfString(item.barang.namaBarang, {
        width: 110,
      });

      // Qty
      const labelKemasan = item.barang?.jenisKemasan || "dus";
      const qtyText = `${jumlahDus} ${labelKemasan} + ${jumlahPcs} item`;
      doc.text(qtyText, leftCol + 115, currentY, {
        width: 40,
        align: "center",
      });

      // Harga
      doc.text(formatRupiah(hargaSatuan), leftCol + 155, currentY, {
        width: 50,
        align: "right",
      });

      // Total
      doc.text(formatRupiah(totalSetelahDiskon), leftCol + 205, currentY, {
        width: 52.6,
        align: "right",
      });

      currentY += Math.max(textHeight, 10) + 2;

      // Tampilkan diskon jika ada
      if (diskonTotal > 0) {
        doc.fontSize(6).fillColor("#DC2626");
        doc.text(`  Diskon: -${formatRupiah(diskonTotal)}`, leftCol, currentY, {
          width: 257.6,
        });
        currentY += 8;
        doc.fillColor("#000000").fontSize(7);
      }
    }

    // Garis pembatas
    doc.moveDown(0.3);
    currentY = doc.y;
    doc.moveTo(20, currentY).lineTo(277.6, currentY).stroke();
    currentY += 8;

    // Summary
    doc.font("Helvetica").fontSize(8);
    doc.text("Subtotal:", leftCol + 155, currentY);
    doc.text(formatRupiah(subtotal), leftCol + 205, currentY, {
      width: 52.6,
      align: "right",
    });

    if (Number(penjualan.diskonNota) > 0) {
      currentY += 12;
      doc.fillColor("#DC2626");
      doc.text("Diskon Nota:", leftCol + 155, currentY);
      doc.text(
        `-${formatRupiah(Number(penjualan.diskonNota))}`,
        leftCol + 205,
        currentY,
        {
          width: 52.6,
          align: "right",
        }
      );
      doc.fillColor("#000000");
    }

    currentY += 15;
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("TOTAL:", leftCol + 155, currentY);
    doc.text(
      formatRupiah(Number(penjualan.totalHarga)),
      leftCol + 205,
      currentY,
      {
        width: 52.6,
        align: "right",
      }
    );

    currentY += 12;
    doc.font("Helvetica").fontSize(8);
    doc.text("Dibayar:", leftCol + 155, currentY);
    doc.text(
      formatRupiah(Number(penjualan.jumlahDibayar)),
      leftCol + 205,
      currentY,
      {
        width: 52.6,
        align: "right",
      }
    );

    currentY += 12;
    doc.fillColor("#059669");
    doc.text("Kembalian:", leftCol + 155, currentY);
    doc.text(
      formatRupiah(Number(penjualan.kembalian)),
      leftCol + 205,
      currentY,
      {
        width: 52.6,
        align: "right",
      }
    );
    doc.fillColor("#000000");

    // Footer
    doc.moveDown(1);
    currentY = doc.y;
    doc.moveTo(20, currentY).lineTo(277.6, currentY).stroke();
    doc.moveDown(0.5);

    doc
      .fontSize(7)
      .font("Helvetica")
      .text("Terima kasih atas pembelian Anda!", {
        align: "center",
      });
    doc.fontSize(6).text("Barang yang sudah dibeli tidak dapat dikembalikan", {
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
