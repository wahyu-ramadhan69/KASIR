import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require("pdfkit/js/pdfkit.standalone");
import { Buffer } from "node:buffer";

const prisma = new PrismaClient();

export const runtime = "nodejs";

function parseMonth(value?: string | null): { start: Date; end: Date } | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return null;
  }
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonthLabel(value: string): string {
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return value;
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateDMY(date: Date): string {
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getWorkingDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  while (current < end) {
    const day = current.getDay(); // 0 = Minggu
    if (day !== 0) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function getWeekRangeByMonthWeek(
  year: number,
  month: number,
  week: number,
): { start: Date; end: Date } | null {
  if (week < 1) return null;
  const startDay = (week - 1) * 7 + 1;
  const start = new Date(year, month - 1, startDay, 0, 0, 0, 0);
  if (Number.isNaN(start.getTime())) return null;
  if (start.getMonth() !== month - 1) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function calcDurationHours(
  start?: Date | null,
  end?: Date | null,
): number | null {
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return null;
  return diffMs / (1000 * 60 * 60);
}

function diffMinutes(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const karyawanIdParam = searchParams.get("karyawanId");
    const periodParam = searchParams.get("period") || "monthly";
    const weekParam = searchParams.get("week");
    const dateParam = searchParams.get("date");

    if (!karyawanIdParam) {
      return NextResponse.json(
        { success: false, error: "karyawanId wajib diisi" },
        { status: 400 },
      );
    }

    const karyawanId = Number(karyawanIdParam);
    if (!karyawanId || Number.isNaN(karyawanId)) {
      return NextResponse.json(
        { success: false, error: "karyawanId tidak valid" },
        { status: 400 },
      );
    }

    let range: { start: Date; end: Date } | null = null;
    let baseDate: Date | null = null;
    if (periodParam === "weekly") {
      if (monthParam && weekParam) {
        const week = Number(weekParam);
        const [yearStr, monthStr] = monthParam.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr);
        if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(week)) {
          return NextResponse.json(
            { success: false, error: "Format bulan/minggu tidak valid" },
            { status: 400 },
          );
        }
        range = getWeekRangeByMonthWeek(year, month, week);
        if (!range) {
          return NextResponse.json(
            { success: false, error: "Range minggu tidak valid" },
            { status: 400 },
          );
        }
        baseDate = new Date(year, month - 1, 1);
      } else {
        const parsedDate = dateParam ? new Date(dateParam) : new Date();
        if (Number.isNaN(parsedDate.getTime())) {
          return NextResponse.json(
            { success: false, error: "Format tanggal tidak valid" },
            { status: 400 },
          );
        }
        baseDate = parsedDate;
        range = getWeekRangeByMonthWeek(
          parsedDate.getFullYear(),
          parsedDate.getMonth() + 1,
          Math.ceil(parsedDate.getDate() / 7),
        );
        if (!range) {
          return NextResponse.json(
            { success: false, error: "Range minggu tidak valid" },
            { status: 400 },
          );
        }
      }
    } else {
      range = parseMonth(monthParam);
      if (!range || !monthParam) {
        return NextResponse.json(
          { success: false, error: "Format bulan tidak valid" },
          { status: 400 },
        );
      }
    }

    if (!range) {
      return NextResponse.json(
        { success: false, error: "Range tidak valid" },
        { status: 400 },
      );
    }

    const karyawan = await prisma.karyawan.findUnique({
      where: { id: karyawanId },
      select: {
        id: true,
        nama: true,
        nik: true,
        jenis: true,
        gajiPokok: true,
        tunjanganMakan: true,
        isActive: true,
      },
    });

    if (!karyawan || !karyawan.isActive) {
      return NextResponse.json(
        { success: false, error: "Karyawan tidak ditemukan" },
        { status: 404 },
      );
    }

    const pembayaran = await prisma.pembayaranGaji.findFirst({
      where: {
        karyawanId,
        periode: periodParam === "weekly" ? "MINGGUAN" : "BULANAN",
        bulan: monthParam ?? "",
        minggu: periodParam === "weekly" ? Number(weekParam) : null,
      },
      orderBy: { id: "desc" },
    });

    if (!pembayaran) {
      return NextResponse.json(
        { success: false, error: "Pembayaran gaji belum tersedia" },
        { status: 404 },
      );
    }

    const { start: rangeStart, end: rangeEnd } = range;
    const absensi = await prisma.absensi.findMany({
      where: {
        karyawanId,
        tanggal: { gte: rangeStart, lt: rangeEnd },
      },
      select: {
        tanggal: true,
        jamMasuk: true,
        jamKeluar: true,
        status: true,
      },
    });

    const absensiMap = new Map<string, (typeof absensi)[number]>();
    for (const item of absensi) {
      const key = item.tanggal.toISOString().slice(0, 10);
      absensiMap.set(key, item);
    }

    const workingDays = getWorkingDays(rangeStart, rangeEnd);
    const totalWorkingDays = workingDays.length;
    const totalBulanan =
      pembayaran.gajiPokokBulanan + pembayaran.tunjanganMakanBulanan;
    const monthlyRange =
      periodParam === "weekly" && baseDate
        ? parseMonth(
            `${baseDate.getFullYear()}-${`${baseDate.getMonth() + 1}`.padStart(
              2,
              "0",
            )}`,
          )
        : range;
    const monthlyWorkingDays = monthlyRange
      ? getWorkingDays(monthlyRange.start, monthlyRange.end).length
      : totalWorkingDays;
    const dailyRateMonthly =
      monthlyWorkingDays > 0 ? totalBulanan / monthlyWorkingDays : 0;

    let totalHadir = 0;
    let totalTerlambat = 0;
    let totalKurangJam = 0;
    let totalLemburJam = 0;
    let totalTidakHadir = 0;
    let totalJamKerja = 0;
    let potonganTidakHadir = pembayaran.potonganTidakHadir;
    let potonganTelat = pembayaran.potonganTelat;
    let potonganKurangJam = pembayaran.potonganKurangJam;
    let lembur = pembayaran.lembur;

    for (const day of workingDays) {
      const key = day.toISOString().slice(0, 10);
      const record = absensiMap.get(key);

      if (!record) {
        totalTidakHadir += 1;
        // potongan diambil dari data pembayaran
        continue;
      }

      if (["IZIN", "SAKIT", "LIBUR"].includes(record.status)) {
        totalTidakHadir += 1;
        // potongan diambil dari data pembayaran
        continue;
      }

      const hasMasuk = Boolean(record.jamMasuk);
      const hasKeluar = Boolean(record.jamKeluar);
      const hours = calcDurationHours(record.jamMasuk, record.jamKeluar);

      if (hasMasuk && hasKeluar && hours !== null) {
        totalHadir += 1;
        totalJamKerja += hours;
        const workMinutes = Math.floor(hours * 60);

        const batasMasuk = new Date(day);
        batasMasuk.setHours(8, 10, 0, 0);
        if (record.jamMasuk && record.jamMasuk > batasMasuk) {
          const telatMinutes = diffMinutes(batasMasuk, record.jamMasuk);
          const telatBlocks = Math.floor(telatMinutes / 10);
          if (telatBlocks > 0) {
            totalTerlambat += 1;
            potonganTelat += telatBlocks * 10000;
          }
        }

        if (workMinutes < 9 * 60) {
          const kurangMinutes = 9 * 60 - workMinutes;
          const kurangBlocks = Math.floor(kurangMinutes / 10);
          if (kurangBlocks > 0) {
            totalKurangJam += 1;
            potonganKurangJam += kurangBlocks * 10000;
          }
        }

        if (workMinutes > 9 * 60) {
          const lemburMinutes = workMinutes - 9 * 60;
          const lemburHours = Math.floor(lemburMinutes / 60);
          if (lemburHours > 0) {
            totalLemburJam += lemburHours;
            lembur += lemburHours * 10000;
          }
        }
        continue;
      }

      if (hasMasuk || hasKeluar) {
        totalHadir += 1;
        // potongan diambil dari data pembayaran
        continue;
      }

      totalTidakHadir += 1;
      // potongan diambil dari data pembayaran
    }

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    const pdfBufferPromise: Promise<Buffer> = new Promise((resolve, reject) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const pageLeft = doc.page.margins.left;
    const pageRight = doc.page.width - doc.page.margins.right;
    const colGap = 20;
    const colWidth = (pageRight - pageLeft - colGap) / 2;
    const colLeftX = pageLeft;
    const colRightX = pageLeft + colWidth + colGap;

    const bonus = pembayaran.bonus ?? 0;
    const totalGross = pembayaran.totalGross;
    const totalPendapatan = totalGross + lembur + bonus;
    const totalTransfer = pembayaran.nominal;
    const inferredPinjaman = Math.max(
      0,
      totalPendapatan - pembayaran.totalPotongan - totalTransfer
    );
    const potonganPinjaman =
      pembayaran.pinjamanDipotong && pembayaran.pinjamanDipotong > 0
        ? pembayaran.pinjamanDipotong
        : inferredPinjaman;
    const totalPotongan = pembayaran.totalPotongan + potonganPinjaman;

    // Watermark removed per request

    // Title
    doc.fontSize(14).text("Slip Gaji", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(11).text("AW SEMBAKO SAROLANGUN", { align: "center" });
    doc.text(`BULAN : ${formatMonthLabel(monthParam ?? "")}`, {
      align: "center",
    });

    // Fixed layout for header info to avoid misalignment
    const infoTopY = doc.y + 18;
    const labelWidth = 90;
    const colonWidth = 10;
    const valueLeftX = colLeftX + labelWidth + colonWidth;
    const valueRightX = colRightX + labelWidth + colonWidth;

    doc.fontSize(11);
    doc.text("NIK", colLeftX, infoTopY, { width: labelWidth });
    doc.text(":", colLeftX + labelWidth, infoTopY, { width: colonWidth });
    doc.text(karyawan.nik, valueLeftX, infoTopY, {
      width: colWidth - labelWidth - colonWidth,
    });

    const namaY = infoTopY + 18;
    doc.text("Nama", colLeftX, namaY, { width: labelWidth });
    doc.text(":", colLeftX + labelWidth, namaY, { width: colonWidth });
    doc.text(karyawan.nama, valueLeftX, namaY, {
      width: colWidth - labelWidth - colonWidth,
    });

    doc.text("Jabatan", colRightX, infoTopY, { width: labelWidth });
    doc.text(":", colRightX + labelWidth, infoTopY, { width: colonWidth });
    doc.text(karyawan.jenis, valueRightX, infoTopY, {
      width: colWidth - labelWidth - colonWidth,
      align: "right",
    });

    const dividerY = namaY + 16;
    doc
      .moveTo(pageLeft, dividerY)
      .lineTo(pageRight, dividerY)
      .strokeColor("#333")
      .stroke();

    const sectionY = dividerY + 12;
    doc.fontSize(11).text("PENGHASILAN GROSS", colLeftX, sectionY, {
      width: colWidth,
    });
    doc.text("POTONGAN", colRightX, sectionY, { width: colWidth });

    const startY = sectionY + 24;
    const rowHeight = 18;
    const ratio =
      totalBulanan > 0 ? totalGross / totalBulanan : 0;
    const gajiPokokDisplay = Math.round(
      pembayaran.gajiPokokBulanan * ratio
    );
    const tunjanganDisplay = Math.round(
      pembayaran.tunjanganMakanBulanan * ratio
    );
    const leftRows: Array<{ label: string; value: number }> = [
      { label: "Gaji Pokok / Bulan", value: gajiPokokDisplay },
      { label: "Tunjangan Makan / Bulan", value: tunjanganDisplay },
    ];
    if (bonus > 0) {
      leftRows.push({ label: "Bonus", value: Math.round(bonus) });
    }
    if (lembur > 0) {
      leftRows.push({ label: "Lembur", value: Math.round(lembur) });
    }

    const rightRows: Array<{ label: string; value: number }> = [
      { label: "Potongan Tidak Hadir", value: Math.round(potonganTidakHadir) },
      { label: "Potongan Telat", value: Math.round(potonganTelat) },
      { label: "Potongan Jam < 9", value: Math.round(potonganKurangJam) },
    ];
    if (potonganPinjaman > 0) {
      rightRows.push({
        label: "Potongan Pinjaman",
        value: Math.round(potonganPinjaman),
      });
    }

    const maxRows = Math.max(leftRows.length, rightRows.length);
    for (let i = 0; i < maxRows; i += 1) {
      const y = startY + i * rowHeight;
      const left = leftRows[i];
      const right = rightRows[i];
      if (left) {
        doc.text(left.label, colLeftX, y, { width: colWidth });
        doc.text(
          `IDR ${formatRupiah(left.value).replace("Rp", "").trim()}`,
          colLeftX,
          y,
          {
            width: colWidth,
            align: "right",
          },
        );
      }
      if (right) {
        doc.text(right.label, colRightX, y, { width: colWidth });
        doc.text(
          `IDR ${formatRupiah(right.value).replace("Rp", "").trim()}`,
          colRightX,
          y,
          {
            width: colWidth,
            align: "right",
          },
        );
      }
    }

    const totalsY = startY + maxRows * rowHeight + 4;
    doc
      .fontSize(11)
      .text("Total Penghasilan Gross", colLeftX, totalsY, { width: colWidth });
    doc.text(
      `IDR ${formatRupiah(Math.round(totalPendapatan)).replace("Rp", "").trim()}`,
      colLeftX,
      totalsY,
      { width: colWidth, align: "right" },
    );
    doc.text("Total Potongan", colRightX, totalsY, { width: colWidth });
    doc.text(
      `IDR ${formatRupiah(Math.round(totalPotongan)).replace("Rp", "").trim()}`,
      colRightX,
      totalsY,
      { width: colWidth, align: "right" },
    );

    const transferY = totalsY + rowHeight + 6;
    doc.text("Jumlah yang diterima", colRightX, transferY, { width: colWidth });
    doc.text(
      `IDR ${formatRupiah(totalTransfer).replace("Rp", "").trim()}`,
      colRightX,
      transferY,
      { width: colWidth, align: "right" },
    );

    doc.moveDown(1.2);
    doc.fontSize(10).fillColor("#555");
    doc.text(
      `Masuk: ${totalHadir} hari | Tidak masuk: ${totalTidakHadir} hari | Telat: ${totalTerlambat} hari | < 9 jam: ${totalKurangJam} hari | Lembur: ${totalLemburJam} jam`,
      pageLeft,
      doc.y,
      { width: pageRight - pageLeft, align: "left" },
    );
    doc.moveDown(0.4);
    doc.text(`Dicetak: ${formatDateDMY(new Date())}`, pageLeft, doc.y, {
      width: pageRight - pageLeft,
      align: "left",
    });
    doc.fillColor("#000");

    doc.end();
    const pdfBuffer = await pdfBufferPromise;
    const uint8Array = new Uint8Array(pdfBuffer);
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Slip-Gaji-${karyawan.nik}-${monthParam}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating slip gaji:", error);
    return NextResponse.json(
      { success: false, error: "Gagal membuat slip gaji" },
      { status: 500 },
    );
  }
}
