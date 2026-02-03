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

function calcDurationHours(start?: Date | null, end?: Date | null): number | null {
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
    const karyawanIdParam = searchParams.get("karyawanId");

    const range = parseMonth(monthParam);
    if (!range) {
      return NextResponse.json(
        { success: false, error: "Format bulan tidak valid" },
        { status: 400 }
      );
    }

    const karyawanId = karyawanIdParam ? Number(karyawanIdParam) : null;
    if (karyawanIdParam && (!karyawanId || Number.isNaN(karyawanId))) {
      return NextResponse.json(
        { success: false, error: "karyawanId tidak valid" },
        { status: 400 }
      );
    }

    const workingDays = getWorkingDays(range.start, range.end);
    const totalWorkingDays = workingDays.length;

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

    const absensiMap = new Map<string, typeof absensi[number]>();
    for (const item of absensi) {
      const key = `${item.karyawanId}-${item.tanggal.toISOString().slice(0, 10)}`;
      absensiMap.set(key, item);
    }

    const results = karyawanList.map((karyawan) => {
      const totalBulanan = karyawan.gajiPokok + karyawan.tunjanganMakan;
      const dailyRate =
        totalWorkingDays > 0 ? totalBulanan / totalWorkingDays : 0;

      let totalHadir = 0;
      let totalTerlambat = 0;
      let totalTidakHadir = 0;
      let totalJamKerja = 0;
      let totalGaji = 0;

      for (const day of workingDays) {
        const key = `${karyawan.id}-${day.toISOString().slice(0, 10)}`;
        const record = absensiMap.get(key);
        if (!record) {
          totalTidakHadir += 1;
          continue;
        }

        if (["IZIN", "SAKIT", "LIBUR"].includes(record.status)) {
          totalTidakHadir += 1;
          continue;
        }

        const hasMasuk = Boolean(record.jamMasuk);
        const hasKeluar = Boolean(record.jamKeluar);
        const hours = calcDurationHours(record.jamMasuk, record.jamKeluar);

        if (hasMasuk && hasKeluar && hours !== null) {
          totalHadir += 1;
          totalJamKerja += hours;
          if (hours < 9) {
            totalTerlambat += 1;
            totalGaji += dailyRate * 0.5;
          } else {
            totalGaji += dailyRate;
          }
          continue;
        }

        if (hasMasuk || hasKeluar) {
          totalHadir += 1;
          totalTerlambat += 1;
          totalGaji += dailyRate * 0.5;
          continue;
        }

        totalTidakHadir += 1;
      }

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
        totalTidakHadir,
        totalJamKerja: Number(totalJamKerja.toFixed(2)),
        gajiPokokBulanan: karyawan.gajiPokok,
        tunjanganMakanBulanan: karyawan.tunjanganMakan,
        totalBulanan,
        gajiProrate: Math.round(totalGaji),
      };
    });

    return NextResponse.json({
      success: true,
      month: monthParam,
      data: results,
    });
  } catch (error) {
    console.error("Error calculating gaji absensi:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghitung gaji absensi" },
      { status: 500 }
    );
  }
}
