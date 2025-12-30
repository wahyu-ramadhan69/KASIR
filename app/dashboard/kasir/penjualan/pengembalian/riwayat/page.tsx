"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  Eye,
  Loader2,
  Package,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface Barang {
  id: number;
  namaBarang: string;
  satuan: string;
  jumlahPerKemasan: number;
}

interface PengembalianBarang {
  id: number;
  perjalananId: number | null;
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  kondisiBarang: "BAIK" | "RUSAK" | "KADALUARSA";
  keterangan: string | null;
  tanggalPengembalian: string;
  createdAt: string;
  updatedAt: string;
  barang: Barang;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

const getKondisiMeta = (kondisi: PengembalianBarang["kondisiBarang"]) => {
  switch (kondisi) {
    case "BAIK":
      return {
        label: "BAIK",
        color: "bg-green-100 text-green-700 border-green-200",
        row: "",
        icon: Check,
      };
    case "RUSAK":
      return {
        label: "RUSAK",
        color: "bg-red-100 text-red-700 border-red-200",
        row: "bg-red-50/50",
        icon: AlertCircle,
      };
    case "KADALUARSA":
      return {
        label: "KADALUARSA",
        color: "bg-orange-100 text-orange-700 border-orange-200",
        row: "bg-orange-50/50",
        icon: AlertTriangle,
      };
    default:
      return {
        label: kondisi,
        color: "bg-gray-100 text-gray-700 border-gray-200",
        row: "",
        icon: AlertCircle,
      };
  }
};

const RiwayatPengembalianPage = () => {
  const [pengembalianList, setPengembalianList] = useState<
    PengembalianBarang[]
  >([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedPengembalian, setSelectedPengembalian] =
    useState<PengembalianBarang | null>(null);

  const [stats, setStats] = useState({
    totalPengembalian: 0,
    totalBaik: 0,
    totalRusak: 0,
    totalKadaluarsa: 0,
    totalDus: 0,
    totalPcs: 0,
  });

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

  useEffect(() => {
    fetchPengembalian(1, true);
  }, [startDate, endDate, debouncedSearch]);

  useEffect(() => {
    fetchStats();
  }, []);

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
    params.append("withoutPerjalanan", "true");

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

  const fetchPengembalian = async (page: number = 1, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const queryParams = buildQueryParams(page);
      const res = await fetch(`/api/penjualan/pengembalian?${queryParams}`);
      const data = await res.json();

      if (data.success) {
        const list = data.data as PengembalianBarang[];
        if (reset) setPengembalianList(list);
        else setPengembalianList((prev) => [...prev, ...list]);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching pengembalian:", error);
      toast.error("Gagal mengambil data pengembalian");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(
        "/api/penjualan/pengembalian?limit=1000&withoutPerjalanan=true"
      );
      const data = await res.json();

      if (data.success) {
        const list = data.data as PengembalianBarang[];
        const totalBaik = list.filter((p) => p.kondisiBarang === "BAIK").length;
        const totalRusak = list.filter((p) => p.kondisiBarang === "RUSAK").length;
        const totalKadaluarsa = list.filter(
          (p) => p.kondisiBarang === "KADALUARSA"
        ).length;
        const totalDus = list.reduce((sum, p) => sum + p.jumlahDus, 0);
        const totalPcs = list.reduce((sum, p) => sum + p.jumlahPcs, 0);

        setStats({
          totalPengembalian: list.length,
          totalBaik,
          totalRusak,
          totalKadaluarsa,
          totalDus,
          totalPcs,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const loadMore = () => {
    if (pagination && pagination.hasMore && !loadingMore) {
      fetchPengembalian(pagination.page + 1, false);
    }
  };

  const handleRefresh = () => {
    fetchPengembalian(1, true);
    fetchStats();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStartDate("");
    setEndDate("");
  };

  const handleViewDetail = (pengembalian: PengembalianBarang) => {
    setSelectedPengembalian(pengembalian);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat("id-ID").format(value);
  };

  const truncateText = (value: string | null, maxLength: number) => {
    if (!value) return "-";
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}...`;
  };

  const getTotalPcs = (item: PengembalianBarang) => {
    const perKemasan = item.barang?.jumlahPerKemasan || 0;
    return item.jumlahDus * perKemasan + item.jumlahPcs;
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
                href="/dashboard/admin/penjualan/pengembalian"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2.5 rounded-lg transition-all shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Riwayat Pengembalian
                </h1>
                <p className="text-blue-100 text-sm">
                  Lihat riwayat pengembalian barang penjualan
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
                  Total Pengembalian
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatNumber(stats.totalPengembalian)}
                </p>
                <p className="text-[11px] text-gray-400">Semua data</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-lg shadow-md">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Kondisi Baik
                </p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatNumber(stats.totalBaik)}
                </p>
                <p className="text-[11px] text-gray-400">Barang baik</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-lg shadow-md">
                <Check className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Kondisi Rusak
                </p>
                <p className="text-xl font-bold text-red-600">
                  {formatNumber(stats.totalRusak)}
                </p>
                <p className="text-[11px] text-gray-400">Barang rusak</p>
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
                  Kondisi Kadaluarsa
                </p>
                <p className="text-xl font-bold text-orange-600">
                  {formatNumber(stats.totalKadaluarsa)}
                </p>
                <p className="text-[11px] text-gray-400">Barang kadaluarsa</p>
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
                  Total Dus
                </p>
                <p className="text-xl font-bold text-indigo-700">
                  {formatNumber(stats.totalDus)}
                </p>
                <p className="text-[11px] text-gray-400">Dus kembali</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-2.5 rounded-lg shadow-md">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Total Pcs
                </p>
                <p className="text-xl font-bold text-purple-700">
                  {formatNumber(stats.totalPcs)}
                </p>
                <p className="text-[11px] text-gray-400">Pcs kembali</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2.5 rounded-lg shadow-md">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari nama barang atau keterangan..."
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
          {loading && pengembalianList.length === 0 ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center">
                <div className="relative">
                  <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                  <Package className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500 mt-6 text-lg font-medium">
                  Memuat data pengembalian...
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Barang
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Jumlah
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Kondisi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Keterangan
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pengembalianList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Tidak ada data pengembalian ditemukan</p>
                      </td>
                    </tr>
                  ) : (
                    pengembalianList.map((item) => {
                      const kondisiMeta = getKondisiMeta(item.kondisiBarang);
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-gray-50 transition-colors ${kondisiMeta.row}`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-medium text-gray-900 text-sm">
                              {item.barang?.namaBarang || "-"}
                            </p>
                            <span className="text-xs text-gray-500">
                              {item.barang?.jumlahPerKemasan || 0} pcs/dus
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {item.jumlahDus > 0 && (
                              <span className="block">
                                {item.jumlahDus} dus
                              </span>
                            )}
                            {item.jumlahPcs > 0 && (
                              <span className="block text-gray-500">
                                +{item.jumlahPcs} pcs
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1 w-fit ${kondisiMeta.color}`}
                            >
                              <kondisiMeta.icon className="w-3 h-3" />
                              {kondisiMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(item.tanggalPengembalian)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {truncateText(item.keterangan, 25)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleViewDetail(item)}
                              className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
                              title="Lihat Detail"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

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
              Menampilkan {pengembalianList.length} dari {pagination.totalCount}{" "}
              data pengembalian
              {pagination.hasMore &&
                " - Scroll ke bawah untuk memuat lebih banyak"}
            </span>
          )}
        </div>

        {/* Modal Detail */}
        {showDetailModal && selectedPengembalian && (
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
                  Detail Pengembalian
                </h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Barang</p>
                      <p className="font-semibold">
                        {selectedPengembalian.barang?.namaBarang || "-"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedPengembalian.barang?.jumlahPerKemasan || 0}{" "}
                        pcs/dus
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Tanggal</p>
                      <p className="font-semibold">
                        {new Date(
                          selectedPengembalian.tanggalPengembalian
                        ).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Kondisi</p>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium mt-1 ${
                          getKondisiMeta(selectedPengembalian.kondisiBarang)
                            .color
                        }`}
                      >
                        {(() => {
                          const meta = getKondisiMeta(
                            selectedPengembalian.kondisiBarang
                          );
                          return <meta.icon className="w-3 h-3" />;
                        })()}
                        {selectedPengembalian.kondisiBarang}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Jumlah</p>
                      <div className="mt-1 text-sm text-gray-700">
                        {selectedPengembalian.jumlahDus > 0 && (
                          <span className="block">
                            {selectedPengembalian.jumlahDus} dus
                          </span>
                        )}
                        {selectedPengembalian.jumlahPcs > 0 && (
                          <span className="block text-gray-500">
                            +{selectedPengembalian.jumlahPcs} pcs
                          </span>
                        )}
                        <span className="block text-xs text-gray-500 mt-1">
                          Total: {formatNumber(getTotalPcs(selectedPengembalian))} pcs
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Keterangan</p>
                      <p className="font-semibold">
                        {selectedPengembalian.keterangan || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiwayatPengembalianPage;
