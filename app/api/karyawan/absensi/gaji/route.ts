import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

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

function getWeekRange(baseDate: Date): { start: Date; end: Date } {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay(); // 0 = Minggu
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
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
    const day = current.getDay(); // 0 = Minggu, 6 = Sabtu
    if (day !== 0) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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


export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const monthParam = searchParams.get("month");
    const periodParam = searchParams.get("period") || "monthly";
    const dateParam = searchParams.get("date");
    const weekParam = searchParams.get("week");
    const karyawanIdParam = searchParams.get("karyawanId");

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
        range = getWeekRange(parsedDate);
      }
    } else {
      range = parseMonth(monthParam);
      if (!range) {
        return NextResponse.json(
          { success: false, error: "Format bulan tidak valid" },
          { status: 400 },
        );
      }
    }

    const karyawanId = karyawanIdParam ? Number(karyawanIdParam) : null;
    if (karyawanIdParam && (!karyawanId || Number.isNaN(karyawanId))) {
      return NextResponse.json(
        { success: false, error: "karyawanId tidak valid" },
        { status: 400 },
      );
    }

    const workingDays = getWorkingDays(range.start, range.end);
    const totalWorkingDays = workingDays.length;
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

    const karyawanList = await prisma.karyawan.findMany({
      where: {
        isActive: true,
        ...(karyawanId ? { id: karyawanId } : {}),
      },
      select: {
        id: true,
        nama: true,
        nik: true,
        jenis: true,
        gajiPokok: true,
        tunjanganMakan: true,
      },
    });

    // Ambil konfigurasi gaji dari database
    let configGaji = await prisma.konfigurasiGaji.findFirst({ orderBy: { id: "asc" } });
    if (!configGaji) {
      configGaji = await prisma.konfigurasiGaji.create({
        data: {
          jamMasukBatas: "08:10",
          jamKerjaMenit: 540,
          potonganTelat: 10000,
          potonganKurangJam: 10000,
          upahLemburPerJam: 10000,
        },
      });
    }
    const [jamBatasMasukH, menitBatasMasukM] = configGaji.jamMasukBatas.split(":").map(Number);

    const absensi = await prisma.absensi.findMany({
      where: {
        tanggal: {
          gte: range.start,
          lt: range.end,
        },
        ...(karyawanId ? { karyawanId } : {}),
      },
      select: {
        karyawanId: true,
        tanggal: true,
        jamMasuk: true,
        jamKeluar: true,
        status: true,
      },
    });

    const absensiMap = new Map<string, (typeof absensi)[number]>();
    for (const item of absensi) {
      const key = `${item.karyawanId}-${toLocalDateKey(item.tanggal)}`;
      absensiMap.set(key, item);
    }

    const results = karyawanList.map((karyawan) => {
      const totalBulanan = karyawan.gajiPokok + karyawan.tunjanganMakan;
      const dailyRateMonthly =
        monthlyWorkingDays > 0 ? totalBulanan / monthlyWorkingDays : 0;

      let totalHadir = 0;
      let totalTerlambat = 0;
      let totalKurangJam = 0;
      let totalLemburJam = 0;
      let totalJamKerja = 0;
      let potonganTelat = 0;
      let potonganKurangJam = 0;
      let lembur = 0;

      for (const day of workingDays) {
        const key = `${karyawan.id}-${toLocalDateKey(day)}`;
        const record = absensiMap.get(key);

        // Skip hari tanpa absensi, atau status bukan HADIR
        if (!record || record.status !== "HADIR") continue;

        totalHadir += 1;

        const hasMasuk = Boolean(record.jamMasuk);
        const hasKeluar = Boolean(record.jamKeluar);
        const hours = calcDurationHours(record.jamMasuk, record.jamKeluar);

        if (hasMasuk && hasKeluar && hours !== null) {
          totalJamKerja += hours;
          const workMinutes = Math.floor(hours * 60);

          const batasMasuk = new Date(day);
          batasMasuk.setHours(jamBatasMasukH, menitBatasMasukM, 0, 0);
          if (record.jamMasuk && record.jamMasuk > batasMasuk) {
            totalTerlambat += 1;
            potonganTelat += configGaji!.potonganTelat;
          }

          if (workMinutes < configGaji!.jamKerjaMenit) {
            totalKurangJam += 1;
            potonganKurangJam += configGaji!.potonganKurangJam;
          }

          if (workMinutes > configGaji!.jamKerjaMenit) {
            const lemburMinutes = workMinutes - configGaji!.jamKerjaMenit;
            const lemburHours = Math.floor(lemburMinutes / 60);
            if (lemburHours > 0) {
              totalLemburJam += lemburHours;
              lembur += lemburHours * configGaji!.upahLemburPerJam;
            }
          }
        } else if (hasMasuk) {
          // Sudah check-in tapi belum check-out: cek telat saja
          const batasMasuk = new Date(day);
          batasMasuk.setHours(jamBatasMasukH, menitBatasMasukM, 0, 0);
          if (record.jamMasuk && record.jamMasuk > batasMasuk) {
            totalTerlambat += 1;
            potonganTelat += configGaji!.potonganTelat;
          }
        }
      }

      // Gaji dihitung hanya dari hari yang hadir
      const totalGross = dailyRateMonthly * totalHadir;
      const gajiProrate = totalHadir > 0
        ? Math.round(totalGross - potonganTelat - potonganKurangJam + lembur)
        : 0;

      return {
        karyawan: {
          id: karyawan.id,
          nama: karyawan.nama,
          nik: karyawan.nik,
          jenis: karyawan.jenis,
        },
        totalWorkingDays,
        totalHadir,
        totalTerlambat,
        totalKurangJam,
        totalLemburJam,
        totalTidakHadir: 0,
        totalJamKerja: Number(totalJamKerja.toFixed(2)),
        gajiPokokBulanan: karyawan.gajiPokok,
        tunjanganMakanBulanan: karyawan.tunjanganMakan,
        totalBulanan,
        potonganTidakHadir: 0,
        potonganTelat: Math.round(potonganTelat),
        potonganKurangJam: Math.round(potonganKurangJam),
        lembur: Math.round(lembur),
        gajiProrate,
      };
    });

    // DEBUG SEMENTARA - hapus setelah masalah ditemukan
    const debugAbsensiKeys = absensi.map(a => ({
      id: a.karyawanId,
      tanggalRaw: a.tanggal,
      tanggalKey: toLocalDateKey(a.tanggal),
      status: a.status,
    }));
    const debugWorkingDayKeys = workingDays.slice(0, 5).map(d => toLocalDateKey(d));

    return NextResponse.json({
      success: true,
      period: periodParam,
      month: periodParam === "monthly" ? monthParam : null,
      range: { start: range.start, end: range.end },
      data: results,
      _debug: {
        totalAbsensiDitemukan: absensi.length,
        absensiKeys: debugAbsensiKeys,
        workingDayKeysSample: debugWorkingDayKeys,
        monthlyWorkingDays,
        configGajiId: configGaji?.id,
      },
    });
  } catch (error) {
    console.error("Error calculating gaji absensi:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal menghitung gaji absensi",
        _errorDetail: error instanceof Error ? error.message : String(error),
        _errorStack: error instanceof Error ? error.stack?.split("\n").slice(0, 5) : undefined,
      },
      { status: 500 },
    );
  }
}
