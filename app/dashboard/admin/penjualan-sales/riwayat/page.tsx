"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Receipt,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  ArrowLeft,
  Eye,
  Calendar,
  AlertTriangle,
  Building2,
  Package,
  Banknote,
  CreditCard,
  Loader2,
  Clock,
  Pencil,
  Trash2,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface Customer {
  id: number;
  nik: string;
  nama: string;
  alamat: string;
  namaToko: string;
  noHp: string;
  limit_piutang: number;
  piutang: number;
}

interface Karyawan {
  id: number;
  nik: string;
  nama: string;
  alamat: string;
  noHp: string;
  jenis: "SALES" | "KASIR";
}

interface Barang {
  id: number;
  namaBarang: string;
  hargaBeli: number;
  hargaJual: number;
  stok: number;
  jumlahPerKemasan: number;
  jenisKemasan?: string;
  ukuran: number;
  satuan: string;
}

interface PenjualanItem {
  id: number;
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  totalItem?: number;
  hargaJual: number;
  diskonPerItem: number;
  barang: Barang;
}

interface PerjalananSales {
  id: number;
  kodePerjalanan: string;
  karyawanId: number;
  kotaTujuan: string;
  tanggalBerangkat: string;
  tanggalKembali: string | null;
  statusPerjalanan: string;
  keterangan: string | null;
  karyawan: Karyawan;
}

interface PenjualanHeader {
  id: number;
  kodePenjualan: string;
  customerId: number | null;
  namaCustomer: string | null;
  karyawanId: number | null;
  namaSales: string | null;
  rutePengiriman: string | null;
  subtotal: number;
  diskonNota: number;
  totalHarga: number;
  jumlahDibayar: number;
  kembalian: number;
  metodePembayaran: "CASH" | "TRANSFER";
  statusPembayaran: "LUNAS" | "HUTANG";
  statusTransaksi: "KERANJANG" | "SELESAI" | "DIBATALKAN";
  isDeleted: boolean;
  tanggalTransaksi: string;
  tanggalJatuhTempo: string;
  customer: Customer | null;
  karyawan: Karyawan | null;
  perjalananSales: PerjalananSales | null;
  perjalananSalesId: number | null;
  items: PenjualanItem[];
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

// Helper function untuk menghitung status jatuh tempo
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
      bgColor: "bg-red-50",
      textColor: "text-red-600",
      icon: AlertTriangle,
    };
  } else if (diffDays <= 7) {
    return {
      status: "critical",
      label: diffDays === 0 ? "Hari ini" : `${diffDays} hari lagi`,
      color: "bg-red-100 text-red-700 border-red-200",
      bgColor: "bg-red-50",
      textColor: "text-red-600",
      icon: AlertTriangle,
    };
  } else if (diffDays <= 30) {
    return {
      status: "warning",
      label: `${diffDays} hari lagi`,
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      bgColor: "bg-yellow-50",
      textColor: "text-yellow-600",
      icon: Clock,
    };
  } else {
    return {
      status: "safe",
      label: `${diffDays} hari lagi`,
      color: "bg-green-100 text-green-700 border-green-200",
      bgColor: "bg-green-50",
      textColor: "text-green-600",
      icon: Check,
    };
  }
};

