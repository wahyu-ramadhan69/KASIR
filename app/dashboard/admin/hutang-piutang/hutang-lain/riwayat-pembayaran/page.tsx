"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Receipt,
  RefreshCw,
  X,
  ArrowLeft,
  Loader2,
  Calendar,
  Edit,
  Trash2,
  Banknote,
  Check,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

const JENIS_LABEL: Record<string, string> = {
  KENDARAAN: "Kendaraan",
  BANK: "Bank / KUR",
  PERALATAN: "Peralatan",
  BANGUNAN: "Bangunan / KPR",
  LAINNYA: "Lainnya",
};

interface HutangLainInfo {
  id: number;
  namaHutang: string;
  jenisHutang: string;
  kreditur: string;
  jumlahPokok: number;
  jumlahDibayar: number;
  status: "AKTIF" | "LUNAS";
}

interface Pembayaran {
  id: number;
  hutangLainId: number;
  jumlahBayar: number;
  tanggalBayar: string;
  keterangan: string | null;
  createdAt: string;
  hutangLain: HutangLainInfo;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

export default function RiwayatPembayaranHutangLainPage() {
  const [list, setList] = useState<Pembayaran[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [totalBayar, setTotalBayar] = useState(0);

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<Pembayaran | null>(null);
  const [editJumlah, setEditJumlah] = useState("");
  const [editTanggal, setEditTanggal] = useState("");
  const [editKeterangan, setEditKeterangan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Pembayaran | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchTerm]);

  // Infinite scroll
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination?.hasMore && !loadingMore && !loading) {
          fetchData(pagination.page + 1, false);
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [pagination, loadingMore, loading]);

  useEffect(() => {
    fetchData(1, true);
  }, [debouncedSearch, startDate, endDate]);

  const buildParams = (page: number) => {
    const p = new URLSearchParams({ page: page.toString(), limit: "20" });
    if (debouncedSearch) p.append("search", debouncedSearch);
    if (startDate) p.append("startDate", startDate);
    if (endDate) p.append("endDate", endDate);
    return p.toString();
  };

