import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

// Singleton pattern untuk Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: idParam } = await context.params;
    const id = parseInt(idParam);

    // Ambil data penjualan dengan relasi
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id },
      include: {
        customer: true,
        karyawan: true,
        createdBy: {
          include: {
            karyawan: true,
          },
        },
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

    const userKaryawan = penjualan?.userId
      ? await prisma.user.findUnique({
          where: { id: penjualan.userId },
        })
      : null;

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 },
      );
    }

    // Format rupiah — tanpa simbol "Rp", pakai titik sebagai pemisah ribuan
    const formatRupiah = (amount: number | bigint): string => {
      return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(amount));
    };

    // Format tanggal — DD/MM/YYYY HH:MM:SS (gaya struk thermal)
    const formatDate = (dateString: string | Date): string => {
      const date = new Date(dateString);
      const pad = (n: number) => String(n).padStart(2, "0");
      return (
        `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
      );
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

    const pembayaranList = penjualan.pembayaran || [];
    const latestPembayaran = pembayaranList[0];
    const totalCash =
      penjualan.statusPembayaran === "LUNAS"
        ? pembayaranList.reduce((sum, p) => sum + Number(p.totalCash || 0), 0)
        : Number(latestPembayaran?.totalCash || 0);
    const totalTransfer =
      penjualan.statusPembayaran === "LUNAS"
        ? pembayaranList.reduce(
            (sum, p) => sum + Number(p.totalTransfer || 0),
            0,
          )
        : Number(latestPembayaran?.totalTransfer || 0);

    // ─── Helper: pad kanan & kiri untuk baris dua kolom ──────────────────────
    // Courier New 17px pada 78mm ≈ 24 karakter per baris
    const COL_WIDTH = 24;

    // Rata kanan: isi kiri + spasi + nilai rata kanan
    const padLine = (
      left: string,
      right: string,
      width = COL_WIDTH,
    ): string => {
      const spaces = width - left.length - right.length;
      return left + " ".repeat(Math.max(spaces, 1)) + right;
    };

    // Rata kanan saja (tanpa label kiri)
    const rightAlign = (text: string, width = COL_WIDTH): string => {
      const spaces = width - text.length;
      return " ".repeat(Math.max(spaces, 0)) + text;
    };

    const centerText = (text: string, width = COL_WIDTH): string => {
      const pad = Math.max(0, Math.floor((width - text.length) / 2));
      return " ".repeat(pad) + text;
    };

    const line = (char = "-", width = COL_WIDTH): string => char.repeat(width);

    // ─── Render setiap item ───────────────────────────────────────────────────
    const itemRows = penjualan.items
      .map((item) => {
        const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan) || 1;
        const jumlahTotal = Number(item.totalItem ?? 0);
        const jumlahDus = Math.floor(jumlahTotal / jumlahPerKemasan);
        const jumlahPcs = jumlahTotal % jumlahPerKemasan;
        const hargaSatuan = Number(
          item.hargaJual ?? item.barang?.hargaJual ?? 0,
        );
        const hargaTotal = hargaSatuan * jumlahDus;
        const hargaPcs =
          jumlahPcs > 0
            ? Math.round((hargaSatuan / jumlahPerKemasan) * jumlahPcs)
            : 0;
        const totalSebelumDiskon = hargaTotal + hargaPcs;
        const diskonTotal = Number(item.diskonPerItem) * jumlahDus;
        const totalSetelahDiskon = totalSebelumDiskon - diskonTotal;
        const labelKemasan = item.barang?.jenisKemasan || "dus";
        const qtyLabel =
          jumlahPcs > 0
            ? `${jumlahDus} ${labelKemasan} + ${jumlahPcs} pcs`
            : `${jumlahDus} ${labelKemasan}`;

        return `
    <tr>
      <td colspan="3" style="font-weight:700;padding-top:3px">
        ${item.barang.namaBarang}
      </td>
    </tr>
    <tr>
      <td style="text-align:left;font-size:12px">${qtyLabel}</td>
      <td style="text-align:right;font-size:12px">${formatRupiah(hargaSatuan)}</td>
      <td style="text-align:right;font-size:12px">${formatRupiah(totalSetelahDiskon)}</td>
    </tr>
    ${
      diskonTotal > 0
        ? `
    <tr>
      <td colspan="3" style="text-align:right;font-size:11px">
        Diskon: -${formatRupiah(diskonTotal)}
      </td>
    </tr>`
        : ""
    }
  `;
      })
      .join("");

    const diskonNotaRow =
      Number(penjualan.diskonNota) > 0
        ? `
  <tr>
    <td>Diskon Nota</td>
    <td style="text-align:right">-${formatRupiah(penjualan.diskonNota)}</td>
  </tr>`
        : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nota ${penjualan.kodePenjualan}</title>
  <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier Prime', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.55;
      width: 78mm;
      background: #fff;
      color: #000;
      padding: 2mm 3mm 0 3mm;
    }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 0 0 1px 0; vertical-align: top; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .big { font-size: 14px; font-weight: 700; }
    hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    .items-table colgroup col:nth-child(1) { width: 35%; }
    .items-table colgroup col:nth-child(2) { width: 30%; }
    .items-table colgroup col:nth-child(3) { width: 35%; }
    .signature-section {
      margin-top: 8px;
      display: flex;
      justify-content: flex-end;
      padding-right: 4mm;
      padding-bottom: 2mm;
    }
    .signature-box { text-align: center; width: 120px; font-size: 11px; }
    .signature-line {
      border-top: 1px solid #000;
      margin: 28px auto 0;
      width: 100px;
    }
    @media print { body { padding: 2mm 3mm 0 3mm; } }
  </style>
</head>
<body>

  <div class="center bold" style="font-size:14px"><i>AW Sembako Sarolangun</i></div>
  <div class="center">Jln GOR Sarolangun (Depan Gor)</div>
  <div class="center"> Tlp: 081278054340</div>

  <hr>

  <table>
    <tr><td>No Trans</td><td class="right">${penjualan.kodePenjualan}</td></tr>
    <tr><td>Pelanggan</td><td class="right">${penjualan.customer?.nama || penjualan.namaCustomer || "UMUM"}</td></tr>
    <tr><td>Operator</td><td class="right">${userKaryawan?.username || "-"}</td></tr>
    <tr><td>Tanggal</td><td class="right">${formatDate(penjualan.tanggalTransaksi ?? penjualan.createdAt)}</td></tr>
  </table>

  <hr>

  <table class="items-table">
    <colgroup><col><col><col></colgroup>
    ${itemRows}
  </table>

  <hr>

  <table>
    <tr><td>Subtotal</td><td class="right">Rp. ${formatRupiah(penjualan.subtotal)}</td></tr>
    <tr><td>Total Berat</td><td class="right">${formatBeratKg(totalBerat)} kg</td></tr>
    ${diskonNotaRow}
    <tr><td class="big">Total</td><td class="right big">Rp. ${formatRupiah(penjualan.totalHarga)}</td></tr>
    <tr><td>Cash</td><td class="right">Rp. ${formatRupiah(totalCash)}</td></tr>
    <tr><td>Transfer</td><td class="right">Rp. ${formatRupiah(totalTransfer)}</td></tr>
    <tr><td>Di bayar</td><td class="right">Rp. ${formatRupiah(penjualan.jumlahDibayar)}</td></tr>
    <tr><td class="big">Kembalian</td><td class="right big">Rp. ${formatRupiah(penjualan.kembalian)}</td></tr>
  </table>

  <hr>

  <div class="center" style="font-size:12px">Barang yang sudah dibeli tidak bisa ditukar, untuk pengaduan silahkan hubungi nomer yang tertera</div>
  <div class="center" style="font-size:12px">Terima Kasih Atas Kunjungannya</div>

  <div class="signature-section">
    <div class="signature-box">
      <p>Tanda Terima,</p>
      <div class="signature-line"></div>
    </div>
  </div>

<script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("Error generating receipt:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
