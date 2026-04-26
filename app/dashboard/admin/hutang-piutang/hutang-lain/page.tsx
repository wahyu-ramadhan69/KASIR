"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Receipt,
  RefreshCw,
  X,
  Banknote,
  AlertCircle,
  ArrowLeft,
  Eye,
  Loader2,
  Clock,
  AlertTriangle,
  Check,
  CalendarClock,
  Plus,
  Edit,
  Trash2,
  Calendar,
  CreditCard,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

const JENIS_OPTIONS = [
  { value: "KENDARAAN", label: "Kendaraan" },
  { value: "BANK", label: "Bank / KUR" },
  { value: "PERALATAN", label: "Peralatan" },
  { value: "BANGUNAN", label: "Bangunan / KPR" },
  { value: "LAINNYA", label: "Lainnya" },
];

interface HutangLain {
  id: number;
  namaHutang: string;
  jenisHutang: string;
  kreditur: string;
  jumlahPokok: number;
  jumlahDibayar: number;
  tanggalMulai: string;
  tanggalJatuhTempo: string | null;
  keterangan: string | null;
  status: "AKTIF" | "LUNAS";
  pembayaran: Pembayaran[];
  createdAt: string;
}

interface Pembayaran {
  id: number;
  jumlahBayar: number;
  tanggalBayar: string;
  keterangan: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

const getJatuhTempoStatus = (tanggalJatuhTempo: string) => {
  const now = new Date();
  const jatuhTempo = new Date(tanggalJatuhTempo);
  const diffTime = jatuhTempo.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: "overdue",
      label: `Terlambat ${Math.abs(diffDays)} hari`,
      color: "bg-red-100 text-red-700 border-red-200",
      textColor: "text-red-600",
      icon: AlertTriangle,
    };
  } else if (diffDays <= 7) {
    return {
      status: "critical",
      label: diffDays === 0 ? "Hari ini" : `${diffDays} hari lagi`,
      color: "bg-red-100 text-red-700 border-red-200",
      textColor: "text-red-600",
      icon: AlertTriangle,
    };
  } else if (diffDays <= 30) {
    return {
      status: "warning",
      label: `${diffDays} hari lagi`,
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      textColor: "text-yellow-600",
      icon: Clock,
    };
  }
  return {
    status: "safe",
    label: `${diffDays} hari lagi`,
    color: "bg-green-100 text-green-700 border-green-200",
    textColor: "text-green-600",
    icon: Check,
  };
};

const emptyForm = {
  namaHutang: "",
  jenisHutang: "LAINNYA",
  kreditur: "",
  jumlahPokok: "",
  tanggalMulai: "",
  tanggalJatuhTempo: "",
  keterangan: "",
};

