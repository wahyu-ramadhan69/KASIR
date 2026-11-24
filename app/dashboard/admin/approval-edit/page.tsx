"use client";
import React, { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Check,
  X,
  Clock,
  Loader2,
  RefreshCw,
  User,
  Receipt,
  ChevronDown,
  ArrowRight,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { notifyApprovalEditChanged as notifySidebar } from "@/app/lib/approvalEditEvents";

type Status = "PENDING" | "APPROVED" | "REJECTED";

interface RingkasanItem {
  barangId: number;
  namaBarang: string;
  jenisKemasan: string;
  jumlahPerKemasan: number;
  totalItem: number;
  hargaJual: number;
  diskonPerItem: number;
  subtotal: number;
}

interface Ringkasan {
  tipe?: "TOKO" | "SALES";
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
  items: RingkasanItem[];
}

interface Permintaan {
  id: number;
  penjualanId: number;
  alasan: string;
  status: Status;
  catatanAdmin: string | null;
  createdAt: string;
  diprosesAt: string | null;
  payload: { data: unknown; sesudah: Ringkasan };
  snapshotSebelum: Ringkasan & { updatedAt: string };
  penjualan: {
    id: number;
    kodePenjualan: string;
    tanggalTransaksi: string;
    isDeleted: boolean;
  };
  diajukanOleh: { id: number; username: string };
  diprosesOleh: { id: number; username: string } | null;
}


const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);

const formatDateTime = (s: string | null) =>
  s
    ? new Date(s).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const formatDate = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const formatQty = (totalItem: number, perKemasan: number, label: string) => {
  const pk = Math.max(1, perKemasan || 1);
  if (pk <= 1) return `${totalItem} item`;
  const k = Math.floor(totalItem / pk);
  const sisa = totalItem % pk;
  if (k > 0 && sisa > 0) return `${k} ${label} & ${sisa} item`;
  if (k > 0) return `${k} ${label}`;
  return `${sisa} item`;
};

const formatMetode = (m: string) =>
  m === "CASH_TRANSFER" ? "CASH + TRANSFER" : m;

type TipeFilter = "all" | "TOKO" | "SALES";

const STATUS_TABS: { key: Status; label: string }[] = [
  { key: "PENDING", label: "Menunggu" },
  { key: "APPROVED", label: "Disetujui" },
  { key: "REJECTED", label: "Ditolak" },
];

// ─── Perbandingan item sebelum vs sesudah ────────────────────────────────────
type ItemDiff = {
  barangId: number;
  namaBarang: string;
  jenisKemasan: string;
  jumlahPerKemasan: number;
  before: RingkasanItem | null;
  after: RingkasanItem | null;
  kind: "tambah" | "hapus" | "ubah" | "sama";
};

const diffItems = (before: RingkasanItem[], after: RingkasanItem[]) => {
  const map = new Map<number, ItemDiff>();
  for (const b of before) {
    map.set(b.barangId, {
      barangId: b.barangId,
      namaBarang: b.namaBarang,
      jenisKemasan: b.jenisKemasan,
      jumlahPerKemasan: b.jumlahPerKemasan,
      before: b,
      after: null,
      kind: "hapus",
    });
  }
  for (const a of after) {
    const existing = map.get(a.barangId);
    if (existing) {
      existing.after = a;
      const b = existing.before!;
      existing.kind =
        b.totalItem !== a.totalItem ||
        b.hargaJual !== a.hargaJual ||
        b.diskonPerItem !== a.diskonPerItem
          ? "ubah"
          : "sama";
    } else {
      map.set(a.barangId, {
        barangId: a.barangId,
        namaBarang: a.namaBarang,
        jenisKemasan: a.jenisKemasan,
        jumlahPerKemasan: a.jumlahPerKemasan,
        before: null,
        after: a,
        kind: "tambah",
      });
    }
  }
  const order = { ubah: 0, tambah: 1, hapus: 2, sama: 3 };
  return Array.from(map.values()).sort((x, y) => order[x.kind] - order[y.kind]);
};

const KIND_STYLE: Record<ItemDiff["kind"], { row: string; badge: string; label: string }> = {
  tambah: { row: "bg-green-50", badge: "bg-green-100 text-green-700", label: "Ditambah" },
  hapus: { row: "bg-red-50", badge: "bg-red-100 text-red-700", label: "Dihapus" },
  ubah: { row: "bg-amber-50", badge: "bg-amber-100 text-amber-800", label: "Diubah" },
  sama: { row: "", badge: "bg-gray-100 text-gray-500", label: "Tetap" },
};

