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
  User,
  Building2,
  Package,
  CalendarClock,
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
  alamat: string | null;
  noHp: string | null;
  jenis: "SALES" | "KASIR";
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

interface PenjualanItem {
  id: number;
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  hargaJual: number;
  diskonPerItem: number;
  barang: Barang;
}

interface PenjualanHeader {
  id: number;
  kodePenjualan: string;
  customerId: number | null;
  namaCustomer: string | null;
  karyawanId: number | null;
  namaSales: string | null;
  subtotal: number;
  diskonNota: number;
  totalHarga: number;
  jumlahDibayar: number;
  kembalian: number;
  metodePembayaran: "CASH" | "TRANSFER";
  statusPembayaran: "LUNAS" | "HUTANG";
  statusTransaksi: "KERANJANG" | "SELESAI" | "DIBATALKAN";
  tanggalTransaksi: string;
  tanggalJatuhTempo: string | null;
  customer: Customer | null;
  karyawan: Karyawan | null;
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

  // User role state
  const [userRole, setUserRole] = useState<string>("");

  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("SELESAI");
  const [filterPembayaran, setFilterPembayaran] = useState<string>("HUTANG"); // Default ke HUTANG
  const [filterTipe, setFilterTipe] = useState<string>("all");
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
  const [selectedPenjualan, setSelectedPenjualan] =
    useState<PenjualanHeader | null>(null);

  // Pelunasan modal
  const [showPelunasanModal, setShowPelunasanModal] = useState<boolean>(false);
  const [pelunasanPenjualan, setPelunasanPenjualan] =
    useState<PenjualanHeader | null>(null);
  const [jumlahBayar, setJumlahBayar] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Ubah Jatuh Tempo modal
  const [showUbahJatuhTempoModal, setShowUbahJatuhTempoModal] =
    useState<boolean>(false);
  const [jatuhTempoPenjualan, setJatuhTempoPenjualan] =
    useState<PenjualanHeader | null>(null);
  const [tanggalJatuhTempoBaru, setTanggalJatuhTempoBaru] =
    useState<string>("");

  // Statistik
  const [stats, setStats] = useState({
    totalTransaksi: 0,
    totalPendapatan: 0,
    totalHutang: 0,
    totalHutangTransaksi: 0,
    totalLunas: 0,
    hutangJatuhTempo: 0,
  });

