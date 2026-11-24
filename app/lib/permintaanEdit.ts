// =====================================================
// PATH: app/lib/permintaanEdit.ts
// Helper permintaan edit penjualan (kasir -> approval admin)
// =====================================================
import { PrismaClient } from "@prisma/client";
import {
  calculatePenjualan,
  getTotalItemPcs,
  toNumber,
} from "@/app/lib/penjualanEdit";

/** Ringkasan transaksi untuk ditampilkan (sebelum / sesudah) */
export type RingkasanPenjualan = {
  /** TOKO = penjualan toko, SALES = penjualan sales (karyawan) */
  tipe?: "TOKO" | "SALES";
  /** nama sales (penjualan sales) */
  sales?: string | null;
  customer: string;
  namaToko: string | null;
  tanggalTransaksi: string | null;
  tanggalJatuhTempo: string | null;
  metodePembayaran: string;
  statusPembayaran: string;
  diskonNota: number;
  subtotal: number;
  totalHarga: number;
  jumlahDibayar: number;
  items: {
    barangId: number;
    namaBarang: string;
    jenisKemasan: string;
    jumlahPerKemasan: number;
    totalItem: number;
    hargaJual: number;
    diskonPerItem: number;
    subtotal: number;
  }[];
};

/** Bentuk JSON yang disimpan di kolom `payload` */
export type PermintaanPayload = {
  /** body yang nanti dikirim ke editPenjualan saat disetujui */
  data: any;
  /** ringkasan usulan untuk tampilan admin */
  sesudah: RingkasanPenjualan;
};

/** Bentuk JSON yang disimpan di kolom `snapshotSebelum` */
export type PermintaanSnapshot = RingkasanPenjualan & {
  /** dipakai untuk mendeteksi perubahan transaksi saat approval */
  updatedAt: string;
};

const PENJUALAN_INCLUDE = {
  customer: true,
  karyawan: { select: { nama: true } },
  items: { include: { barang: true } },
} as const;

export async function buildSnapshotSebelum(
  prisma: PrismaClient,
  penjualanId: number,
): Promise<PermintaanSnapshot> {
  const p = await prisma.penjualanHeader.findUniqueOrThrow({
    where: { id: penjualanId },
    include: PENJUALAN_INCLUDE,
  });

  const calc = calculatePenjualan(p.items, toNumber(p.diskonNota));

  return {
    updatedAt: p.updatedAt.toISOString(),
    tipe: p.karyawanId ? "SALES" : "TOKO",
    sales: p.karyawan?.nama ?? null,
    customer: p.customer?.nama || p.namaCustomer || "-",
    namaToko: p.customer?.namaToko || null,
    tanggalTransaksi: p.tanggalTransaksi?.toISOString() ?? null,
    tanggalJatuhTempo: p.tanggalJatuhTempo?.toISOString() ?? null,
    metodePembayaran: p.metodePembayaran,
    statusPembayaran: p.statusPembayaran,
    diskonNota: toNumber(p.diskonNota),
    subtotal: toNumber(p.subtotal),
    totalHarga: toNumber(p.totalHarga),
    jumlahDibayar: toNumber(p.jumlahDibayar),
    items: calc.items.map((item: any) => ({
      barangId: item.barangId,
      namaBarang: item.barang.namaBarang,
      jenisKemasan: item.barang.jenisKemasan,
      jumlahPerKemasan: toNumber(item.barang.jumlahPerKemasan),
      totalItem: item.totalPcs,
      hargaJual: toNumber(item.hargaJual),
      diskonPerItem: toNumber(item.diskonPerItem),
      subtotal: item.subtotalItem,
    })),
  };
}

/** Hitung ringkasan dari body edit yang diusulkan kasir */
export async function buildRingkasanUsulan(
  prisma: PrismaClient,
  penjualanId: number,
  body: any,
): Promise<RingkasanPenjualan> {
  const penjualan = await prisma.penjualanHeader.findUniqueOrThrow({
    where: { id: penjualanId },
    include: { customer: true, karyawan: { select: { nama: true } } },
  });

  const items: any[] = Array.isArray(body.items) ? body.items : [];
  const barangIds = Array.from(
    new Set(items.map((item) => Number(item.barangId))),
  );
  const barangList = await prisma.barang.findMany({
    where: { id: { in: barangIds } },
  });
  const barangById = new Map(barangList.map((b) => [b.id, b]));

  const diskonNota = toNumber(body.diskonNota);
  const jumlahDibayar = toNumber(body.jumlahDibayar);
  const calc = calculatePenjualan(
    items.map((item) => ({ ...item, barang: barangById.get(Number(item.barangId)) })),
    diskonNota,
  );
  const totalHarga = calc.ringkasan.totalHarga;

  // Customer usulan
  let customer = penjualan.customer?.nama || penjualan.namaCustomer || "-";
  let namaToko: string | null = penjualan.customer?.namaToko || null;
  if (body.customerId) {
    const c = await prisma.customer.findUnique({
      where: { id: Number(body.customerId) },
    });
    customer = c?.nama || "-";
    namaToko = c?.namaToko || null;
  } else if (body.namaCustomer !== undefined) {
    customer = body.namaCustomer || "-";
    namaToko = null;
  }

  // Sales usulan (penjualan sales)
  let sales: string | null = penjualan.karyawan?.nama ?? null;
  let karyawanIdBaru = penjualan.karyawanId;
  if (body.karyawanId !== undefined) {
    karyawanIdBaru = body.karyawanId ? Number(body.karyawanId) : null;
    if (karyawanIdBaru) {
      const k = await prisma.karyawan.findUnique({
        where: { id: karyawanIdBaru },
        select: { nama: true },
      });
      sales = k?.nama ?? "-";
    } else {
      sales = null;
    }
  }

  const statusPembayaran = jumlahDibayar >= totalHarga ? "LUNAS" : "HUTANG";

  return {
    tipe: karyawanIdBaru ? "SALES" : "TOKO",
    sales,
    customer,
    namaToko,
    tanggalTransaksi: body.tanggalTransaksi
      ? new Date(body.tanggalTransaksi).toISOString()
      : (penjualan.tanggalTransaksi?.toISOString() ?? null),
    tanggalJatuhTempo:
      statusPembayaran === "HUTANG" && body.tanggalJatuhTempo
        ? new Date(body.tanggalJatuhTempo).toISOString()
        : null,
    metodePembayaran: body.metodePembayaran || "CASH",
    statusPembayaran,
    diskonNota,
    subtotal: calc.ringkasan.subtotal,
    totalHarga,
    jumlahDibayar,
    items: calc.items.map((item: any) => {
      const barang = barangById.get(Number(item.barangId));
      const perKemasan = toNumber(barang?.jumlahPerKemasan || 1);
      return {
        barangId: Number(item.barangId),
        namaBarang: barang?.namaBarang || "-",
        jenisKemasan: barang?.jenisKemasan || "dus",
        jumlahPerKemasan: perKemasan,
        totalItem: getTotalItemPcs(item, perKemasan),
        hargaJual: toNumber(item.hargaJual),
        diskonPerItem: toNumber(item.diskonPerItem),
        subtotal: item.subtotalItem,
      };
    }),
  };
}