export default function HutangLainPage() {
  const [hutangList, setHutangList] = useState<HutangLain[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("AKTIF");
  const [filterJenis, setFilterJenis] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [stats, setStats] = useState({
    totalSisaHutang: 0,
    totalTransaksi: 0,
    hutangJatuhTempo: 0,
  });

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBayarModal, setShowBayarModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [selectedHutang, setSelectedHutang] = useState<HutangLain | null>(null);
  const [pelunasanHutang, setPelunasanHutang] = useState<HutangLain | null>(null);
  const [jumlahBayar, setJumlahBayar] = useState("");
  const [tanggalBayar, setTanggalBayar] = useState("");
  const [keteranganBayar, setKeteranganBayar] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState(emptyForm);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchTerm]);

  // Infinite scroll observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination?.hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [pagination, loadingMore, loading]);

  useEffect(() => {
    fetchHutang(1, true);
    fetchStats();
  }, [debouncedSearch, filterStatus, filterJenis, startDate, endDate]);

  const buildParams = (page: number) => {
    const p = new URLSearchParams({ page: page.toString(), limit: "20" });
    if (filterStatus !== "all") p.append("status", filterStatus);
    if (filterJenis !== "all") p.append("jenis", filterJenis);
    if (debouncedSearch) p.append("search", debouncedSearch);
    if (startDate) p.append("startDate", startDate);
    if (endDate) p.append("endDate", endDate);
    return p.toString();
  };

  const fetchHutang = async (page = 1, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`/api/hutang-lain?${buildParams(page)}`);
      const data = await res.json();
      if (data.success) {
        if (reset) setHutangList(data.data);
        else setHutangList((prev) => [...prev, ...data.data]);
        setPagination(data.pagination);
      }
    } catch {
      toast.error("Gagal mengambil data");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchStats = async () => {
    try {
      const p = new URLSearchParams({ page: "1", limit: "1000", status: "AKTIF" });
      if (filterJenis !== "all") p.append("jenis", filterJenis);
      if (debouncedSearch) p.append("search", debouncedSearch);
      const res = await fetch(`/api/hutang-lain?${p}`);
      const data = await res.json();
      if (data.success) {
        const list: HutangLain[] = data.data;
        const now = new Date();
        const jatuhTempo = list.filter((h) => {
          if (!h.tanggalJatuhTempo) return false;
          const diff = Math.ceil((new Date(h.tanggalJatuhTempo).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diff <= 7;
        }).length;
        setStats({
          totalSisaHutang: list.reduce((s, h) => s + Math.max(0, h.jumlahPokok - h.jumlahDibayar), 0),
          totalTransaksi: list.length,
          hutangJatuhTempo: jatuhTempo,
        });
      }
    } catch {}
  };

  const loadMore = () => {
    if (pagination?.hasMore && !loadingMore) fetchHutang(pagination.page + 1, false);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStartDate("");
    setEndDate("");
    setFilterStatus("AKTIF");
    setFilterJenis("all");
  };

  const getSisaHutang = (h: HutangLain) => Math.max(0, h.jumlahPokok - h.jumlahDibayar);

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

  const formatInput = (v: string) => {
    const num = v.replace(/\D/g, "");
    if (!num) return "";
    return new Intl.NumberFormat("id-ID").format(parseInt(num));
  };

  const jenisLabel = (j: string) => JENIS_OPTIONS.find((o) => o.value === j)?.label ?? j;

  const hasActiveFilters = searchTerm || startDate || endDate || filterStatus !== "AKTIF" || filterJenis !== "all";

  // ── CRUD handlers ──

  const handleAdd = async () => {
    if (!form.namaHutang || !form.kreditur || !form.jumlahPokok || !form.tanggalMulai) {
      return toast.error("Lengkapi semua field wajib");
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/hutang-lain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, jumlahPokok: parseInt(form.jumlahPokok.replace(/\D/g, "")) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Hutang berhasil ditambahkan");
        setShowAddModal(false);
        setForm(emptyForm);
        fetchHutang(1, true);
        fetchStats();
      } else toast.error(data.error || "Gagal menambahkan");
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setIsSubmitting(false); }
  };

  const openEdit = (h: HutangLain) => {
    setSelectedHutang(h);
    setForm({
      namaHutang: h.namaHutang,
      jenisHutang: h.jenisHutang,
      kreditur: h.kreditur,
      jumlahPokok: h.jumlahPokok.toString(),
      tanggalMulai: h.tanggalMulai.split("T")[0],
      tanggalJatuhTempo: h.tanggalJatuhTempo ? h.tanggalJatuhTempo.split("T")[0] : "",
      keterangan: h.keterangan || "",
    });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedHutang) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/hutang-lain/${selectedHutang.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, jumlahPokok: parseInt(form.jumlahPokok.toString().replace(/\D/g, "")) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Hutang berhasil diperbarui");
        setShowEditModal(false);
        fetchHutang(1, true);
        fetchStats();
      } else toast.error(data.error || "Gagal memperbarui");
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!selectedHutang) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/hutang-lain/${selectedHutang.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Hutang berhasil dihapus");
        setShowDeleteConfirm(false);
        fetchHutang(1, true);
        fetchStats();
      } else toast.error(data.error || "Gagal menghapus");
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setIsSubmitting(false); }
  };

  const handleOpenBayar = (h: HutangLain) => {
    setPelunasanHutang(h);
    setJumlahBayar(getSisaHutang(h).toString());
    setTanggalBayar(new Date().toISOString().split("T")[0]);
    setKeteranganBayar("");
    setShowBayarModal(true);
  };

  const handleBayar = async () => {
    if (!pelunasanHutang || !jumlahBayar) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/hutang-lain/${pelunasanHutang.id}/bayar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jumlahBayar: parseInt(jumlahBayar), tanggalBayar, keterangan: keteranganBayar }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.lunas ? "Hutang berhasil LUNAS!" : "Pembayaran berhasil dicatat");
        setShowBayarModal(false);
        setPelunasanHutang(null);
        setJumlahBayar("");
        fetchHutang(1, true);
        fetchStats();
      } else toast.error(data.error || "Gagal mencatat pembayaran");
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
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-5 mb-6 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/admin/hutang-piutang/hutang-pembelian"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2.5 rounded-lg transition-all shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Hutang Lain-lain</h1>
                <p className="text-blue-100 text-sm">Kelola hutang di luar pembelian barang (kendaraan, bank, peralatan, dll)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setForm(emptyForm); setShowAddModal(true); }}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
              >
                <Plus className="w-4 h-4" />
                Tambah
              </button>
              <button
                onClick={() => { fetchHutang(1, true); fetchStats(); }}
                disabled={loading}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg disabled:opacity-50 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Total Sisa Hutang</p>
                <p className="text-lg font-bold text-red-600">{formatRupiahSimple(stats.totalSisaHutang)}</p>
                <p className="text-[11px] text-gray-500">{formatRupiah(stats.totalSisaHutang)}</p>
              </div>
              <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-2.5 rounded-lg shadow-md">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Hutang Aktif</p>
                <p className="text-xl font-bold text-indigo-700">{stats.totalTransaksi}</p>
                <p className="text-[11px] text-gray-400">Belum lunas</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2.5 rounded-lg shadow-md">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Jatuh Tempo ≤7 Hari</p>
                <p className="text-xl font-bold text-orange-600">{stats.hutangJatuhTempo}</p>
                <p className="text-[11px] text-gray-400">Hutang kritis</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-lg shadow-md">
                <AlertTriangle className="w-5 h-5 text-white" />
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
                className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex gap-3 flex-wrap lg:flex-nowrap">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm bg-white"
              >
                <option value="all">Semua Status</option>
                <option value="AKTIF">Aktif</option>
                <option value="LUNAS">Lunas</option>
              </select>

              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="px-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm bg-white"
              >
                <option value="all">Semua Jenis</option>
                {JENIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm bg-white" />
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm bg-white" />
              </div>

              {hasActiveFilters && (
                <button onClick={handleClearFilters} className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap font-medium">
                  <X className="w-4 h-4" />
                  <span className="hidden xl:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-yellow-700">
              Menampilkan hutang lain-lain (kendaraan, bank, peralatan, dll) yang belum lunas, diurutkan berdasarkan tanggal dibuat terbaru
            </span>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loading && hutangList.length === 0 ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center">
                <div className="relative">
                  <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                  <Receipt className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500 mt-6 text-lg font-medium">Memuat data...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    {["Nama Hutang", "Jenis", "Kreditur", "Pokok", "Sisa Hutang", "Jatuh Tempo", "Status", "Aksi"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {hutangList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Tidak ada data hutang ditemukan</p>
                      </td>
                    </tr>
                  ) : (
                    hutangList.map((h) => {
                      const sisa = getSisaHutang(h);
                      const jtStatus = h.tanggalJatuhTempo && h.status === "AKTIF"
                        ? getJatuhTempoStatus(h.tanggalJatuhTempo)
                        : null;

                      return (
                        <tr
                          key={h.id}
                          className={`hover:bg-gray-50 transition-colors ${
                            jtStatus?.status === "overdue" || jtStatus?.status === "critical" ? "bg-red-50/50" : ""
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-medium text-gray-900 text-sm">{h.namaHutang}</p>
                            {h.keterangan && <p className="text-xs text-gray-400 max-w-[160px] truncate">{h.keterangan}</p>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-medium">
                              {jenisLabel(h.jenisHutang)}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{h.kreditur}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{formatRupiah(h.jumlahPokok)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {sisa > 0 ? (
                              <span className="text-sm font-medium text-red-600">{formatRupiah(sisa)}</span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {h.tanggalJatuhTempo ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-gray-600">{formatDate(h.tanggalJatuhTempo)}</span>
                                {jtStatus && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${jtStatus.color}`}>
                                    <jtStatus.icon className="w-3 h-3" />
                                    {jtStatus.label}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium inline-block ${
                              h.status === "LUNAS" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {h.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => { setSelectedHutang(h); setShowDetailModal(true); }}
                                className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all" title="Detail">
                                <Eye className="w-4 h-4" />
                              </button>
                              {h.status === "AKTIF" && (
                                <>
                                  <button onClick={() => handleOpenBayar(h)}
                                    className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all" title="Bayar">
                                    <Banknote className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => openEdit(h)}
                                    className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-all" title="Edit">
                                    <Edit className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              <button onClick={() => { setSelectedHutang(h); setShowDeleteConfirm(true); }}
                                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all" title="Hapus">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {loadingMore && (
            <div className="flex justify-center items-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          )}
        </div>

        <div ref={loadMoreRef} className="h-10" />
      </div>

      {/* ══ Modal Detail ══ */}
      {showDetailModal && selectedHutang && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Detail Hutang</h2>
              <button onClick={() => setShowDetailModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-gray-500">Nama Hutang</p><p className="font-semibold">{selectedHutang.namaHutang}</p></div>
                  <div><p className="text-sm text-gray-500">Jenis</p><p className="font-semibold">{jenisLabel(selectedHutang.jenisHutang)}</p></div>
                  <div><p className="text-sm text-gray-500">Kreditur</p><p className="font-semibold">{selectedHutang.kreditur}</p></div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`px-2 py-1 rounded text-xs font-medium mt-1 inline-block ${selectedHutang.status === "LUNAS" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {selectedHutang.status}
                    </span>
                  </div>
                  <div><p className="text-sm text-gray-500">Tanggal Mulai</p><p className="font-semibold">{formatDate(selectedHutang.tanggalMulai)}</p></div>
                  {selectedHutang.tanggalJatuhTempo && (
                    <div>
                      <p className="text-sm text-gray-500">Jatuh Tempo</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="font-semibold">{formatDate(selectedHutang.tanggalJatuhTempo)}</p>
                        {selectedHutang.status === "AKTIF" && (() => {
                          const st = getJatuhTempoStatus(selectedHutang.tanggalJatuhTempo!);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>
                              <st.icon className="w-3 h-3" />{st.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  {selectedHutang.keterangan && (
                    <div className="col-span-2"><p className="text-sm text-gray-500">Keterangan</p><p className="font-semibold">{selectedHutang.keterangan}</p></div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-4">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Jumlah Pokok</span><span>{formatRupiah(selectedHutang.jumlahPokok)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Sudah Dibayar</span><span className="text-green-600">{formatRupiah(selectedHutang.jumlahDibayar)}</span></div>
                {getSisaHutang(selectedHutang) > 0 && (
                  <div className="flex justify-between text-sm text-red-600 font-medium border-t pt-2">
                    <span>Sisa Hutang</span><span>{formatRupiah(getSisaHutang(selectedHutang))}</span>
                  </div>
                )}
                {selectedHutang.jumlahPokok > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{Math.min(100, Math.round((selectedHutang.jumlahDibayar / selectedHutang.jumlahPokok) * 100))}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, (selectedHutang.jumlahDibayar / selectedHutang.jumlahPokok) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Riwayat */}
              {selectedHutang.pembayaran?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-1">
                    <CalendarClock className="w-4 h-4" /> Riwayat Pembayaran
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Tanggal</th>
                          <th className="px-3 py-2 text-right">Jumlah</th>
                          <th className="px-3 py-2 text-left">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedHutang.pembayaran.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2">{formatDate(p.tanggalBayar)}</td>
                            <td className="px-3 py-2 text-right font-medium text-green-600">{formatRupiah(p.jumlahBayar)}</td>
                            <td className="px-3 py-2 text-gray-500">{p.keterangan || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedHutang.status === "AKTIF" && (
                <button
                  onClick={() => { setShowDetailModal(false); handleOpenBayar(selectedHutang); }}
                  className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Banknote className="w-5 h-5" /> Bayar Hutang
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Bayar ══ */}
      {showBayarModal && pelunasanHutang && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBayarModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 rounded-t-xl flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Pembayaran Hutang</h2>
              <button onClick={() => setShowBayarModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Nama Hutang</span><span className="font-medium">{pelunasanHutang.namaHutang}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Kreditur</span><span>{pelunasanHutang.kreditur}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Total Pokok</span><span>{formatRupiah(pelunasanHutang.jumlahPokok)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Sudah Dibayar</span><span>{formatRupiah(pelunasanHutang.jumlahDibayar)}</span></div>
                <div className="flex justify-between font-bold text-red-600 border-t pt-2">
                  <span>Sisa Hutang</span><span>{formatRupiah(getSisaHutang(pelunasanHutang))}</span>
                </div>
                {pelunasanHutang.tanggalJatuhTempo && (() => {
                  const st = getJatuhTempoStatus(pelunasanHutang.tanggalJatuhTempo!);
                  return (
                    <div className="flex justify-between items-center text-sm border-t pt-2">
                      <span className="text-gray-500">Jatuh Tempo</span>
                      <div className="flex items-center gap-2">
                        <span>{formatDate(pelunasanHutang.tanggalJatuhTempo)}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>
                          <st.icon className="w-3 h-3" />{st.label}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Jumlah Pembayaran <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={jumlahBayar}
                  onChange={(e) => setJumlahBayar(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-lg"
                  placeholder="Masukkan jumlah pembayaran"
                />
              </div>

              <div className="flex gap-2 flex-wrap mb-4">
                <button onClick={() => setJumlahBayar(getSisaHutang(pelunasanHutang).toString())}
                  className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded text-sm hover:bg-emerald-200">
                  Lunasi Semua
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Bayar</label>
                <input type="date" value={tanggalBayar} onChange={(e) => setTanggalBayar(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none" />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan</label>
                <input type="text" value={keteranganBayar} onChange={(e) => setKeteranganBayar(e.target.value)}
                  placeholder="Opsional" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none" />
              </div>

              {jumlahBayar && parseInt(jumlahBayar) > 0 && (
                <div className={`rounded-lg p-4 mb-4 ${parseInt(jumlahBayar) >= getSisaHutang(pelunasanHutang) ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
                  {parseInt(jumlahBayar) >= getSisaHutang(pelunasanHutang) ? (
                    <div className="flex items-center gap-2 text-green-700 font-medium"><Check className="w-5 h-5" /> Hutang akan LUNAS</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-yellow-700 font-medium"><Clock className="w-5 h-5" /> Pembayaran Sebagian</div>
                      <p className="text-yellow-600 mt-1 text-sm">Sisa: {formatRupiah(getSisaHutang(pelunasanHutang) - parseInt(jumlahBayar))}</p>
                    </>
                  )}
                </div>
              )}

              <button onClick={handleBayar} disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                Simpan Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Tambah ══ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Tambah Hutang Baru</h2>
              <button onClick={() => setShowAddModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
              <FormFields form={form} setForm={setForm} formatInput={formatInput} />
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Batal</button>
              <button onClick={handleAdd} disabled={isSubmitting} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Edit ══ */}
      {showEditModal && selectedHutang && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Edit Hutang</h2>
              <button onClick={() => setShowEditModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
              <FormFields form={form} setForm={setForm} formatInput={formatInput} />
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Batal</button>
              <button onClick={handleEdit} disabled={isSubmitting} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Perbarui
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Confirm Delete ══ */}
      {showDeleteConfirm && selectedHutang && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-2">Hapus Hutang?</h2>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">{selectedHutang.namaHutang}</span> akan dihapus permanen. Hutang yang sudah memiliki riwayat pembayaran tidak bisa dihapus.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Batal</button>
              <button onClick={handleDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormFields({ form, setForm, formatInput }: { form: any; setForm: any; formatInput: (v: string) => string }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Hutang <span className="text-red-500">*</span></label>
        <input type="text" value={form.namaHutang} onChange={(e) => setForm((f: any) => ({ ...f, namaHutang: e.target.value }))}
          placeholder="cth: Kredit Mobil Pickup" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Jenis Hutang <span className="text-red-500">*</span></label>
        <select value={form.jenisHutang} onChange={(e) => setForm((f: any) => ({ ...f, jenisHutang: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-white">
          {[{ value: "KENDARAAN", label: "Kendaraan" }, { value: "BANK", label: "Bank / KUR" }, { value: "PERALATAN", label: "Peralatan" }, { value: "BANGUNAN", label: "Bangunan / KPR" }, { value: "LAINNYA", label: "Lainnya" }].map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Kreditur <span className="text-red-500">*</span></label>
        <input type="text" value={form.kreditur} onChange={(e) => setForm((f: any) => ({ ...f, kreditur: e.target.value }))}
          placeholder="cth: Bank BRI, Leasing ABC" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Jumlah Pokok <span className="text-red-500">*</span></label>
        <input type="text" value={form.jumlahPokok ? formatInput(form.jumlahPokok.toString()) : ""}
          onChange={(e) => setForm((f: any) => ({ ...f, jumlahPokok: e.target.value.replace(/\D/g, "") }))}
          placeholder="Rp 0" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Mulai <span className="text-red-500">*</span></label>
          <input type="date" value={form.tanggalMulai} onChange={(e) => setForm((f: any) => ({ ...f, tanggalMulai: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Jatuh Tempo <span className="text-gray-400 font-normal">(opsional)</span></label>
          <input type="date" value={form.tanggalJatuhTempo} onChange={(e) => setForm((f: any) => ({ ...f, tanggalJatuhTempo: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan <span className="text-gray-400 font-normal">(opsional)</span></label>
        <textarea value={form.keterangan} onChange={(e) => setForm((f: any) => ({ ...f, keterangan: e.target.value }))}
          placeholder="Catatan tambahan..." rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none resize-none" />
      </div>
    </div>
  );
}
