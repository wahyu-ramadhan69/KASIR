import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";
import path from "path";

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
        pembayaran: {
          orderBy: { tanggalBayar: "desc" },
        },
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

    const pembayaranList = penjualan.pembayaran || [];
    const latestPembayaran = pembayaranList[0];
    const totalCash =
      penjualan.statusPembayaran === "LUNAS"
        ? pembayaranList.reduce(
            (sum, pembayaran) => sum + Number(pembayaran.totalCash || 0),
            0
          )
        : Number(latestPembayaran?.totalCash || 0);
    const totalTransfer =
      penjualan.statusPembayaran === "LUNAS"
        ? pembayaranList.reduce(
            (sum, pembayaran) => sum + Number(pembayaran.totalTransfer || 0),
            0
          )
        : Number(latestPembayaran?.totalTransfer || 0);

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
      baseHeight + penjualan.items.length * perItemHeight + discountCount * 8
    );

    const doc = new PDFDocument({
      size: [paperWidth, paperHeight],
      margins: { top: margin, bottom: margin, left: margin, right: margin },
    });

    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "RobotoMono-Bold.ttf"
    );
    doc.registerFont("RobotoMono-Bold", fontPath);
    doc.registerFont("RobotoMono", fontPath);

    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

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

    const totalBerat = penjualan.items.reduce((sum, item) => {
      const jumlahPerKemasan = Number(item.barang?.jumlahPerKemasan) || 1;
      const jumlahTotal =
        item.totalItem !== undefined && item.totalItem !== null
          ? Number(item.totalItem)
          : 0;
      const jumlahDus = Math.floor(jumlahTotal / jumlahPerKemasan);
      const jumlahPcs = jumlahTotal % jumlahPerKemasan;
      const beratPerKemasan = Number(item.barang?.berat) || 0;
      const beratDus = beratPerKemasan * jumlahDus;
      const beratPcs =
        jumlahPcs > 0
          ? Math.round((beratPerKemasan / jumlahPerKemasan) * jumlahPcs)
          : 0;

      return sum + beratDus + beratPcs;
    }, 0);

    // Header
    doc.fontSize(11).font("RobotoMono-Bold").text("NOTA PENJUALAN", {
      align: "center",
    });

    doc.moveDown(0.3);
    doc.fontSize(11).font("RobotoMono-Bold").text("Toko ABC", {
      align: "center",
    });
    doc.fontSize(9).font("RobotoMono").text("Jl. Contoh No. 123, Jakarta", {
      align: "center",
    });
    doc.text("Telp: 021-12345678", { align: "center" });

    doc.moveDown(0.5);
    doc
      .moveTo(margin, doc.y)
      .lineTo(paperWidth - margin, doc.y)
      .stroke();
    doc.moveDown(0.5);

    // Info Transaksi
    const leftCol = margin;
    let currentY = doc.y;

    doc.fontSize(10).font("RobotoMono-Bold");
    doc.text("No Nota:", leftCol, currentY);
    doc
      .font("RobotoMono")
      .text(penjualan.kodePenjualan || "-", leftCol + 55, currentY);

    currentY += 12;
    doc.font("RobotoMono-Bold").text("Tanggal:", leftCol, currentY);
    const tanggalNota = penjualan.tanggalTransaksi ?? penjualan.createdAt;
    doc
      .font("RobotoMono")
      .text(formatDate(tanggalNota.toISOString()), leftCol + 55, currentY);

    currentY += 12;
    doc.font("RobotoMono-Bold").text("Customer:", leftCol, currentY);
    doc
      .font("RobotoMono")
      .text(penjualan.customer?.nama || "-", leftCol + 55, currentY);

    currentY += 12;
    doc.font("RobotoMono-Bold").text("Sales:", leftCol, currentY);
    doc
      .font("RobotoMono")
      .text(penjualan.karyawan?.nama || "-", leftCol + 55, currentY);

    currentY += 12;
    doc.font("RobotoMono-Bold").text("Metode:", leftCol, currentY);
    doc
      .font("RobotoMono")
      .text(penjualan.metodePembayaran || "-", leftCol + 55, currentY);

    doc.moveDown(0.5);
    doc
      .moveTo(margin, doc.y)
      .lineTo(paperWidth - margin, doc.y)
      .stroke();
    doc.moveDown(0.5);

    // Header Tabel
    currentY = doc.y;
    doc.fontSize(10).font("RobotoMono-Bold");
    const colItem = leftCol;
    const itemWidth = contentWidth - 60;
    const colTotal = leftCol + itemWidth;
    doc.text("Item", colItem, currentY, { width: itemWidth });
    doc.text("Total", colTotal, currentY, {
      width: contentWidth - (colTotal - leftCol),
      align: "right",
    });

    currentY += 10;
    doc
      .moveTo(margin, currentY)
      .lineTo(paperWidth - margin, currentY)
      .stroke();
    currentY += 5;

    // Items
    doc.font("RobotoMono").fontSize(10);
    let subtotal = 0;

    for (const item of penjualan.items) {
      const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan) || 1;
      const jumlahTotal =
        item.totalItem !== undefined && item.totalItem !== null
          ? Number(item.totalItem)
          : 0;
      const jumlahDus = Math.floor(jumlahTotal / jumlahPerKemasan);
      const jumlahPcs = jumlahTotal % jumlahPerKemasan;
      const hargaSatuan = Number(
        item.hargaJual ?? item.barang?.hargaJual ?? 0
      );
      const hargaTotal = hargaSatuan * jumlahDus;
      const hargaPcs =
        jumlahPcs > 0
          ? Math.round((hargaSatuan / jumlahPerKemasan) * jumlahPcs)
          : 0;
      const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
      const diskonTotal = Number(item.diskonPerItem) * jumlahDus;
      const totalSetelahDiskon = totalHargaSebelumDiskon - diskonTotal;

      subtotal += totalSetelahDiskon;

      const labelKemasan = item.barang?.jenisKemasan || "dus";
      const qtyLabel =
        jumlahPcs > 0
          ? `${jumlahDus} ${labelKemasan} + ${jumlahPcs} pcs`
          : `${jumlahDus} ${labelKemasan}`;
      const hargaLine = `${formatRupiah(hargaSatuan)} x ${qtyLabel}`;

      // Nama barang (bisa multiline jika panjang)
      doc.text(item.barang.namaBarang, leftCol, currentY, { width: itemWidth });
      const textHeight = doc.heightOfString(item.barang.namaBarang, {
        width: itemWidth,
      });

      doc.fontSize(10).text(hargaLine, leftCol, currentY + textHeight + 1, {
        width: itemWidth,
      });

      doc.fontSize(10);
      doc.text(formatRupiah(totalSetelahDiskon), colTotal, currentY, {
        width: contentWidth - (colTotal - leftCol),
        align: "right",
      });

      const hargaLineHeight = doc.heightOfString(hargaLine, {
        width: itemWidth,
      });
      currentY += Math.max(textHeight + hargaLineHeight + 1, 12) + 2;

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
    doc
      .moveTo(margin, currentY)
      .lineTo(paperWidth - margin, currentY)
      .stroke();
    currentY += 8;

    // Summary
    doc.font("RobotoMono").fontSize(10);
    doc.text("Subtotal:", colTotal - 60, currentY);
    doc.text(formatRupiah(subtotal), colTotal, currentY, {
      width: contentWidth - (colTotal - leftCol),
      align: "right",
    });

    currentY += 12;
    doc.text("Total Berat:", colTotal - 60, currentY);
    doc.text(`${formatBeratKg(totalBerat)} kg`, colTotal, currentY, {
      width: contentWidth - (colTotal - leftCol),
      align: "right",
    });

    if (Number(penjualan.diskonNota) > 0) {
      currentY += 12;
      doc.fillColor("#DC2626");
      doc.text("Diskon Nota:", colTotal - 60, currentY);
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
    doc.font("RobotoMono-Bold").fontSize(10);
    doc.text("TOTAL:", colTotal - 60, currentY);
    doc.text(formatRupiah(Number(penjualan.totalHarga)), colTotal, currentY, {
      width: contentWidth - (colTotal - leftCol),
      align: "right",
    });

    currentY += 12;
    doc.font("RobotoMono").fontSize(9);
    doc.text("Cash:", colTotal - 60, currentY);
    doc.text(formatRupiah(totalCash), colTotal, currentY, {
      width: contentWidth - (colTotal - leftCol),
      align: "right",
    });

    currentY += 12;
    doc.text("Transfer:", colTotal - 60, currentY);
    doc.text(formatRupiah(totalTransfer), colTotal, currentY, {
      width: contentWidth - (colTotal - leftCol),
      align: "right",
    });

    currentY += 12;
    doc.text("Dibayar:", colTotal - 60, currentY);
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
    doc.text("Kembalian:", colTotal - 60, currentY);
    doc.text(formatRupiah(Number(penjualan.kembalian)), colTotal, currentY, {
      width: contentWidth - (colTotal - leftCol),
      align: "right",
    });
    doc.fillColor("#000000");

    // Footer
    doc.moveDown(1);
    currentY = doc.y;
    doc
      .moveTo(margin, currentY)
      .lineTo(paperWidth - margin, currentY)
      .stroke();
    doc.moveDown(0.5);

    doc
      .fontSize(8)
      .font("RobotoMono-Bold")
      .text("Terima kasih atas pembelian Anda!", {
        align: "center",
      });
    doc
      .fontSize(8)
      .font("RobotoMono")
      .text("Barang yang sudah dibeli tidak dapat dikembalikan", {
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
