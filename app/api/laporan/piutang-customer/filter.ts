// Shared helpers untuk laporan piutang customer (list + export Excel)
import { Prisma } from "@prisma/client";

export type PiutangFilters = {
  startDate?: string | null;
  endDate?: string | null;
  search?: string | null;
  statusPembayaran?: string | null; // "HUTANG" (default) | "LUNAS" | "all"
  jatuhTempo?: string | null; // "all" | "overdue" | "7hari"
};

export function readPiutangFilters(searchParams: URLSearchParams): PiutangFilters {
  return {
    startDate: searchParams.get("startDate"),
    endDate: searchParams.get("endDate"),
    search: searchParams.get("search"),
    statusPembayaran: searchParams.get("statusPembayaran") || "HUTANG",
    jatuhTempo: searchParams.get("jatuhTempo") || "all",
  };
}

/**
 * Data yang sama dengan halaman admin/hutang-piutang/piutang-customer:
 * penjualan toko (bukan kanvas), status SELESAI, tidak dihapus.
 * Tanggal dihitung dalam WIB (Asia/Jakarta).
 */
export function buildPiutangWhere(
  filters: PiutangFilters,
): Prisma.PenjualanHeaderWhereInput {
  const where: Prisma.PenjualanHeaderWhereInput = {
    karyawanId: null,
    perjalananSalesId: null,
    statusTransaksi: "SELESAI",
    isDeleted: false,
  };

  const status = filters.statusPembayaran || "HUTANG";
  if (status === "HUTANG" || status === "LUNAS") {
    where.statusPembayaran = status;
  }

  if (filters.startDate || filters.endDate) {
    const tanggal: Prisma.DateTimeFilter = {};
    if (filters.startDate) {
      tanggal.gte = new Date(`${filters.startDate}T00:00:00+07:00`);
    }
    if (filters.endDate) {
      tanggal.lte = new Date(`${filters.endDate}T23:59:59.999+07:00`);
    }
    where.tanggalTransaksi = tanggal;
  }

  if (filters.jatuhTempo === "overdue") {
    where.tanggalJatuhTempo = { lt: new Date() };
  } else if (filters.jatuhTempo === "7hari") {
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    where.tanggalJatuhTempo = { gte: new Date(), lte: limit };
  }

  if (filters.search) {
    const search = filters.search;
    where.OR = [
      { kodePenjualan: { contains: search, mode: "insensitive" } },
      { namaCustomer: { contains: search, mode: "insensitive" } },
      { customer: { nama: { contains: search, mode: "insensitive" } } },
      { customer: { namaToko: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

export function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

export function getSisaPiutang(p: {
  totalHarga: bigint | number;
  jumlahDibayar: bigint | number;
}): number {
  return Math.max(0, toNumber(p.totalHarga) - toNumber(p.jumlahDibayar));
}

/** Selisih hari antara jatuh tempo dan sekarang (negatif = terlambat). */
export function getSisaHariJatuhTempo(tanggalJatuhTempo: Date | null): number | null {
  if (!tanggalJatuhTempo) return null;
  const diff = new Date(tanggalJatuhTempo).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getStatusJatuhTempoLabel(
  tanggalJatuhTempo: Date | null,
  statusPembayaran: string,
): string {
  if (statusPembayaran === "LUNAS") return "Lunas";
  const hari = getSisaHariJatuhTempo(tanggalJatuhTempo);
  if (hari === null) return "-";
  if (hari < 0) return `Terlambat ${Math.abs(hari)} hari`;
  if (hari === 0) return "Hari ini";
  return `${hari} hari lagi`;
}
