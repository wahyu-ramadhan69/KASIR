import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

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

    // Format rupiah
    const formatRupiah = (amount: number | bigint): string => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(amount));
    };

    // Format tanggal
    const formatDate = (dateString: string | Date): string => {
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

    // Generate HTML untuk nota
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nota ${penjualan.kodePenjualan}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.5;
      font-weight: 600;
      padding: 2mm;
      width: 78mm;
      background: white;
    }

    .header {
      text-align: center;
      margin-bottom: 10px;
      border-bottom: 1px dashed #000;
      padding-bottom: 8px;
    }

    .header h1 {
      font-size: 17px;
      font-weight: 800;
      margin-bottom: 4px;
    }

    .header p {
      font-size: 11px;
      margin: 2px 0;
    }

    .info-section {
      margin: 8px 0;
      font-size: 10px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }

    .info-label {
      font-weight: 800;
      width: 68px;
    }

    .divider {
      border-top: 1px dashed #000;
      margin: 8px 0;
    }

    .items-table {
      width: 100%;
      margin: 8px 0;
      font-size: 10px;
    }

    .items-header {
      font-weight: 800;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
      margin-bottom: 4px;
      display: grid;
      grid-template-columns: 1.6fr 0.6fr 0.8fr;
      gap: 4px;
    }

    .item-row {
      padding: 4px 0;
      border-bottom: 1px dotted #ccc;
    }

    .item-name {
      font-weight: 800;
      margin-bottom: 2px;
    }

    .item-details {
      display: grid;
      grid-template-columns: 1.6fr 0.6fr 0.8fr;
      gap: 4px;
      font-size: 10px;
    }

    .item-discount {
      color: #dc2626;
      font-size: 10px;
      margin-top: 2px;
      padding-left: 8px;
    }

    .summary {
      margin-top: 10px;
      border-top: 1px solid #000;
      padding-top: 8px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
      font-size: 11px;
    }

    .summary-row.total {
      font-weight: 800;
      font-size: 13px;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 6px 0;
      margin: 6px 0;
    }

    .summary-row.change {
      color: #059669;
      font-weight: 800;
    }

    .summary-row.discount {
      color: #dc2626;
    }

    .footer {
      margin-top: 15px;
      text-align: center;
      border-top: 1px dashed #000;
      padding-top: 8px;
      font-size: 10px;
    }

    .footer p {
      margin: 3px 0;
    }

    .signature-section {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }

    .signature-box {
      text-align: center;
      width: 120px;
    }

    .signature-line {
      border-top: 1px solid #000;
      margin-top: 50px;
      padding-top: 4px;
      font-size: 10px;
    }

    @media print {
      body {
        padding: 2mm;
        width: 78mm;
      }

      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>AW Sembako Sarolangun</h1>
    <p>Jln Simpang Raya, Aur Gading, Sarolangun</p>
    <p>Telp: 081278054340</p>
  </div>

  <div class="info-section">
    <div class="info-row">
      <span class="info-label">No Nota:</span>
      <span>${penjualan.kodePenjualan}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Tanggal:</span>
      <span>${formatDate(penjualan.createdAt)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Customer:</span>
      <span>${penjualan.customer?.nama || penjualan.namaCustomer || "-"}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Sales:</span>
      <span>${penjualan.karyawan?.nama || "-"}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Metode:</span>
      <span>${penjualan.metodePembayaran}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Status:</span>
      <span>${penjualan.statusPembayaran}</span>
    </div>
  </div>

  <div class="divider"></div>

  <div class="items-table">
    <div class="items-header">
      <span>Item</span>
      <span style="text-align: center;">Qty</span>
      <span style="text-align: right;">Total</span>
    </div>

    ${penjualan.items
      .map((item) => {
        const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan) || 1;
        const jumlahTotal =
          item.totalItem !== undefined && item.totalItem !== null
            ? Number(item.totalItem)
            : 0;
        const jumlahDus = Math.floor(jumlahTotal / jumlahPerKemasan);
        const jumlahPcs = jumlahTotal % jumlahPerKemasan;
        const hargaSatuan = Number(item.hargaJual || item.barang.hargaJual);
        const totalHarga = jumlahTotal * hargaSatuan;
        const diskonTotal = Number(item.diskonPerItem) * jumlahDus;
        const totalSetelahDiskon = totalHarga - diskonTotal;
        const labelKemasan = item.barang?.jenisKemasan || "dus";

        return `
    <div class="item-row">
      <div class="item-name">${item.barang.namaBarang}</div>
      <div class="item-details">
        <span>${formatRupiah(hargaSatuan)}</span>
        <span style="text-align: center;">${jumlahDus} ${labelKemasan} + ${jumlahPcs} item</span>
        <span style="text-align: right;">${formatRupiah(
          totalSetelahDiskon
        )}</span>
      </div>
      ${
        diskonTotal > 0
          ? `<div class="item-discount">Diskon: -${formatRupiah(
              diskonTotal
            )}</div>`
          : ""
      }
    </div>`;
      })
      .join("")}
  </div>

  <div class="summary">
    <div class="summary-row">
      <span>Subtotal:</span>
      <span>${formatRupiah(penjualan.subtotal)}</span>
    </div>
    <div class="summary-row">
      <span>Total Berat:</span>
      <span>${formatBeratKg(penjualan.beratTotal)} kg</span>
    </div>
    ${
      Number(penjualan.diskonNota) > 0
        ? `
    <div class="summary-row discount">
      <span>Diskon Nota:</span>
      <span>-${formatRupiah(penjualan.diskonNota)}</span>
    </div>`
        : ""
    }
    <div class="summary-row total">
      <span>TOTAL:</span>
      <span>${formatRupiah(penjualan.totalHarga)}</span>
    </div>
    <div class="summary-row">
      <span>Dibayar:</span>
      <span>${formatRupiah(penjualan.jumlahDibayar)}</span>
    </div>
    <div class="summary-row change">
      <span>Kembalian:</span>
      <span>${formatRupiah(penjualan.kembalian)}</span>
    </div>
  </div>

  <div class="footer">
    <p><strong>Terima kasih atas pembelian Anda!</strong></p>
    <p>Barang yang sudah dibeli tidak dapat dikembalikan</p>
  </div>

  <div class="signature-section">
    <div class="signature-box">
      <p style="font-size: 9px; margin-bottom: 5px;">Tanda Terima,</p>
      <div class="signature-line">
        ( _________________ )
      </div>
    </div>
  </div>

  <script>
    // Auto print when page loads
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("Error generating receipt:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
