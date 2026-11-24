// =====================================================
// PATH: app/lib/pengaturan.ts
// Pengaturan aplikasi (tabel PengaturanAplikasi, key-value)
// =====================================================
import type { PrismaClient } from "@prisma/client";
import { getStartOfTodayWIB, getTodayWIB } from "@/app/lib/tanggal";

/** Mode akses riwayat penjualan untuk kasir */
export type RiwayatMode = "SEMUA" | "HARI_INI";
export type RiwayatJenis = "toko" | "sales";

export const RIWAYAT_KEYS: Record<RiwayatJenis, string> = {
  toko: "riwayat_kasir_toko",
  sales: "riwayat_kasir_sales",
};

/** Default = perilaku sebelum pengaturan ini ada */
export const RIWAYAT_DEFAULTS: Record<RiwayatJenis, RiwayatMode> = {
  toko: "SEMUA",
  sales: "HARI_INI",
};

const isRiwayatMode = (v: unknown): v is RiwayatMode =>
  v === "SEMUA" || v === "HARI_INI";

/**
 * Ambil mode riwayat kasir. Jika tabel belum dimigrasi / error,
 * kembalikan default agar halaman tetap berjalan.
 */
export async function getRiwayatModes(
  prisma: PrismaClient,
): Promise<Record<RiwayatJenis, RiwayatMode>> {
  const result = { ...RIWAYAT_DEFAULTS };
  try {
    const rows = await prisma.pengaturanAplikasi.findMany({
      where: { key: { in: Object.values(RIWAYAT_KEYS) } },
    });
    for (const jenis of Object.keys(RIWAYAT_KEYS) as RiwayatJenis[]) {
      const row = rows.find((r) => r.key === RIWAYAT_KEYS[jenis]);
      if (row && isRiwayatMode(row.value)) result[jenis] = row.value;
    }
  } catch (error) {
    console.error("Gagal membaca pengaturan riwayat kasir:", error);
  }
  return result;
}

export async function getRiwayatMode(
  prisma: PrismaClient,
  jenis: RiwayatJenis,
): Promise<RiwayatMode> {
  return (await getRiwayatModes(prisma))[jenis];
}

export async function setRiwayatMode(
  prisma: PrismaClient,
  jenis: RiwayatJenis,
  mode: RiwayatMode,
  userId?: number,
) {
  const key = RIWAYAT_KEYS[jenis];
  await prisma.pengaturanAplikasi.upsert({
    where: { key },
    create: { key, value: mode, updatedById: userId ?? null },
    update: { value: mode, updatedById: userId ?? null },
  });
}

/**
 * Terapkan batas "hari ini saja" (WIB) ke filter tanggalTransaksi.
 * Filter tanggal dari user tetap dihormati selama masih di dalam hari ini.
 */
export function applyRiwayatHariIni(where: {
  tanggalTransaksi?: { gte?: Date; lte?: Date };
}) {
  const start = getStartOfTodayWIB();
  const end = new Date(`${getTodayWIB()}T23:59:59.999+07:00`);

  const current = where.tanggalTransaksi ?? {};
  where.tanggalTransaksi = {
    ...current,
    gte: current.gte && current.gte > start ? current.gte : start,
    lte: current.lte && current.lte < end ? current.lte : end,
  };
}
