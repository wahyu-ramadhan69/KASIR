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
    const itemLines = penjualan.items
      .map((item) => {
        const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan) || 1;
        const jumlahTotal =
          item.totalItem !== undefined && item.totalItem !== null
            ? Number(item.totalItem)
            : 0;
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
        const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
        const diskonTotal = Number(item.diskonPerItem) * jumlahDus;
        const totalSetelahDiskon = totalHargaSebelumDiskon - diskonTotal;
        const labelKemasan = item.barang?.jenisKemasan || "dus";
        const qtyLabel =
          jumlahPcs > 0
            ? `${jumlahDus} ${labelKemasan} + ${jumlahPcs} pcs`
            : `${jumlahDus} ${labelKemasan}`;

        // Baris 1: nama barang
        const namaLine = item.barang.namaBarang;
        // Baris 2: qty  harga_satuan (rata kiri) | total (rata kanan)
        // Format: "5 Sak  235.000      1.175.000"
        const qtyHarga = `${qtyLabel}  ${formatRupiah(hargaSatuan)}`;
        const totalStr = formatRupiah(totalSetelahDiskon);
        const detailLine = padLine(qtyHarga, totalStr);
        // Baris 3 (opsional): diskon
        const diskonLine =
          diskonTotal > 0
            ? rightAlign(`Diskon: -${formatRupiah(diskonTotal)}`)
            : null;

        return [namaLine, detailLine, diskonLine].filter(Boolean).join("\n");
      })
      .join("\n"); // tidak ada garis antar item, langsung lanjut

    // ─── Generate HTML ────────────────────────────────────────────────────────

    // Susun semua konten sebagai plain text untuk konsistensi alignment
    const diskonNotaLine =
      Number(penjualan.diskonNota) > 0
        ? "\n" +
          padLine("Diskon Nota", "-" + formatRupiah(penjualan.diskonNota))
        : "";

    // Gunakan <b> tag inline untuk bold agar tidak merusak pre block
    const allLines = [
      `<i><b>${centerText("AW Sembako Sarolangun")}</b></i>`,
      centerText("Jln Simpang Raya, Aur Gading"),
      centerText("Sarolangun"),
      centerText("Tlp: 081278054340"),
      // ── garis 1: bawah header info customer ──
      line("-"),
      `No Trans : ${penjualan.kodePenjualan}`,
      `Pelanggan: ${penjualan.customer?.nama || penjualan.namaCustomer || "UMUM"}`,
      `Operator : ${userKaryawan?.username || "-"}`,
      `Tanggal  : ${formatDate(penjualan.tanggalTransaksi ?? penjualan.createdAt)}`,
      // ── garis 2: bawah info customer / atas list barang ──
      line("-"),
      itemLines,
      // ── garis 3: bawah list barang / atas total ──
      line("-"),
      padLine("Subtotal", formatRupiah(penjualan.subtotal)),
      padLine("Total Berat", formatBeratKg(totalBerat) + " kg") +
        diskonNotaLine,
      `<b>${padLine("Total", formatRupiah(penjualan.totalHarga))}</b>`,
      padLine("Cash", formatRupiah(totalCash)),
      padLine("Transfer", formatRupiah(totalTransfer)),
      padLine("Di bayar", formatRupiah(penjualan.jumlahDibayar)),
      `<b>${padLine("Kembalian", formatRupiah(penjualan.kembalian))}</b>`,
      // ── garis 4: bawah pembayaran / atas footer ──
      line("-"),
      centerText("Barang yg sudah di beli tidak bisa"),
      centerText("di tukar kecuali barang tertentu"),
      centerText("Terima Kasih Atas Kunjungannya"),
    ].join("\n");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nota ${penjualan.kodePenjualan}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    @page {
      size: 80mm auto;
      margin: 2mm 1mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Share Tech Mono', 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.55;
      font-weight: normal;
      width: 78mm;
      background: #fff;
      color: #000;
      padding: 3mm 2mm;
    }

    /* Satu pre block untuk seluruh konten — spasi konsisten */
    pre {
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      font-weight: inherit;
      white-space: pre;
      margin: 0;
      padding: 0;
      word-break: normal;
      overflow-wrap: normal;
    }

    pre b {
      font-weight: 700;
    }

    pre i {
      font-style: italic;
    }

    /* Tanda tangan */
    .signature-section {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
      padding-right: 4mm;
    }

    .signature-box {
      text-align: center;
      width: 120px;
    }

    .signature-box p {
      font-size: 11px;
      margin-bottom: 4px;
    }

    .signature-line {
      border-top: 1px solid #000;
      margin: 36px auto 0;
      width: 100px;
    }

    @media print {
      body { padding: 2mm 1mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

<pre>${allLines}</pre>

<div class="signature-section">
  <div class="signature-box">
    <p>Tanda Terima,</p>
    <div class="signature-line"></div>
  </div>
</div>

<script>
  window.onload = function () { window.print(); };
</script>
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