  // Check user role on mount
  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.success) {
        setUserRole(data.data.role);
      }
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

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
    fetchPenjualan(1, true);
  }, [
    filterStatus,
    filterPembayaran,
    filterTipe,
    startDate,
    endDate,
    debouncedSearch,
  ]);

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

    if (filterStatus !== "all") {
      params.append("status", filterStatus);
    }

    if (filterPembayaran !== "all") {
      params.append("pembayaran", filterPembayaran);
    }

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
        let filtered = data.data;

        // Filter out KERANJANG since this is riwayat page
        if (filterStatus === "all") {
          filtered = data.data.filter(
            (p: PenjualanHeader) =>
              p.statusTransaksi === "SELESAI" ||
              p.statusTransaksi === "DIBATALKAN"
          );
        }

        if (reset) {
          setPenjualanList(filtered);
        } else {
          setPenjualanList((prev) => [...prev, ...filtered]);
        }
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching penjualan:", error);
      toast.error("Gagal mengambil data penjualan");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchStats = async () => {
    try {
      const selesaiRes = await fetch(
        "/api/penjualan-sales?status=SELESAI&limit=1000"
      );
      const selesaiData = await selesaiRes.json();

      if (selesaiData.success) {
        const selesaiList = selesaiData.data as PenjualanHeader[];

        // Filter hanya status HUTANG (sudah difilter di API untuk karyawan SALES)
        const hutangList = selesaiList.filter(
          (p) => p.statusPembayaran === "HUTANG"
        );

        const totalHutang = hutangList.reduce(
          (sum, p) => sum + (p.totalHarga - p.jumlahDibayar),
          0
        );

        const totalPendapatan = selesaiList.reduce(
          (sum, p) => sum + p.jumlahDibayar,
          0
        );

        // Hitung hutang yang akan jatuh tempo dalam 7 hari
        const now = new Date();
        const hutangJatuhTempo = hutangList.filter((p) => {
          if (!p.tanggalJatuhTempo) return false;
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
          totalPendapatan,
          totalHutang,
          totalHutangTransaksi: hutangList.length,
          totalLunas,
          hutangJatuhTempo,
        });
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
    setFilterStatus("SELESAI");
    setFilterPembayaran("HUTANG"); // Tetap HUTANG
    setFilterTipe("all");
    setStartDate("");
    setEndDate("");
  };

  const handleViewDetail = (penjualan: PenjualanHeader) => {
    setSelectedPenjualan(penjualan);
    setShowDetailModal(true);
  };

  const handleOpenPelunasan = (penjualan: PenjualanHeader) => {
    setPelunasanPenjualan(penjualan);
    const sisaHutang = penjualan.totalHarga - penjualan.jumlahDibayar;
    setJumlahBayar(sisaHutang.toString());
    setShowPelunasanModal(true);
  };

  const handlePelunasan = async () => {
    if (!pelunasanPenjualan || !jumlahBayar) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/penjualan/${pelunasanPenjualan.id}/bayar-hutang`,
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
        setPelunasanPenjualan(null);
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

  const handleOpenUbahJatuhTempo = (penjualan: PenjualanHeader) => {
    setJatuhTempoPenjualan(penjualan);
    // Format tanggal untuk input date (YYYY-MM-DD)
    if (penjualan.tanggalJatuhTempo) {
      const currentDate = new Date(penjualan.tanggalJatuhTempo);
      const formattedDate = currentDate.toISOString().split("T")[0];
      setTanggalJatuhTempoBaru(formattedDate);
    } else {
      setTanggalJatuhTempoBaru("");
    }
    setShowUbahJatuhTempoModal(true);
  };

  const handleUbahJatuhTempo = async () => {
    if (!jatuhTempoPenjualan || !tanggalJatuhTempoBaru) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/penjualan/${jatuhTempoPenjualan.id}/ubah-jatuh-tempo`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tanggalJatuhTempo: tanggalJatuhTempoBaru,
          }),
        }
      );
      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setShowUbahJatuhTempoModal(false);
        setJatuhTempoPenjualan(null);
        setTanggalJatuhTempoBaru("");
        handleRefresh();
      } else {
        toast.error(data.error || "Gagal mengubah tanggal jatuh tempo");
      }
    } catch (error) {
      console.error("Error updating jatuh tempo:", error);
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
    return penjualan.namaCustomer || "-";
  };

  const getSalesName = (penjualan: PenjualanHeader): string => {
    if (penjualan.karyawan) {
      return penjualan.karyawan.nama;
    }
    return penjualan.namaSales || "-";
  };

  const hasActiveFilters =
    filterStatus !== "SELESAI" ||
    filterPembayaran !== "HUTANG" ||
    filterTipe !== "all" ||
    startDate ||
    endDate ||
    debouncedSearch;

  const isAdmin = userRole === "ADMIN";

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
                  Pembayaran Piutang Sales
                </h1>
                <p className="text-blue-100 text-sm">
                  Kelola dan terima pembayaran piutang dari sales
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

        {/* Statistik - 3 Card Full Width */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="group bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">
                  Total Piutang
                </p>
                <p className="text-2xl font-bold text-red-600 mb-1">
                  {formatRupiahSimple(stats.totalHutang)}
                </p>
                <p className="text-xs text-gray-400">Total piutang belum lunas</p>
              </div>
              <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-4 rounded-xl shadow-md">
                <AlertCircle className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">
                  Transaksi Piutang
                </p>
                <p className="text-2xl font-bold text-indigo-700 mb-1">
                  {stats.totalHutangTransaksi}
                </p>
                <p className="text-xs text-gray-400">Transaksi belum lunas</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl shadow-md">
                <CreditCard className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">
                  Jatuh Tempo ≤7 Hari
                </p>
                <p className="text-2xl font-bold text-orange-600 mb-1">
                  {stats.hutangJatuhTempo}
                </p>
                <p className="text-xs text-gray-400">Piutang kritis</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-xl shadow-md">
                <AlertTriangle className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search - Hanya Tanggal */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari kode penjualan, nama customer, atau sales..."
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

            {/* Filters - Hanya Tanggal */}
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

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-700">
              Menampilkan hanya transaksi piutang dari <strong>Sales</strong>, diurutkan berdasarkan tanggal jatuh tempo terdekat
            </span>
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
                      Piutang
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Jatuh Tempo
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
                        colSpan={9}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Tidak ada data piutang dari sales ditemukan</p>
                      </td>
                    </tr>
                  ) : (
                    penjualanList.map((pj) => {
                      const sisaHutang = getSisaHutang(pj);
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
                            <p className="font-medium text-gray-900 text-sm">
                              {pj.kodePenjualan}
                            </p>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                pj.metodePembayaran === "CASH"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {pj.metodePembayaran}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-sm font-medium text-gray-900">
                              {getCustomerName(pj)}
                            </p>
                            {pj.customer?.namaToko && (
                              <p className="text-xs text-gray-500">
                                {pj.customer.namaToko}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-blue-600" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {getSalesName(pj)}
                                </p>
                                {pj.karyawan && (
                                  <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold">
                                    {pj.karyawan.jenis}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(pj.tanggalTransaksi)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatRupiah(pj.totalHarga)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {pj.statusTransaksi === "SELESAI" &&
                            sisaHutang > 0 ? (
                              <span className="text-sm font-medium text-red-600">
                                {formatRupiah(sisaHutang)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {pj.statusTransaksi === "SELESAI" &&
                            pj.statusPembayaran === "HUTANG" ? (
                              pj.tanggalJatuhTempo ? (
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-gray-600">
                                    {formatDate(pj.tanggalJatuhTempo)}
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
                                <span className="text-xs text-orange-600 font-medium">
                                  Belum diset
                                </span>
                              )
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium inline-block w-fit ${
                                  pj.statusTransaksi === "SELESAI"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {pj.statusTransaksi}
                              </span>
                              {pj.statusTransaksi === "SELESAI" && (
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium inline-block w-fit ${
                                    pj.statusPembayaran === "LUNAS"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {pj.statusPembayaran === "HUTANG"
                                    ? "PIUTANG"
                                    : pj.statusPembayaran}
                                </span>
                              )}
                            </div>
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
                              {pj.statusTransaksi === "SELESAI" &&
                                pj.statusPembayaran === "HUTANG" && (
                                  <>
                                    <button
                                      onClick={() => handleOpenPelunasan(pj)}
                                      className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all"
                                      title="Terima Pembayaran"
                                    >
                                      <Banknote className="w-4 h-4" />
                                    </button>
                                    {/* Tombol Ubah Jatuh Tempo - hanya untuk ADMIN */}
                                    {isAdmin && (
                                      <button
                                        onClick={() =>
                                          handleOpenUbahJatuhTempo(pj)
                                        }
                                        className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-all"
                                        title="Ubah Jatuh Tempo"
                                      >
                                        <CalendarClock className="w-4 h-4" />
                                      </button>
                                    )}
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
                      <p className="text-sm text-gray-500">Sales</p>
                      <p className="font-semibold flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600" />
                        {getSalesName(selectedPenjualan)}
                      </p>
                      {selectedPenjualan.karyawan && (
                        <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold">
                          {selectedPenjualan.karyawan.jenis}
                        </span>
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
                      {selectedPenjualan.items?.map((item) => {
                        const hargaPcs =
                          item.jumlahPcs > 0
                            ? Math.round(
                                (item.hargaJual /
                                  item.barang.jumlahPerKemasan) *
                                  item.jumlahPcs
                              )
                            : 0;
                        const subtotal =
                          item.hargaJual * item.jumlahDus +
                          hargaPcs -
                          item.diskonPerItem * item.jumlahDus;

                        return (
                          <tr key={item.id}>
                            <td className="px-3 py-2">
                              <p className="font-medium">
                                {item.barang?.namaBarang}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.barang?.jumlahPerKemasan} pcs/dus
                              </p>
                            </td>
                            <td className="px-3 py-2 text-center">
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
                            <td className="px-3 py-2 text-right">
                              {formatRupiah(item.hargaJual)}/dus
                            </td>
                            <td className="px-3 py-2 text-right text-red-500">
                              {item.diskonPerItem > 0
                                ? `-${formatRupiah(
                                    item.diskonPerItem * item.jumlahDus
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

                {/* Action Buttons */}
                {selectedPenjualan.statusTransaksi === "SELESAI" &&
                  selectedPenjualan.statusPembayaran === "HUTANG" && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          setShowDetailModal(false);
                          handleOpenPelunasan(selectedPenjualan);
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <Banknote className="w-5 h-5" />
                        Terima Pembayaran
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setShowDetailModal(false);
                            handleOpenUbahJatuhTempo(selectedPenjualan);
                          }}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                        >
                          <CalendarClock className="w-5 h-5" />
                          Ubah Jatuh Tempo
                        </button>
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Pelunasan */}
        {showPelunasanModal && pelunasanPenjualan && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowPelunasanModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 rounded-t-xl flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  Terima Pembayaran
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
                        {pelunasanPenjualan.kodePenjualan}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Customer</span>
                      <span>{getCustomerName(pelunasanPenjualan)}</span>
                    </div>
                    {pelunasanPenjualan.customer && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Piutang Customer</span>
                        <span className="text-red-600 font-medium">
                          {formatRupiah(pelunasanPenjualan.customer.piutang)} /{" "}
                          {formatRupiah(
                            pelunasanPenjualan.customer.limit_piutang
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total</span>
                      <span>{formatRupiah(pelunasanPenjualan.totalHarga)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Sudah Dibayar</span>
                      <span>
                        {formatRupiah(pelunasanPenjualan.jumlahDibayar)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-red-600 border-t pt-2">
                      <span>Sisa Piutang</span>
                      <span>
                        {formatRupiah(getSisaHutang(pelunasanPenjualan))}
                      </span>
                    </div>
                    {/* Tanggal Jatuh Tempo di modal */}
                    {pelunasanPenjualan.tanggalJatuhTempo && (
                      <div className="flex justify-between items-center text-sm border-t pt-2">
                        <span className="text-gray-500">Jatuh Tempo</span>
                        <div className="flex items-center gap-2">
                          <span>
                            {formatDate(pelunasanPenjualan.tanggalJatuhTempo)}
                          </span>
                          {(() => {
                            const status = getJatuhTempoStatus(
                              pelunasanPenjualan.tanggalJatuhTempo
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
                      setJumlahBayar(
                        getSisaHutang(pelunasanPenjualan).toString()
                      )
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
                      parseInt(jumlahBayar) >= getSisaHutang(pelunasanPenjualan)
                        ? "bg-green-50 border border-green-200"
                        : "bg-yellow-50 border border-yellow-200"
                    }`}
                  >
                    {parseInt(jumlahBayar) >=
                    getSisaHutang(pelunasanPenjualan) ? (
                      <>
                        <div className="flex items-center gap-2 text-green-700 font-medium">
                          <Check className="w-5 h-5" />
                          Piutang akan LUNAS
                        </div>
                        {parseInt(jumlahBayar) >
                          getSisaHutang(pelunasanPenjualan) && (
                          <p className="text-green-600 mt-1">
                            Kembalian:{" "}
                            {formatRupiah(
                              parseInt(jumlahBayar) -
                                getSisaHutang(pelunasanPenjualan)
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
                          Sisa Piutang:{" "}
                          {formatRupiah(
                            getSisaHutang(pelunasanPenjualan) -
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
                        Terima
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Ubah Jatuh Tempo */}
        {showUbahJatuhTempoModal && jatuhTempoPenjualan && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowUbahJatuhTempoModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 rounded-t-xl flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  Ubah Tanggal Jatuh Tempo
                </h2>
                <button
                  onClick={() => setShowUbahJatuhTempoModal(false)}
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
                        {jatuhTempoPenjualan.kodePenjualan}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Customer</span>
                      <span>{getCustomerName(jatuhTempoPenjualan)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Sisa Piutang</span>
                      <span className="font-bold text-red-600">
                        {formatRupiah(getSisaHutang(jatuhTempoPenjualan))}
                      </span>
                    </div>
                    {jatuhTempoPenjualan.tanggalJatuhTempo && (
                      <div className="flex justify-between items-center text-sm border-t pt-2">
                        <span className="text-gray-500">
                          Jatuh Tempo Saat Ini
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatDate(jatuhTempoPenjualan.tanggalJatuhTempo)}
                          </span>
                          {(() => {
                            const status = getJatuhTempoStatus(
                              jatuhTempoPenjualan.tanggalJatuhTempo
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

                {/* Input Tanggal Baru */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tanggal Jatuh Tempo Baru{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={tanggalJatuhTempoBaru}
                    onChange={(e) => setTanggalJatuhTempoBaru(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none text-lg"
                  />
                </div>

                {/* Preview Tanggal Baru */}
                {tanggalJatuhTempoBaru && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 text-purple-700 font-medium mb-2">
                      <CalendarClock className="w-5 h-5" />
                      Preview Jatuh Tempo Baru
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">
                        {formatDate(tanggalJatuhTempoBaru)}
                      </span>
                      {(() => {
                        const status = getJatuhTempoStatus(
                          tanggalJatuhTempoBaru
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

                {/* Warning */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700">
                    Perubahan tanggal jatuh tempo akan langsung disimpan dan
                    tidak dapat dibatalkan.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUbahJatuhTempoModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleUbahJatuhTempo}
                    disabled={isSubmitting || !tanggalJatuhTempoBaru}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <CalendarClock className="w-5 h-5" />
                        Simpan Perubahan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiwayatPenjualanPage;
