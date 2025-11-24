"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Receipt,
  RefreshCw,
  X,
  Check,
  CreditCard,
  AlertCircle,
  ArrowLeft,
  Eye,
  Banknote,
  Calendar,
  Loader2,
  Clock,
  AlertTriangle,
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
  jumlahPerkardus: number;
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
  const [filterStatus, setFilterStatus] = useState<string>("SELESAI");
  const [filterPembayaran, setFilterPembayaran] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

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

  // Pelunasan modal
  const [showPelunasanModal, setShowPelunasanModal] = useState<boolean>(false);
  const [pelunasanPembelian, setPelunasanPembelian] =
    useState<PembelianHeader | null>(null);
  const [jumlahBayar, setJumlahBayar] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  // Fetch data when filters change
  useEffect(() => {
    fetchPembelian(1, true);
  }, [filterStatus, filterPembayaran, startDate, endDate, debouncedSearch]);

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

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

    // Status filter - for riwayat we want SELESAI or DIBATALKAN only
    if (filterStatus !== "all") {
      params.append("status", filterStatus);
    }

    // Pembayaran filter
    if (filterPembayaran !== "all") {
      params.append("pembayaran", filterPembayaran);
    }

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
        // Filter out KERANJANG since this is riwayat page
        let filtered = data.data;
        if (filterStatus === "all") {
          filtered = data.data.filter(
            (p: PembelianHeader) =>
              p.statusTransaksi === "SELESAI" ||
              p.statusTransaksi === "DIBATALKAN"
          );
        }

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
        "/api/pembelian?status=SELESAI&limit=1000"
      );
      const selesaiData = await selesaiRes.json();

      // Fetch stats for DIBATALKAN transactions
      const dibatalkanRes = await fetch(
        "/api/pembelian?status=DIBATALKAN&limit=1000"
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
    setFilterStatus("SELESAI");
    setFilterPembayaran("all");
    setStartDate("");
    setEndDate("");
  };

  const handleViewDetail = (pembelian: PembelianHeader) => {
    setSelectedPembelian(pembelian);
    setShowDetailModal(true);
  };

  const handleOpenPelunasan = (pembelian: PembelianHeader) => {
    setPelunasanPembelian(pembelian);
    const sisaHutang = pembelian.totalHarga - pembelian.jumlahDibayar;
    setJumlahBayar(sisaHutang.toString());
    setShowPelunasanModal(true);
  };

  const handlePelunasan = async () => {
    if (!pelunasanPembelian || !jumlahBayar) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/pembelian/${pelunasanPembelian.id}/bayar-hutang`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jumlahBayar: parseInt(jumlahBayar) }),
        }
      );
      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setShowPelunasanModal(false);
        setPelunasanPembelian(null);
        setJumlahBayar("");
        handleRefresh();
      } else {
        toast.error(data.error || "Gagal melakukan pembayaran");
      }
    } catch (error) {
      console.error("Error paying debt:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
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
    filterStatus !== "SELESAI" ||
    filterPembayaran !== "all" ||
    startDate ||
    endDate ||
    debouncedSearch;

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
                {formatRupiah(stats.totalHutang)}
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
          {/* Row 1: Search and Status Filters */}
          <div className="flex flex-col md:flex-row gap-4">
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
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="SELESAI">Selesai</option>
                <option value="DIBATALKAN">Dibatalkan</option>
              </select>
              <select
                value={filterPembayaran}
                onChange={(e) => setFilterPembayaran(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
              >
                <option value="all">Semua Pembayaran</option>
                <option value="LUNAS">Lunas</option>
                <option value="HUTANG">Hutang</option>
              </select>
            </div>
          </div>

          {/* Row 2: Date Range */}
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
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
            <div className="flex-1">
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

          {/* Info sorting */}
          {filterPembayaran === "HUTANG" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-yellow-700">
                Data diurutkan berdasarkan tanggal jatuh tempo terdekat
              </span>
            </div>
          )}
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
                    Sisa Hutang
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Jatuh Tempo
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
                      colSpan={8}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Tidak ada data pembelian ditemukan</p>
                    </td>
                  </tr>
                ) : (
                  pembelianList.map((pb) => {
                    const sisaHutang = getSisaHutang(pb);
                    const jatuhTempoStatus =
                      pb.statusPembayaran === "HUTANG" && pb.tanggalJatuhTempo
                        ? getJatuhTempoStatus(pb.tanggalJatuhTempo)
                        : null;

                    return (
                      <tr
                        key={pb.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          jatuhTempoStatus?.status === "overdue" ||
                          jatuhTempoStatus?.status === "critical"
                            ? "bg-red-50/50"
                            : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="font-medium text-gray-900">
                            {pb.kodePembelian}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {pb.supplier?.namaSupplier || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(pb.createdAt).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatRupiah(pb.totalHarga)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {pb.statusTransaksi === "SELESAI" &&
                          sisaHutang > 0 ? (
                            <span className="text-sm font-medium text-red-600">
                              {formatRupiah(sisaHutang)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {pb.statusTransaksi === "SELESAI" &&
                          pb.statusPembayaran === "HUTANG" &&
                          pb.tanggalJatuhTempo ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm text-gray-600">
                                {formatDate(pb.tanggalJatuhTempo)}
                              </span>
                              {jatuhTempoStatus && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${jatuhTempoStatus.color}`}
                                >
                                  <jatuhTempoStatus.icon className="w-3 h-3" />
                                  {jatuhTempoStatus.label}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-1">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                pb.statusTransaksi === "SELESAI"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {pb.statusTransaksi}
                            </span>
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
                            {pb.statusTransaksi === "SELESAI" &&
                              pb.statusPembayaran === "HUTANG" && (
                                <button
                                  onClick={() => handleOpenPelunasan(pb)}
                                  className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all"
                                  title="Bayar Hutang"
                                >
                                  <Banknote className="w-4 h-4" />
                                </button>
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

              {/* Action Button */}
              {selectedPembelian.statusTransaksi === "SELESAI" &&
                selectedPembelian.statusPembayaran === "HUTANG" && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenPelunasan(selectedPembelian);
                    }}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Banknote className="w-5 h-5" />
                    Bayar Hutang
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Pelunasan */}
      {showPelunasanModal && pelunasanPembelian && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPelunasanModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 rounded-t-xl flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                Pembayaran Hutang
              </h2>
              <button
                onClick={() => setShowPelunasanModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Kode</span>
                    <span className="font-medium">
                      {pelunasanPembelian.kodePembelian}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Supplier</span>
                    <span>{pelunasanPembelian.supplier?.namaSupplier}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span>{formatRupiah(pelunasanPembelian.totalHarga)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Sudah Dibayar</span>
                    <span>
                      {formatRupiah(pelunasanPembelian.jumlahDibayar)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-red-600 border-t pt-2">
                    <span>Sisa Hutang</span>
                    <span>
                      {formatRupiah(getSisaHutang(pelunasanPembelian))}
                    </span>
                  </div>
                  {/* Tanggal Jatuh Tempo di modal */}
                  {pelunasanPembelian.tanggalJatuhTempo && (
                    <div className="flex justify-between items-center text-sm border-t pt-2">
                      <span className="text-gray-500">Jatuh Tempo</span>
                      <div className="flex items-center gap-2">
                        <span>
                          {formatDate(pelunasanPembelian.tanggalJatuhTempo)}
                        </span>
                        {(() => {
                          const status = getJatuhTempoStatus(
                            pelunasanPembelian.tanggalJatuhTempo
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

              {/* Input */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Jumlah Pembayaran <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={jumlahBayar}
                  onChange={(e) => setJumlahBayar(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-lg"
                  placeholder="Masukkan jumlah pembayaran"
                />
              </div>

              {/* Quick Amount */}
              <div className="flex gap-2 flex-wrap mb-4">
                <button
                  onClick={() =>
                    setJumlahBayar(getSisaHutang(pelunasanPembelian).toString())
                  }
                  className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded text-sm hover:bg-emerald-200"
                >
                  Lunasi Semua
                </button>
                {[50000, 100000, 200000, 500000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setJumlahBayar(amount.toString())}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                  >
                    {formatRupiah(amount)}
                  </button>
                ))}
              </div>

              {/* Preview */}
              {jumlahBayar && parseInt(jumlahBayar) > 0 && (
                <div
                  className={`rounded-lg p-4 mb-4 ${
                    parseInt(jumlahBayar) >= getSisaHutang(pelunasanPembelian)
                      ? "bg-green-50 border border-green-200"
                      : "bg-yellow-50 border border-yellow-200"
                  }`}
                >
                  {parseInt(jumlahBayar) >=
                  getSisaHutang(pelunasanPembelian) ? (
                    <>
                      <div className="flex items-center gap-2 text-green-700 font-medium">
                        <Check className="w-5 h-5" />
                        Hutang akan LUNAS
                      </div>
                      {parseInt(jumlahBayar) >
                        getSisaHutang(pelunasanPembelian) && (
                        <p className="text-green-600 mt-1">
                          Kembalian:{" "}
                          {formatRupiah(
                            parseInt(jumlahBayar) -
                              getSisaHutang(pelunasanPembelian)
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-yellow-700 font-medium">
                        <AlertCircle className="w-5 h-5" />
                        Pembayaran Sebagian
                      </div>
                      <p className="text-yellow-600 mt-1">
                        Sisa Hutang:{" "}
                        {formatRupiah(
                          getSisaHutang(pelunasanPembelian) -
                            parseInt(jumlahBayar)
                        )}
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPelunasanModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handlePelunasan}
                  disabled={
                    isSubmitting || !jumlahBayar || parseInt(jumlahBayar) <= 0
                  }
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    "Memproses..."
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Bayar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiwayatPembelianPage;