  const fetchData = async (page = 1, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`/api/hutang-lain/pembayaran?${buildParams(page)}`);
      const data = await res.json();
      if (data.success) {
        const newList = reset ? data.data : [...list, ...data.data];
        if (reset) setList(data.data);
        else setList((prev) => [...prev, ...data.data]);
        setPagination(data.pagination);
        // Hitung total dari semua data yang sudah dimuat (hanya untuk tampilan summary, bukan akurat untuk semua data)
        if (reset) {
          setTotalBayar(data.data.reduce((s: number, p: Pembayaran) => s + p.jumlahBayar, 0));
        } else {
          setTotalBayar((prev) => prev + data.data.reduce((s: number, p: Pembayaran) => s + p.jumlahBayar, 0));
        }
      }
    } catch {
      toast.error("Gagal mengambil data");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = searchTerm || startDate || endDate;

  const formatRupiah = (v: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);

  const formatRupiahSimple = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}M`;
    if (abs >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)}Jt`;
    if (abs >= 1_000) return `Rp ${(v / 1_000).toFixed(0)}Rb`;
    return `Rp ${v}`;
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  const formatDateTime = (s: string) =>
    new Date(s).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  // ── Edit ──
  const openEdit = (p: Pembayaran) => {
    setEditItem(p);
    setEditJumlah(p.jumlahBayar.toString());
    setEditTanggal(p.tanggalBayar.split("T")[0]);
    setEditKeterangan(p.keterangan || "");
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!editItem) return;
    if (!editJumlah || Number(editJumlah) <= 0) return toast.error("Jumlah bayar harus lebih dari 0");
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/hutang-lain/${editItem.hutangLainId}/bayar/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jumlahBayar: Number(editJumlah),
          tanggalBayar: editTanggal,
          keterangan: editKeterangan || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Pembayaran berhasil diperbarui");
        setShowEditModal(false);
        fetchData(1, true);
      } else toast.error(data.error || "Gagal memperbarui");
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setIsSubmitting(false); }
  };

  // ── Delete ──
  const openDelete = (p: Pembayaran) => {
    setDeleteItem(p);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/hutang-lain/${deleteItem.hutangLainId}/bayar/${deleteItem.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Pembayaran berhasil dihapus");
        setShowDeleteConfirm(false);
        fetchData(1, true);
      } else toast.error(data.error || "Gagal menghapus");
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full max-w-7xl mx-auto px-6 pb-8">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { background: "#333", color: "#fff" },
            success: { style: { background: "#22c55e" } },
            error: { style: { background: "#ef4444" } },
          }}
        />

        {/* ── Header ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-xl p-5 mb-6 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/admin/hutang-piutang/hutang-lain"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2.5 rounded-lg transition-all shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Riwayat Pembayaran</h1>
                <p className="text-emerald-100 text-sm">Hutang Lain-lain — semua riwayat pembayaran yang tercatat</p>
              </div>
            </div>
            <button
              onClick={() => fetchData(1, true)}
              disabled={loading}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Total Pembayaran Dimuat</p>
                <p className="text-lg font-bold text-emerald-600">{formatRupiahSimple(totalBayar)}</p>
                <p className="text-[11px] text-gray-500">{formatRupiah(totalBayar)}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-lg shadow-md">
                <Banknote className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Jumlah Transaksi Dimuat</p>
                <p className="text-xl font-bold text-indigo-700">{pagination?.totalCount ?? 0}</p>
                <p className="text-[11px] text-gray-400">Total seluruh riwayat</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-2.5 rounded-lg shadow-md">
                <Receipt className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter ── */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari nama hutang atau kreditur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none transition-all"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex gap-3 flex-wrap lg:flex-nowrap">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm bg-white" />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm bg-white" />
              </div>
              {hasActiveFilters && (
                <button onClick={handleClearFilters} className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap font-medium">
                  <X className="w-4 h-4" />
                  <span className="hidden xl:inline">Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loading && list.length === 0 ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center">
                <div className="relative">
                  <div className="w-24 h-24 border-8 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
                  <Receipt className="w-10 h-10 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500 mt-6 text-lg font-medium">Memuat data...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    {["Tanggal Bayar", "Nama Hutang", "Jenis", "Kreditur", "Jumlah Bayar", "Keterangan", "Status Hutang", "Aksi"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Tidak ada riwayat pembayaran ditemukan</p>
                      </td>
                    </tr>
                  ) : (
                    list.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">{formatDate(p.tanggalBayar)}</p>
                          <p className="text-xs text-gray-400">{formatDateTime(p.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm font-semibold text-gray-900">{p.hutangLain.namaHutang}</p>
                          <p className="text-xs text-gray-400">{p.hutangLain.kreditur}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-medium">
                            {JENIS_LABEL[p.hutangLain.jenisHutang] ?? p.hutangLain.jenisHutang}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {p.hutangLain.kreditur}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-bold text-emerald-600">{formatRupiah(p.jumlahBayar)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                          {p.keterangan || <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium inline-block ${
                            p.hutangLain.status === "LUNAS"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}>
                            {p.hutangLain.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(p)}
                              className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openDelete(p)}
                              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {loadingMore && (
            <div className="flex justify-center items-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          )}
        </div>

        <div ref={loadMoreRef} className="h-10" />
      </div>

      {/* ══ Modal Edit ══ */}
      {showEditModal && editItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 rounded-t-xl flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Edit Pembayaran</h2>
              <button onClick={() => setShowEditModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {/* Info hutang */}
              <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-1">
                <p className="text-sm font-semibold text-gray-900">{editItem.hutangLain.namaHutang}</p>
                <p className="text-xs text-gray-500">{editItem.hutangLain.kreditur} · {JENIS_LABEL[editItem.hutangLain.jenisHutang]}</p>
                <p className="text-xs text-gray-500">Pokok: {formatRupiah(editItem.hutangLain.jumlahPokok)}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Jumlah Bayar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editJumlah}
                    onChange={(e) => setEditJumlah(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none text-lg"
                    placeholder="Masukkan jumlah bayar"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Bayar</label>
                  <input
                    type="date"
                    value={editTanggal}
                    onChange={(e) => setEditTanggal(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan</label>
                  <input
                    type="text"
                    value={editKeterangan}
                    onChange={(e) => setEditKeterangan(e.target.value)}
                    placeholder="Opsional"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleEdit}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Perbarui
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Confirm Delete ══ */}
      {showDeleteConfirm && deleteItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="font-bold text-lg text-gray-900">Hapus Pembayaran?</h2>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
              <p className="text-sm font-semibold text-gray-900">{deleteItem.hutangLain.namaHutang}</p>
              <p className="text-sm text-gray-600">Jumlah: <span className="font-semibold text-emerald-600">{formatRupiah(deleteItem.jumlahBayar)}</span></p>
              <p className="text-sm text-gray-600">Tanggal: {formatDate(deleteItem.tanggalBayar)}</p>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Menghapus pembayaran ini akan mengupdate sisa hutang dan status hutang secara otomatis.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
