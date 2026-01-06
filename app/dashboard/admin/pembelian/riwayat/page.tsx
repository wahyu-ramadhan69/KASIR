"use client";
import { useState, useEffect, useRef } from "react";
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
  Loader2,
  Clock,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface Supplier {
  id: number;
  namaSupplier: string;
  alamat: string;
  noHp: string;
  limitHutang: number;
  hutang: number;
}

interface Barang {
  id: number;
  namaBarang: string;
  hargaBeli: number;
  hargaJual: number;
  stok: number;
  jumlahPerKemasan: number;
  ukuran: number;
  satuan: string;
}

interface PembelianItem {
  id: number;
  barangId: number;
  jumlahDus: number;
  hargaPokok: number;
  diskonPerItem: number;
  barang: Barang;
}

interface PembelianHeader {
  id: number;
  kodePembelian: string;
  supplierId: number;
  subtotal: number;
  diskonNota: number;
  totalHarga: number;
  jumlahDibayar: number;
  kembalian: number;
  statusPembayaran: "LUNAS" | "HUTANG";
  statusTransaksi: "KERANJANG" | "SELESAI" | "DIBATALKAN";
  supplier: Supplier;
  items: PembelianItem[];
  createdAt: string;
  updatedAt: string;
  tanggalJatuhTempo: string;
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
    // Sudah lewat jatuh tempo
    return {
      status: "overdue",
      label: `Terlambat ${Math.abs(diffDays)} hari`,
      color: "bg-red-100 text-red-700 border-red-200",
      bgColor: "bg-red-50",
      textColor: "text-red-600",
      icon: AlertTriangle,
    };
  } else if (diffDays <= 7) {
    // Kurang dari 1 minggu
    return {
      status: "critical",
      label: diffDays === 0 ? "Hari ini" : `${diffDays} hari lagi`,
      color: "bg-red-100 text-red-700 border-red-200",
      bgColor: "bg-red-50",
      textColor: "text-red-600",
      icon: AlertTriangle,
    };
  } else if (diffDays <= 30) {
    // Kurang dari 1 bulan
    return {
      status: "warning",
      label: `${diffDays} hari lagi`,
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      bgColor: "bg-yellow-50",
      textColor: "text-yellow-600",
      icon: Clock,
    };
  } else {
    // Lebih dari 1 bulan
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

const RiwayatPembelianPage = () => {
  // Data state
  const [pembelianList, setPembelianList] = useState<PembelianHeader[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const todayDate = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState<string>(todayDate);
  const [endDate, setEndDate] = useState<string>(todayDate);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedPembelian, setSelectedPembelian] =
    useState<PembelianHeader | null>(null);

  // Statistik
  const [stats, setStats] = useState({
    totalTransaksi: 0,
    totalHutang: 0,
    totalLunas: 0,
    totalDibatalkan: 0,
    hutangJatuhTempo: 0, // Hutang yang akan jatuh tempo dalam 7 hari
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
    fetchPembelian(1, true);
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

    // Search filter
    if (debouncedSearch) {
      params.append("search", debouncedSearch);
    }

    // Date range filter
    if (startDate) {
      params.append("startDate", startDate);
    }

    if (endDate) {
      params.append("endDate", endDate);
    }

    return params.toString();
  };

  const buildStatsQueryParams = (status: "SELESAI" | "DIBATALKAN") => {
    const params = new URLSearchParams();
    params.append("status", status);
    params.append("limit", "1000");

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

  const fetchPembelian = async (page: number = 1, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const queryParams = buildQueryParams(page);
      const res = await fetch(`/api/pembelian?${queryParams}`);
      const data = await res.json();

      if (data.success) {
        const filtered = data.data.filter(
          (p: PembelianHeader) =>
            p.statusTransaksi === "SELESAI" ||
            p.statusTransaksi === "DIBATALKAN"
        );

        if (reset) {
          setPembelianList(filtered);
        } else {
          setPembelianList((prev) => [...prev, ...filtered]);
        }
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching pembelian:", error);
      toast.error("Gagal mengambil data pembelian");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Fetch stats for SELESAI transactions
      const selesaiRes = await fetch(
        `/api/pembelian?${buildStatsQueryParams("SELESAI")}`
      );
      const selesaiData = await selesaiRes.json();

      // Fetch stats for DIBATALKAN transactions
      const dibatalkanRes = await fetch(
        `/api/pembelian?${buildStatsQueryParams("DIBATALKAN")}`
      );
      const dibatalkanData = await dibatalkanRes.json();

      if (selesaiData.success && dibatalkanData.success) {
        const selesaiList = selesaiData.data as PembelianHeader[];
        const dibatalkanList = dibatalkanData.data as PembelianHeader[];

        const hutangList = selesaiList.filter(
          (p) => p.statusPembayaran === "HUTANG"
        );

        const totalHutang = hutangList.reduce(
          (sum, p) => sum + (p.totalHarga - p.jumlahDibayar),
          0
        );

        // Hitung hutang yang akan jatuh tempo dalam 7 hari
        const now = new Date();
        const hutangJatuhTempo = hutangList.filter((p) => {
          const jatuhTempo = new Date(p.tanggalJatuhTempo);
          const diffTime = jatuhTempo.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays <= 7;
        }).length;

        const totalLunas = selesaiList.filter(
          (p) => p.statusPembayaran === "LUNAS"
        ).length;

        setStats({
          totalTransaksi: selesaiList.length,
          totalHutang,
          totalLunas,
          totalDibatalkan: dibatalkanList.length,
          hutangJatuhTempo,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const loadMore = () => {
    if (pagination && pagination.hasMore && !loadingMore) {
      fetchPembelian(pagination.page + 1, false);
    }
  };

  const handleRefresh = () => {
    fetchPembelian(1, true);
    fetchStats();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStartDate(todayDate);
    setEndDate(todayDate);
  };

  const handleViewDetail = (pembelian: PembelianHeader) => {
    setSelectedPembelian(pembelian);
    setShowDetailModal(true);
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatShortRupiah = (value: number): string => {
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    const formatShort = (num: number, suffix: string) => {
      const rounded = num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
      return `${sign}${rounded} ${suffix}`;
    };

    if (abs >= 1_000_000_000) return formatShort(abs / 1_000_000_000, "M");
    if (abs >= 1_000_000) return formatShort(abs / 1_000_000, "jt");
    if (abs >= 1_000) return formatShort(abs / 1_000, "rb");
    return `${value}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getSisaHutang = (pembelian: PembelianHeader): number => {
    return pembelian.totalHarga - pembelian.jumlahDibayar;
  };

  const hasActiveFilters =
    debouncedSearch || startDate !== todayDate || endDate !== todayDate;

  return (
    <div className="w-full max-w-7xl mx-auto">
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
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/admin/pembelian"
              className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Riwayat Pembelian
              </h1>
              <p className="text-emerald-100">
                Lihat riwayat dan kelola pembayaran hutang
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="bg-white hover:bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md disabled:opacity-50"
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">
                Total Transaksi
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalTransaksi}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Receipt className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Hutang</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatShortRupiah(stats.totalHutang)}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        {/* New: Hutang Jatuh Tempo */}
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">
                Jatuh Tempo ≤7 Hari
              </p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {stats.hutangJatuhTempo}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Lunas</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {stats.totalLunas}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Check className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Dibatalkan</p>
              <p className="text-2xl font-bold text-gray-600 mt-1">
                {stats.totalDibatalkan}
              </p>
            </div>
            <div className="bg-gray-100 p-3 rounded-lg">
              <X className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-md border border-gray-100">
        <div className="flex flex-col gap-4">
          {/* Row 1: Search and Date Range */}
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari kode pembelian atau supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
              />
            </div>
            <div className="w-full md:max-w-[220px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
              />
            </div>
            <div className="w-full md:max-w-[220px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Tanggal Akhir
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Reset Filter
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
        {loading && pembelianList.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Kode Pembelian
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pembelianList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Tidak ada data pembelian ditemukan</p>
                    </td>
                  </tr>
                ) : (
                  pembelianList.map((pb) => {
                    const sisaLimit =
                      (pb.supplier?.limitHutang || 0) -
                      (pb.supplier?.hutang || 0);

                    return (
                      <tr
                        key={pb.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="font-medium text-gray-900">
                            {pb.kodePembelian}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-800">
                              {pb.supplier?.namaSupplier || "-"}
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {pb.supplier?.noHp && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  {pb.supplier.noHp}
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  sisaLimit > 0
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                              >
                                Sisa Limit: {formatShortRupiah(sisaLimit)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(pb.createdAt).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatShortRupiah(pb.totalHarga)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-1">
                            {pb.statusTransaksi === "SELESAI" && (
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  pb.statusPembayaran === "LUNAS"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {pb.statusPembayaran}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleViewDetail(pb)}
                              className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
                              title="Lihat Detail"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {pb.statusTransaksi === "SELESAI" && (
                              <Link
                                href={`/dashboard/admin/pembelian?editId=${pb.id}`}
                                className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all"
                                title="Edit Pembelian"
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
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
            Menampilkan {pembelianList.length} dari {pagination.totalCount}{" "}
            transaksi
            {pagination.hasMore &&
              " • Scroll ke bawah untuk memuat lebih banyak"}
          </span>
        )}
      </div>

      {/* Modal Detail */}
      {showDetailModal && selectedPembelian && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Detail Pembelian</h2>
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
                    <p className="text-sm text-gray-500">Kode Pembelian</p>
                    <p className="font-semibold">
                      {selectedPembelian.kodePembelian}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tanggal</p>
                    <p className="font-semibold">
                      {new Date(selectedPembelian.createdAt).toLocaleString(
                        "id-ID"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Supplier</p>
                    <p className="font-semibold">
                      {selectedPembelian.supplier?.namaSupplier}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <div className="flex gap-2 mt-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          selectedPembelian.statusTransaksi === "SELESAI"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {selectedPembelian.statusTransaksi}
                      </span>
                      {selectedPembelian.statusTransaksi === "SELESAI" && (
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            selectedPembelian.statusPembayaran === "LUNAS"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {selectedPembelian.statusPembayaran}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Tanggal Jatuh Tempo */}
                  {selectedPembelian.statusPembayaran === "HUTANG" &&
                    selectedPembelian.tanggalJatuhTempo && (
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500">
                          Tanggal Jatuh Tempo
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="font-semibold">
                            {formatDate(selectedPembelian.tanggalJatuhTempo)}
                          </p>
                          {(() => {
                            const status = getJatuhTempoStatus(
                              selectedPembelian.tanggalJatuhTempo
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
              <h3 className="font-semibold text-gray-900 mb-2">
                Daftar Barang
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
                    {selectedPembelian.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">{item.barang?.namaBarang}</td>
                        <td className="px-3 py-2 text-center">
                          {item.jumlahDus} dus
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatRupiah(item.hargaPokok)}
                        </td>
                        <td className="px-3 py-2 text-right text-red-500">
                          {item.diskonPerItem > 0
                            ? `-${formatRupiah(
                                item.diskonPerItem * item.jumlahDus
                              )}`
                            : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatRupiah(
                            item.hargaPokok * item.jumlahDus -
                              item.diskonPerItem * item.jumlahDus
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatRupiah(selectedPembelian.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Diskon Nota</span>
                  <span className="text-red-500">
                    -{formatRupiah(selectedPembelian.diskonNota)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{formatRupiah(selectedPembelian.totalHarga)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Dibayar</span>
                  <span>{formatRupiah(selectedPembelian.jumlahDibayar)}</span>
                </div>
                {selectedPembelian.kembalian > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Kembalian</span>
                    <span>{formatRupiah(selectedPembelian.kembalian)}</span>
                  </div>
                )}
                {getSisaHutang(selectedPembelian) > 0 && (
                  <div className="flex justify-between text-sm text-red-600 font-medium">
                    <span>Sisa Hutang</span>
                    <span>
                      {formatRupiah(getSisaHutang(selectedPembelian))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiwayatPembelianPage;