function CompareRow({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  const changed = before !== after;
  return (
    <div
      className={`grid grid-cols-[110px_1fr] sm:grid-cols-[140px_1fr] gap-2 px-3 py-2 text-sm ${
        changed ? "bg-amber-50" : ""
      }`}
    >
      <span className="text-gray-500">{label}</span>
      {changed ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-gray-400 line-through">{before}</span>
          <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
          <span className="font-semibold text-gray-900">{after}</span>
        </span>
      ) : (
        <span className="text-gray-800">{after}</span>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
const ApprovalEditPage = () => {
  const [status, setStatus] = useState<Status>("PENDING");
  const [list, setList] = useState<Permintaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [tipeFilter, setTipeFilter] = useState<TipeFilter>("all");

  // Modal aksi
  const [action, setAction] = useState<{
    type: "setujui" | "tolak";
    item: Permintaan;
  } | null>(null);
  const [catatan, setCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/permintaan-edit-penjualan?status=${status}&limit=50`,
      );
      const data = await res.json();
      if (data.success) {
        setList(data.data);
        setPendingCount(data.pendingCount || 0);
        // Buka otomatis permintaan pertama di tab Menunggu
        if (status === "PENDING" && data.data.length > 0) {
          setExpanded((prev) => prev ?? data.data[0].id);
        }
      } else {
        toast.error(data.error || "Gagal mengambil data");
      }
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengambil data permintaan edit");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    setExpanded(null);
    fetchList();
  }, [fetchList]);

  const visibleList =
    tipeFilter === "all"
      ? list
      : list.filter((p) => (p.snapshotSebelum?.tipe ?? "TOKO") === tipeFilter);

  const openAction = (type: "setujui" | "tolak", item: Permintaan) => {
    setCatatan("");
    setAction({ type, item });
  };

  const submitAction = async () => {
    if (!action) return;
    if (action.type === "tolak" && catatan.trim().length < 3) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/permintaan-edit-penjualan/${action.item.id}/${action.type}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ catatan: catatan.trim() }),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setAction(null);
        setExpanded(null);
        fetchList();
        notifySidebar();
      } else {
        toast.error(data.error || "Gagal memproses permintaan", {
          duration: data.conflict ? 7000 : 4000,
        });
        if (data.conflict) fetchList();
      }
    } catch (error) {
      console.error(error);
      toast.error("Gagal memproses permintaan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full px-3 sm:px-6 pb-8">
        <Toaster position="top-right" />

        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-5 sm:p-6 mb-6 shadow-xl">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative bg-white/20 p-3 rounded-xl">
                <Bell className="w-7 h-7 text-white" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center ring-2 ring-blue-700">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Approval Edit Penjualan
                </h1>
                <p className="text-blue-100 text-sm">
                  Permintaan edit transaksi dari kasir. Perubahan baru
                  diterapkan setelah disetujui.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                fetchList();
                notifySidebar();
              }}
              disabled={loading}
              className="self-start sm:self-auto bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex gap-2 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                status === tab.key
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {tab.label}
              {tab.key === "PENDING" && pendingCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                    status === tab.key ? "bg-white text-blue-700" : "bg-red-500 text-white"
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <select
          value={tipeFilter}
          onChange={(e) => setTipeFilter(e.target.value as TipeFilter)}
          className="ml-auto px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">Semua Tipe</option>
          <option value="TOKO">Penjualan Toko</option>
          <option value="SALES">Penjualan Sales</option>
        </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
        ) : visibleList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-14 text-center">
            <Check className="w-12 h-12 mx-auto mb-3 text-green-400" />
            <p className="text-gray-500 font-medium">
              {status === "PENDING"
                ? "Tidak ada permintaan edit yang menunggu approval"
                : "Belum ada data"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleList.map((p) => {
              const before = p.snapshotSebelum;
              const after = p.payload?.sesudah;
              const isOpen = expanded === p.id;
              const selisih = (after?.totalHarga || 0) - (before?.totalHarga || 0);
              const items = before && after ? diffItems(before.items, after.items) : [];
              const jumlahBerubah = items.filter((i) => i.kind !== "sama").length;

              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl shadow-md border overflow-hidden ${
                    p.status === "PENDING" ? "border-amber-200" : "border-gray-100"
                  }`}
                >
                  {/* Ringkasan kartu */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : p.id)}
                    className="w-full text-left p-4 sm:p-5 hover:bg-gray-50/70 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Receipt className="w-4 h-4 text-blue-600" />
                          <span className="font-bold text-gray-900">
                            {p.penjualan.kodePenjualan}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              before?.tipe === "SALES"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {before?.tipe === "SALES" ? "Penjualan Sales" : "Penjualan Toko"}
                          </span>
                          {p.status === "PENDING" && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Menunggu
                            </span>
                          )}
                          {p.status === "APPROVED" && (
                            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-semibold">
                              Disetujui
                            </span>
                          )}
                          {p.status === "REJECTED" && (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
                              Ditolak
                            </span>
                          )}
                          {p.penjualan.isDeleted && (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
                              Transaksi dihapus
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {before?.customer}
                          {before?.namaToko && (
                            <span className="text-gray-400"> · {before.namaToko}</span>
                          )}
                          {before?.sales && (
                            <span className="text-blue-600"> · Sales: {before.sales}</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {p.diajukanOleh.username}
                          </span>
                          <span>Diajukan {formatDateTime(p.createdAt)}</span>
                          {p.diprosesOleh && (
                            <span>
                              Diproses {p.diprosesOleh.username} ·{" "}
                              {formatDateTime(p.diprosesAt)}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-800 mt-2 flex items-start gap-1.5">
                          <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{p.alasan}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-4 lg:gap-6">
                        <div className="text-right">
                          <p className="text-[11px] text-gray-500 uppercase font-semibold">
                            Total
                          </p>
                          <p className="text-sm text-gray-400 line-through">
                            {formatRupiah(before?.totalHarga || 0)}
                          </p>
                          <p className="text-base font-bold text-gray-900">
                            {formatRupiah(after?.totalHarga || 0)}
                          </p>
                          {selisih !== 0 && (
                            <p
                              className={`text-xs font-semibold ${
                                selisih > 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {selisih > 0 ? "+" : ""}
                              {formatRupiah(selisih)}
                            </p>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] text-gray-500 uppercase font-semibold">
                            Item berubah
                          </p>
                          <p className="text-lg font-bold text-amber-600">{jumlahBerubah}</p>
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Detail perbandingan */}
                  {isOpen && before && after && (
                    <div className="border-t border-gray-100 p-4 sm:p-5 space-y-5 bg-slate-50/50">
                      {/* Header transaksi */}
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-2">
                          Data Transaksi
                        </h3>
                        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                          <CompareRow
                            label="Customer"
                            before={`${before.customer}${before.namaToko ? ` (${before.namaToko})` : ""}`}
                            after={`${after.customer}${after.namaToko ? ` (${after.namaToko})` : ""}`}
                          />
                          {(before.tipe === "SALES" || after.tipe === "SALES") && (
                            <CompareRow
                              label="Sales"
                              before={before.sales || "-"}
                              after={after.sales || "-"}
                            />
                          )}
                          <CompareRow
                            label="Tanggal"
                            before={formatDate(before.tanggalTransaksi)}
                            after={formatDate(after.tanggalTransaksi)}
                          />
                          <CompareRow
                            label="Metode Bayar"
                            before={formatMetode(before.metodePembayaran)}
                            after={formatMetode(after.metodePembayaran)}
                          />
                          <CompareRow
                            label="Diskon Nota"
                            before={formatRupiah(before.diskonNota)}
                            after={formatRupiah(after.diskonNota)}
                          />
                          <CompareRow
                            label="Total"
                            before={formatRupiah(before.totalHarga)}
                            after={formatRupiah(after.totalHarga)}
                          />
                          <CompareRow
                            label="Dibayar"
                            before={formatRupiah(before.jumlahDibayar)}
                            after={formatRupiah(after.jumlahDibayar)}
                          />
                          <CompareRow
                            label="Status"
                            before={before.statusPembayaran === "HUTANG" ? "PIUTANG" : before.statusPembayaran}
                            after={after.statusPembayaran === "HUTANG" ? "PIUTANG" : after.statusPembayaran}
                          />
                          {(before.statusPembayaran === "HUTANG" ||
                            after.statusPembayaran === "HUTANG") && (
                            <CompareRow
                              label="Jatuh Tempo"
                              before={formatDate(before.tanggalJatuhTempo)}
                              after={formatDate(after.tanggalJatuhTempo)}
                            />
                          )}
                        </div>
                      </div>

                      {/* Item */}
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-2">
                          Barang
                        </h3>
                        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                          <table className="w-full text-sm min-w-[560px]">
                            <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                              <tr>
                                <th className="px-3 py-2 text-left">Barang</th>
                                <th className="px-3 py-2 text-left">Qty</th>
                                <th className="px-3 py-2 text-right">Harga</th>
                                <th className="px-3 py-2 text-right">Subtotal</th>
                                <th className="px-3 py-2 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {items.map((it) => {
                                const st = KIND_STYLE[it.kind];
                                const qty = (r: RingkasanItem | null) =>
                                  r ? formatQty(r.totalItem, it.jumlahPerKemasan, it.jenisKemasan) : "-";
                                const show = (
                                  b: string,
                                  a: string,
                                ) =>
                                  it.kind === "ubah" && b !== a ? (
                                    <span className="flex flex-wrap items-center gap-1">
                                      <span className="text-gray-400 line-through">{b}</span>
                                      <ArrowRight className="w-3 h-3 text-amber-600" />
                                      <span className="font-semibold">{a}</span>
                                    </span>
                                  ) : it.kind === "hapus" ? (
                                    <span className="text-gray-400 line-through">{b}</span>
                                  ) : (
                                    <span>{a}</span>
                                  );
                                return (
                                  <tr key={it.barangId} className={st.row}>
                                    <td className="px-3 py-2 font-medium text-gray-900">
                                      {it.namaBarang}
                                    </td>
                                    <td className="px-3 py-2">
                                      {show(qty(it.before), qty(it.after))}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {show(
                                        it.before ? formatRupiah(it.before.hargaJual) : "-",
                                        it.after ? formatRupiah(it.after.hargaJual) : "-",
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {show(
                                        it.before ? formatRupiah(it.before.subtotal) : "-",
                                        it.after ? formatRupiah(it.after.subtotal) : "-",
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.badge}`}>
                                        {st.label}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Alasan & catatan */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl border border-gray-200 p-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                            Alasan Kasir
                          </p>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{p.alasan}</p>
                        </div>
                        {p.catatanAdmin && (
                          <div
                            className={`rounded-xl border p-3 ${
                              p.status === "REJECTED"
                                ? "bg-red-50 border-red-200"
                                : "bg-green-50 border-green-200"
                            }`}
                          >
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                              Catatan Admin
                            </p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">
                              {p.catatanAdmin}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Aksi */}
                      {p.status === "PENDING" && (
                        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                          <button
                            onClick={() => openAction("tolak", p)}
                            className="px-5 py-2.5 rounded-xl bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm flex items-center justify-center gap-2"
                          >
                            <X className="w-4 h-4" /> Tolak
                          </button>
                          <button
                            onClick={() => openAction("setujui", p)}
                            className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow"
                          >
                            <Check className="w-4 h-4" /> Setujui & Terapkan
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal konfirmasi */}
      {action && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !submitting && setAction(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`p-2.5 rounded-xl ${
                  action.type === "setujui" ? "bg-green-100" : "bg-red-100"
                }`}
              >
                {action.type === "setujui" ? (
                  <Check className="w-6 h-6 text-green-600" />
                ) : (
                  <X className="w-6 h-6 text-red-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {action.type === "setujui" ? "Setujui Permintaan Edit" : "Tolak Permintaan Edit"}
                </h3>
                <p className="text-sm text-gray-500">
                  {action.item.penjualan.kodePenjualan} · {action.item.diajukanOleh.username}
                </p>
              </div>
            </div>

            {action.type === "setujui" ? (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Perubahan akan langsung diterapkan ke transaksi, termasuk
                  stok barang, pembayaran, dan piutang customer.
                </span>
              </div>
            ) : null}

            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {action.type === "tolak" ? (
                <>
                  Alasan penolakan <span className="text-red-500">*</span>
                </>
              ) : (
                "Catatan (opsional)"
              )}
            </label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={3}
              autoFocus
              placeholder={
                action.type === "tolak"
                  ? "Jelaskan kenapa permintaan ditolak..."
                  : "Catatan untuk kasir..."
              }
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm"
            />

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setAction(null)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={submitAction}
                disabled={
                  submitting ||
                  (action.type === "tolak" && catatan.trim().length < 3)
                }
                className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${
                  action.type === "setujui"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {action.type === "setujui" ? "Setujui" : "Tolak"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalEditPage;
