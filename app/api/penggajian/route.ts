import { NextRequest, NextResponse } from "next/server";
import { PeriodeGaji, PrismaClient } from "@prisma/client";
import { getAuthData, isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepSerialize);
  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = deepSerialize(obj[key]);
      }
    }
    return serialized;
  }
  return obj;
}

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

function getWorkingDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  while (current < end) {
    const day = current.getDay();
    if (day !== 0) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
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

async function computeBreakdown(params: {
  karyawanId: number;
  periode: "BULANAN" | "MINGGUAN";
  bulan: string;
  minggu?: number | null;
}) {
  const range =
    params.periode === "MINGGUAN"
      ? getWeekRangeByMonthWeek(
          Number(params.bulan.split("-")[0]),
          Number(params.bulan.split("-")[1]),
          params.minggu ?? 1,
        )
      : parseMonth(params.bulan);

  if (!range) {
    throw new Error("Range tidak valid");
  }

  const karyawan = await prisma.karyawan.findUnique({
    where: { id: params.karyawanId },
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
    throw new Error("Karyawan tidak ditemukan");
  }

  const absensi = await prisma.absensi.findMany({
    where: {
      karyawanId: params.karyawanId,
      tanggal: { gte: range.start, lt: range.end },
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

  const workingDays = getWorkingDays(range.start, range.end);
  const totalWorkingDays = workingDays.length;
  const totalBulanan = karyawan.gajiPokok + karyawan.tunjanganMakan;
  const monthlyRange = parseMonth(params.bulan);
  const monthlyWorkingDays = monthlyRange
    ? getWorkingDays(monthlyRange.start, monthlyRange.end).length
    : totalWorkingDays;
  const dailyRateMonthly =
    monthlyWorkingDays > 0 ? totalBulanan / monthlyWorkingDays : 0;

  let potonganTidakHadir = 0;
  let potonganTelat = 0;
  let potonganKurangJam = 0;
  let lembur = 0;
  let totalHadir = 0;
  let totalTerlambat = 0;
  let totalKurangJam = 0;
  let totalLemburJam = 0;
  let totalTidakHadir = 0;
  let totalJamKerja = 0;

  for (const day of workingDays) {
    const key = day.toISOString().slice(0, 10);
    const record = absensiMap.get(key);
    if (!record || ["IZIN", "SAKIT", "LIBUR"].includes(record.status)) {
      totalTidakHadir += 1;
      potonganTidakHadir += dailyRateMonthly;
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
      potonganTidakHadir += dailyRateMonthly;
      continue;
    }

    totalTidakHadir += 1;
    potonganTidakHadir += dailyRateMonthly;
  }

  const totalGross =
    params.periode === "MINGGUAN"
      ? dailyRateMonthly * totalWorkingDays
      : totalBulanan;
  const totalPotongan = potonganTidakHadir + potonganTelat + potonganKurangJam;
  const totalDiterima = Math.max(0, totalGross + lembur - totalPotongan);

  return {
    karyawan,
    totalGross: Math.round(totalGross),
    totalPotongan: Math.round(totalPotongan),
    potonganTidakHadir: Math.round(potonganTidakHadir),
    potonganTelat: Math.round(potonganTelat),
    potonganKurangJam: Math.round(potonganKurangJam),
    lembur: Math.round(lembur),
    totalDiterima: Math.round(totalDiterima),
    totalHadir,
    totalTidakHadir,
    totalTerlambat,
    totalKurangJam,
    totalLemburJam,
    totalJamKerja: Number(totalJamKerja.toFixed(2)),
  };
}

export async function GET(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const periodParam = (searchParams.get("period") || "BULANAN").toUpperCase();
  const monthParam = searchParams.get("month");
  const weekParam = searchParams.get("week");
  const karyawanIdParam = searchParams.get("karyawanId");

  if (!monthParam) {
    return NextResponse.json(
      { success: false, error: "Bulan wajib diisi" },
      { status: 400 },
    );
  }

  const where: any = {
    bulan: monthParam,
    periode: periodParam,
  };
  if (periodParam === "MINGGUAN") {
    if (weekParam) {
      where.minggu = Number(weekParam);
    }
  } else {
    where.minggu = null;
  }
  if (karyawanIdParam) {
    where.karyawanId = Number(karyawanIdParam);
  }

  const data = await prisma.pembayaranGaji.findMany({
    where,
    orderBy: { id: "desc" },
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(authData.userId);
  if (!Number.isInteger(userId)) {
    return NextResponse.json(
      { error: "Unauthorized (user tidak valid)" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      karyawanId,
      periode,
      bulan,
      minggu,
      nominal,
      catatan,
      tanggalBayar,
    } = body;

    if (!karyawanId || !periode || !bulan) {
      return NextResponse.json(
        { success: false, error: "Data tidak lengkap" },
        { status: 400 },
      );
    }

    const periodeUpper = String(periode).toUpperCase() as PeriodeGaji;
    if (!["BULANAN", "MINGGUAN"].includes(periodeUpper)) {
      return NextResponse.json(
        { success: false, error: "Periode tidak valid" },
        { status: 400 },
      );
    }

    const breakdown = await computeBreakdown({
      karyawanId: Number(karyawanId),
      periode: periodeUpper as "BULANAN" | "MINGGUAN",
      bulan,
      minggu: periodeUpper === "MINGGUAN" ? Number(minggu) : null,
    });

    const nominalBayar =
      nominal !== undefined && nominal !== null
        ? Number(nominal)
        : breakdown.totalDiterima;

    if (!Number.isFinite(nominalBayar)) {
      return NextResponse.json(
        { success: false, error: "Nominal tidak valid" },
        { status: 400 },
      );
    }

    const tanggal = tanggalBayar ? new Date(tanggalBayar) : new Date();
    if (Number.isNaN(tanggal.getTime())) {
      return NextResponse.json(
        { success: false, error: "Tanggal tidak valid" },
        { status: 400 },
      );
    }

    const jenisPengeluaran =
      periodeUpper === "MINGGUAN" ? "MINGGUAN" : "BULANAN";
    const keterangan =
      periodeUpper === "MINGGUAN"
        ? `Gaji Mingguan (Minggu ${minggu}) - ${bulan}`
        : `Gaji Bulanan - ${bulan}`;

    const result = await prisma.$transaction(async (tx) => {
      const pembayaran = await tx.pembayaranGaji.create({
        data: {
          karyawanId: Number(karyawanId),
          periode: periodeUpper,
          bulan,
          minggu: periodeUpper === "MINGGUAN" ? Number(minggu) : null,
          tanggalBayar: tanggal,
          nominal: Math.round(nominalBayar),
          totalGross: breakdown.totalGross,
          totalPotongan: breakdown.totalPotongan,
          potonganTidakHadir: breakdown.potonganTidakHadir,
          potonganTelat: breakdown.potonganTelat,
          potonganKurangJam: breakdown.potonganKurangJam,
          lembur: breakdown.lembur,
          gajiPokokBulanan: breakdown.karyawan.gajiPokok,
          tunjanganMakanBulanan: breakdown.karyawan.tunjanganMakan,
          catatan: catatan || null,
          userId,
        },
      });

      const pengeluaran = await tx.pengeluaran.create({
        data: {
          namaPengeluaran: `Gaji Karyawan - ${breakdown.karyawan.nama}`,
          jenisPengeluaran: jenisPengeluaran,
          jumlah: Math.round(nominalBayar),
          keterangan,
          userId,
          tanggalInput: tanggal,
        },
      });

      return { pembayaran, pengeluaran };
    });

    const serialized = deepSerialize(result);
    return NextResponse.json(
      { success: true, data: serialized },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating pembayaran gaji:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan pembayaran gaji" },
      { status: 500 },
    );
  }
}