const RiwayatPenjualanPage = () => {
  // Data state
  const [penjualanList, setPenjualanList] = useState<PenjualanHeader[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedPenjualan, setSelectedPenjualan] =
    useState<PenjualanHeader | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<PenjualanHeader | null>(
    null
  );

  // Statistik
  const [stats, setStats] = useState({
    totalTransaksi: 0,
    totalPendapatan: 0,
    totalHutang: 0,
    totalHutangTransaksi: 0,
    totalLunas: 0,
    hutangJatuhTempo: 0,
  });

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Fetch data & stats when filters change
  useEffect(() => {
    fetchPenjualan(1, true);
    fetchStats();
  }, [startDate, endDate, debouncedSearch]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          pagination?.hasMore &&
          !loadingMore &&
          !loading
        ) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [pagination, loadingMore, loading]);

  const buildQueryParams = (page: number) => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", "20");

    // Only include status SELESAI for sales history
    params.append("status", "SELESAI");

    if (debouncedSearch) {
      params.append("search", debouncedSearch);
    }

    if (startDate) {
      params.append("startDate", startDate);
    }

    if (endDate) {
      params.append("endDate", endDate);
    }

    return params.toString();
  };

  const fetchPenjualan = async (page: number = 1, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const queryParams = buildQueryParams(page);
      const res = await fetch(`/api/penjualan-sales?${queryParams}`);
      const data = await res.json();

      if (data.success) {
        if (reset) {
          setPenjualanList(data.data);
        } else {
          setPenjualanList((prev) => [...prev, ...data.data]);
        }
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching penjualan sales:", error);
      toast.error("Gagal mengambil data penjualan sales");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      params.append("status", "SELESAI");
      params.append("limit", "1000");
      params.append("summary", "1");
      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }
      if (startDate) {
        params.append("startDate", startDate);
      }
      if (endDate) {
        params.append("endDate", endDate);
      }
      const selesaiRes = await fetch(
        `/api/penjualan-sales?${params.toString()}`
      );
      const selesaiData = await selesaiRes.json();

      if (selesaiData.success) {
        const summary = selesaiData.summary;
        if (summary) {
          setStats({
            totalTransaksi: summary.totalTransaksi || 0,
            totalPendapatan: summary.totalPembayaran || 0,
            totalHutang: summary.totalHutang || 0,
            totalHutangTransaksi: summary.totalHutangTransaksi || 0,
            totalLunas: summary.totalLunas || 0,
            hutangJatuhTempo: summary.hutangJatuhTempo || 0,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const loadMore = () => {
    if (pagination && pagination.hasMore && !loadingMore) {
      fetchPenjualan(pagination.page + 1, false);
    }
  };

  const handleRefresh = () => {
    fetchPenjualan(1, true);
    fetchStats();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStartDate("");
    setEndDate("");
  };

  const handleViewDetail = (penjualan: PenjualanHeader) => {
    setSelectedPenjualan(penjualan);
    setShowDetailModal(true);
  };

  const handleOpenDeleteModal = (penjualan: PenjualanHeader) => {
    setDeleteTarget(penjualan);
    setShowDeleteModal(true);
  };

  const handleSoftDelete = async (penjualanId: number) => {
    try {
      const res = await fetch(`/api/penjualan/${penjualanId}/soft-delete`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Penjualan berhasil dihapus");
        setShowDeleteModal(false);
        setDeleteTarget(null);
        fetchPenjualan(1, true);
        fetchStats();
      } else {
        toast.error(data.error || "Gagal menghapus penjualan");
      }
    } catch (error) {
      console.error("Error deleting penjualan:", error);
      toast.error("Terjadi kesalahan saat menghapus penjualan");
    }
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatRupiahSimple = (amount: number): string => {
    const absAmount = Math.abs(amount);
    if (absAmount >= 1_000_000_000) {
      return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
    } else if (absAmount >= 1_000_000) {
      return `Rp ${(amount / 1_000_000).toFixed(1)}Jt`;
    } else if (absAmount >= 1_000) {
      return `Rp ${(amount / 1_000).toFixed(0)}Rb`;
    }
    return `Rp ${amount}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getSisaHutang = (penjualan: PenjualanHeader): number => {
    return penjualan.totalHarga - penjualan.jumlahDibayar;
  };

  const getCustomerName = (penjualan: PenjualanHeader): string => {
    if (penjualan.customer) {
      return penjualan.customer.nama;
    }
    if (penjualan.karyawan) {
      return penjualan.karyawan.nama;
    }
    return penjualan.namaCustomer || penjualan.namaSales || "-";
  };

  const getSalesName = (penjualan: PenjualanHeader): string => {
    if (penjualan.karyawan) {
      return penjualan.karyawan.nama;
    }
    return penjualan.namaSales || "-";
  };

  const hasActiveFilters = startDate || endDate || debouncedSearch;

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

        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-5 mb-6 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/admin/penjualan"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2.5 rounded-lg transition-all shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Riwayat Penjualan Sales
                </h1>
                <p className="text-blue-100 text-sm">
                  Lihat riwayat transaksi penjualan oleh sales
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg disabled:opacity-50 text-sm"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Total Transaksi
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {stats.totalTransaksi}
                </p>
                <p className="text-[11px] text-gray-400">Transaksi selesai</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-lg shadow-md">
                <Receipt className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Total Pendapatan
                </p>
                <p className="text-lg font-bold text-indigo-700">
                  {formatRupiahSimple(stats.totalPendapatan)}
                </p>
                <p className="text-[11px] text-gray-400">Semua penjualan</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-lg shadow-md">
                <Banknote className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Total Piutang
                </p>
                <p className="text-lg font-bold text-red-600">
                  {formatRupiahSimple(stats.totalHutang)}
                </p>
                <p className="text-[11px] text-gray-400">Belum lunas</p>
              </div>
              <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-2.5 rounded-lg shadow-md">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Jatuh Tempo ≤7 Hari
                </p>
                <p className="text-xl font-bold text-orange-600">
                  {stats.hutangJatuhTempo}
                </p>
                <p className="text-[11px] text-gray-400">Piutang kritis</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-lg shadow-md">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Lunas
                </p>
                <p className="text-xl font-bold text-green-600">
                  {stats.totalLunas}
                </p>
                <p className="text-[11px] text-gray-400">Transaksi lunas</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-2.5 rounded-lg shadow-md">
                <Check className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Piutang
                </p>
                <p className="text-xl font-bold text-indigo-700">
                  {stats.totalHutangTransaksi}
                </p>
                <p className="text-[11px] text-gray-400">Belum lunas</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2.5 rounded-lg shadow-md">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search - Only Date Filters */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari kode penjualan, nama sales, atau karyawan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Date Filters Only */}
            <div className="flex gap-3 flex-wrap lg:flex-nowrap">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Tanggal Mulai"
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm bg-white"
                />
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Tanggal Akhir"
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm bg-white"
                />
              </div>

              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap font-medium"
                  title="Reset semua filter"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden xl:inline">Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loading && penjualanList.length === 0 ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center">
                <div className="relative">
                  <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                  <Receipt className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500 mt-6 text-lg font-medium">
                  Memuat data penjualan...
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Kode
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Sales
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>

                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {penjualanList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Tidak ada data penjualan ditemukan</p>
                      </td>
                    </tr>
                  ) : (
                    penjualanList.map((pj) => {
                      const jatuhTempoStatus =
                        pj.statusPembayaran === "HUTANG" && pj.tanggalJatuhTempo
                          ? getJatuhTempoStatus(pj.tanggalJatuhTempo)
                          : null;

                      return (
                        <tr
                          key={pj.id}
                          className={`hover:bg-gray-50 transition-colors ${
                            jatuhTempoStatus?.status === "overdue" ||
                            jatuhTempoStatus?.status === "critical"
                              ? "bg-red-50/50"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 text-sm">
                                {pj.kodePenjualan}
                              </p>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  pj.metodePembayaran === "CASH"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-purple-100 text-purple-700"
                                }`}
                              >
                                {pj.metodePembayaran}
                              </span>
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-sm font-medium text-gray-900">
                              {getCustomerName(pj)}
                            </p>
                            {/* Jika ada nama toko, tampilkan */}
                            {pj.customer?.namaToko && (
                              <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium">
                                {pj.customer.namaToko}
                              </span>
                            )}
                          </td>

                          {/* Sales */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-sm font-medium text-gray-900">
                              {getSalesName(pj)}
                            </p>
                            {pj.karyawan?.noHp && (
                              <p className="text-xs text-blue-600 mt-0.5">
                                {pj.karyawan.noHp}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(pj.tanggalTransaksi)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatRupiah(pj.totalHarga)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`text-xs px-2 py-1 mr-2 rounded font-medium ${
                                pj.statusPembayaran === "HUTANG"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {pj.statusPembayaran === "HUTANG"
                                ? "PIUTANG"
                                : pj.statusPembayaran}
                            </span>
                            {pj.isDeleted && (
                              <span className="text-xs px-2 py-1 rounded font-medium bg-red-100 text-red-700">
                                DELETED
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleViewDetail(pj)}
                                className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
                                title="Lihat Detail"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {pj.statusTransaksi === "SELESAI" && (
                                <>
                                  <button
                                    onClick={() => handleOpenDeleteModal(pj)}
                                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                                    title="Hapus Penjualan"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  <Link
                                    href={`/dashboard/admin/penjualan-sales?editId=${pj.id}`}
                                    className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all"
                                    title="Edit Penjualan"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Link>
                                </>
                              )}
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

          {/* Infinite Scroll Loader */}
          <div ref={loadMoreRef} className="py-4">
            {loadingMore && (
              <div className="flex justify-center items-center gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Memuat lebih banyak...</span>
              </div>
            )}
          </div>
        </div>

        {/* Pagination Info */}
        <div className="mt-4 text-center text-sm text-gray-500">
          {pagination && (
            <span>
              Menampilkan {penjualanList.length} dari {pagination.totalCount}{" "}
              transaksi
              {pagination.hasMore &&
                " • Scroll ke bawah untuk memuat lebih banyak"}
            </span>
          )}
        </div>

        {/* Modal Detail */}
        {showDetailModal && selectedPenjualan && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  Detail Penjualan
                </h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                {/* Info Header */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Kode Penjualan</p>
                      <p className="font-semibold">
                        {selectedPenjualan.kodePenjualan}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Tanggal</p>
                      <p className="font-semibold">
                        {new Date(
                          selectedPenjualan.tanggalTransaksi
                        ).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Customer</p>
                      <p className="font-semibold">
                        {getCustomerName(selectedPenjualan)}
                      </p>
                      {selectedPenjualan.customer?.namaToko && (
                        <p className="text-sm text-gray-500">
                          <Building2 className="w-3 h-3 inline mr-1" />
                          {selectedPenjualan.customer.namaToko}
                        </p>
                      )}
                      {selectedPenjualan.customer && (
                        <div className="mt-1 text-xs">
                          <span className="text-gray-500">Piutang: </span>
                          <span
                            className={
                              selectedPenjualan.customer.piutang > 0
                                ? "text-red-600 font-medium"
                                : "text-green-600"
                            }
                          >
                            {formatRupiah(selectedPenjualan.customer.piutang)}
                          </span>
                          <span className="text-gray-400">
                            {" "}
                            /{" "}
                            {formatRupiah(
                              selectedPenjualan.customer.limit_piutang
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            selectedPenjualan.statusTransaksi === "SELESAI"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {selectedPenjualan.statusTransaksi}
                        </span>
                        {selectedPenjualan.statusTransaksi === "SELESAI" && (
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              selectedPenjualan.statusPembayaran === "LUNAS"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {selectedPenjualan.statusPembayaran === "HUTANG"
                              ? "PIUTANG"
                              : selectedPenjualan.statusPembayaran}
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            selectedPenjualan.metodePembayaran === "CASH"
                              ? "bg-green-100 text-green-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {selectedPenjualan.metodePembayaran}
                        </span>
                      </div>
                    </div>
                    {/* Tanggal Jatuh Tempo */}
                    {selectedPenjualan.statusPembayaran === "HUTANG" &&
                      selectedPenjualan.tanggalJatuhTempo && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500">
                            Tanggal Jatuh Tempo
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="font-semibold">
                              {formatDate(selectedPenjualan.tanggalJatuhTempo)}
                            </p>
                            {(() => {
                              const status = getJatuhTempoStatus(
                                selectedPenjualan.tanggalJatuhTempo
                              );
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${status.color}`}
                                >
                                  <status.icon className="w-3 h-3" />
                                  {status.label}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                {/* Items */}
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Daftar Barangggg
                </h3>
                <div className="border rounded-lg overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Barang</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-right">Harga</th>
                        <th className="px-3 py-2 text-right">Diskon</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedPenjualan.items?.map((item) => {
                        const jumlahPerKemasan =
                          item.barang?.jumlahPerKemasan || 1;
                        const labelKemasan = item.barang?.jenisKemasan || "dus";
                        const totalItem =
                          item.totalItem ??
                          item.jumlahDus * jumlahPerKemasan + item.jumlahPcs;
                        const jumlahDus = Math.floor(
                          totalItem / jumlahPerKemasan
                        );
                        const jumlahPcs = totalItem % jumlahPerKemasan;

                        const hargaPcs =
                          jumlahPcs > 0
                            ? Math.round(
                                (item.hargaJual / jumlahPerKemasan) * jumlahPcs
                              )
                            : 0;
                        const subtotal =
                          item.hargaJual * jumlahDus +
                          hargaPcs -
                          item.diskonPerItem * jumlahDus;

                        return (
                          <tr key={item.id}>
                            <td className="px-3 py-2">
                              <p className="font-medium">
                                {item.barang?.namaBarang}
                              </p>
                              <p className="text-xs text-gray-500">
                                {jumlahPerKemasan} pcs/{labelKemasan}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {jumlahDus > 0 && (
                                <span className="block">
                                  {jumlahDus} {labelKemasan}
                                </span>
                              )}
                              {jumlahPcs > 0 && (
                                <span className="block text-gray-500">
                                  +{jumlahPcs} pcs
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatRupiah(item.hargaJual)}/{labelKemasan}
                            </td>
                            <td className="px-3 py-2 text-right text-red-500">
                              {item.diskonPerItem > 0
                                ? `-${formatRupiah(
                                    item.diskonPerItem * jumlahDus
                                  )}`
                                : "-"}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatRupiah(subtotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatRupiah(selectedPenjualan.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Diskon Nota</span>
                    <span className="text-red-500">
                      -{formatRupiah(selectedPenjualan.diskonNota)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>{formatRupiah(selectedPenjualan.totalHarga)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Dibayar</span>
                    <span>{formatRupiah(selectedPenjualan.jumlahDibayar)}</span>
                  </div>
                  {selectedPenjualan.kembalian > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Kembalian</span>
                      <span>{formatRupiah(selectedPenjualan.kembalian)}</span>
                    </div>
                  )}
                  {getSisaHutang(selectedPenjualan) > 0 && (
                    <div className="flex justify-between text-sm text-red-600 font-medium">
                      <span>Sisa Piutang</span>
                      <span>
                        {formatRupiah(getSisaHutang(selectedPenjualan))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tombol Cetak */}
                <div className="mt-6">
                  <button
                    onClick={() => {
                      window.open(
                        `/api/penjualan/${selectedPenjualan.id}/print-receipt`,
                        "_blank"
                      );
                    }}
                    className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 hover:from-green-700 hover:via-emerald-700 hover:to-green-800 text-white py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <Receipt className="w-5 h-5" />
                    CETAK NOTA
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && deleteTarget && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowDeleteModal(false);
              setDeleteTarget(null);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <h3 className="text-lg font-bold text-gray-900">
                  Hapus Penjualan
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  Yakin ingin menghapus penjualan{" "}
                  <span className="font-semibold">
                    {deleteTarget.kodePenjualan}
                  </span>
                  ?
                </p>
              </div>
              <div className="p-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteTarget(null);
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-medium transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleSoftDelete(deleteTarget.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium transition-all"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiwayatPenjualanPage;
