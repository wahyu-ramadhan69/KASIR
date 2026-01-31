"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Calendar,
  CalendarClock,
  Check,
  Clock,
  CreditCard,
  Eye,
  Loader2,
  Receipt,
  RefreshCw,
  Search,
  X,
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
  jenisKemasan: string;
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
  createdAt: string;
  updatedAt: string;
  tanggalJatuhTempo: string;
  supplier: Supplier;
  items: PembelianItem[];
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
  }

  return {
    status: "safe",
    label: `${diffDays} hari lagi`,
    color: "bg-green-100 text-green-700 border-green-200",
    bgColor: "bg-green-50",
    textColor: "text-green-600",
    icon: Check,
  };
};

const HutangPembelianPage = () => {
  const [pembelianList, setPembelianList] = useState<PembelianHeader[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [showPelunasanModal, setShowPelunasanModal] = useState(false);
  const [pelunasanPembelian, setPelunasanPembelian] =
    useState<PembelianHeader | null>(null);
  const [jumlahBayar, setJumlahBayar] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPembelian, setSelectedPembelian] =
    useState<PembelianHeader | null>(null);
  const [showUbahJatuhTempoModal, setShowUbahJatuhTempoModal] = useState(false);
  const [jatuhTempoPembelian, setJatuhTempoPembelian] =
    useState<PembelianHeader | null>(null);
  const [tanggalJatuhTempoBaru, setTanggalJatuhTempoBaru] = useState("");
  const [userRole, setUserRole] = useState<string>("");

  const [stats, setStats] = useState({
    totalHutang: 0,
    totalHutangTransaksi: 0,
    hutangJatuhTempo: 0,
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    checkUserRole();
  }, []);

  useEffect(() => {
    fetchPembelian(1, true);
    fetchStats();
  }, [debouncedSearch, startDate, endDate]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

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
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [pagination, loadingMore, loading]);

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

  const buildQueryParams = (page: number) => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", "20");
    params.append("status", "SELESAI");
    params.append("pembayaran", "HUTANG");
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return params.toString();
  };

  const buildStatsQueryParams = () => {
    const params = new URLSearchParams();
    params.append("page", "1");
    params.append("limit", "1000");
    params.append("status", "SELESAI");
    params.append("pembayaran", "HUTANG");
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return params.toString();
  };

  const fetchPembelian = async (page = 1, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const queryParams = buildQueryParams(page);
      const res = await fetch(`/api/pembelian?${queryParams}`);
      const data = await res.json();

      if (data.success) {
        const list: PembelianHeader[] = data.data || [];
        if (reset) setPembelianList(list);
        else setPembelianList((prev) => [...prev, ...list]);
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
      const queryParams = buildStatsQueryParams();
      const res = await fetch(`/api/pembelian?${queryParams}`);
      const data = await res.json();
      if (data.success) {
        const hutangList: PembelianHeader[] = data.data || [];
        const now = new Date();
        const hutangJatuhTempo = hutangList.filter((p) => {
          if (!p.tanggalJatuhTempo) return false;
          const jatuhTempo = new Date(p.tanggalJatuhTempo);
          const diffTime = jatuhTempo.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays <= 7;
        }).length;

        const totalHutang = hutangList.reduce(
          (sum, p) => sum + (p.totalHarga - p.jumlahDibayar),
          0,
        );

        setStats({
          totalHutang,
          totalHutangTransaksi: hutangList.length,
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

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStartDate("");
    setEndDate("");
    fetchPembelian(1, true);
  };

  const handleViewDetail = (pembelian: PembelianHeader) => {
    setSelectedPembelian(pembelian);
    setShowDetailModal(true);
  };

  const handleOpenUbahJatuhTempo = (pembelian: PembelianHeader) => {
    setJatuhTempoPembelian(pembelian);
    if (pembelian.tanggalJatuhTempo) {
      const currentDate = new Date(pembelian.tanggalJatuhTempo);
      setTanggalJatuhTempoBaru(currentDate.toISOString().split("T")[0]);
    } else {
      setTanggalJatuhTempoBaru("");
    }
    setShowUbahJatuhTempoModal(true);
  };

  const handleOpenPelunasan = (pembelian: PembelianHeader) => {
    setPelunasanPembelian(pembelian);
    const sisa = pembelian.totalHarga - pembelian.jumlahDibayar;
    setJumlahBayar(sisa.toString());
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
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setShowPelunasanModal(false);
        setPelunasanPembelian(null);
        setJumlahBayar("");
        fetchPembelian(1, true);
        fetchStats();
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

  const handleUbahJatuhTempo = async () => {
    if (!jatuhTempoPembelian || !tanggalJatuhTempoBaru) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/pembelian/${jatuhTempoPembelian.id}/ubah-jatuh-tempo`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tanggalJatuhTempo: tanggalJatuhTempoBaru }),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Tanggal jatuh tempo diubah");
        setShowUbahJatuhTempoModal(false);
        setJatuhTempoPembelian(null);
        setTanggalJatuhTempoBaru("");
        fetchPembelian(1, true);
      } else {
        toast.error(data.error || "Gagal mengubah jatuh tempo");
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

  const truncateText = (text: string, max = 25) =>
    text.length > max ? `${text.slice(0, max)}…` : text;

  const getSisaHutang = (p: PembelianHeader) =>
    Math.max(0, p.totalHarga - p.jumlahDibayar);

  const hasActiveFilters = startDate || endDate || debouncedSearch;
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

        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-5 mb-6 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/admin/hutang-piutang"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2.5 rounded-lg transition-all shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Hutang Pembelian
                </h1>
                <p className="text-blue-100 text-sm">
                  Kelola dan lunasi hutang ke supplier
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchPembelian(1, true)}
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Total Hutang
                </p>
                <p className="text-lg font-bold text-red-600">
                  {formatRupiahSimple(stats.totalHutang)}
                </p>
                <p className="text-[11px] text-gray-500">
                  {formatRupiah(stats.totalHutang)}
                </p>
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
                  Transaksi Hutang
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

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Jatuh Tempo ≤7 Hari
                </p>
                <p className="text-xl font-bold text-orange-600">
                  {stats.hutangJatuhTempo}
                </p>
                <p className="text-[11px] text-gray-400">Hutang kritis</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-lg shadow-md">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari kode pembelian atau nama supplier..."
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
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm bg-white"
                />
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm bg-white"
                />
              </div>

              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap font-medium"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden xl:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-yellow-700">
              Menampilkan hanya transaksi pembelian dengan status hutang,
              diurutkan berdasarkan tanggal jatuh tempo terdekat
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loading && pembelianList.length === 0 ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center">
                <div className="relative">
                  <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                  <Receipt className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500 mt-6 text-lg font-medium">
                  Memuat data pembelian...
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
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Hutang
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
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-medium text-gray-900 text-sm">
                              {pb.kodePembelian}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-sm font-medium text-gray-900">
                              {pb.supplier?.namaSupplier || "-"}
                            </p>
                            {pb.supplier?.alamat && (
                              <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium">
                                {truncateText(pb.supplier.alamat)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(pb.createdAt)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatRupiah(pb.totalHarga)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {pb.statusTransaksi === "SELESAI" &&
                            sisaHutang > 0 ? (
                              <span className="text-sm font-medium text-red-600">
                                {formatRupiah(sisaHutang)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {pb.statusPembayaran === "HUTANG" &&
                            pb.tanggalJatuhTempo ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-gray-600">
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
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium inline-block w-fit ${
                                  pb.statusTransaksi === "SELESAI"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {pb.statusTransaksi}
                              </span>
                              {pb.statusTransaksi === "SELESAI" && (
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium inline-block w-fit ${
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
                          <td className="px-4 py-3 whitespace-nowrap text-center">
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
                                  <>
                                    <button
                                      onClick={() => handleOpenPelunasan(pb)}
                                      className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all"
                                      title="Bayar Hutang"
                                    >
                                      <Banknote className="w-4 h-4" />
                                    </button>
                                    {isAdmin && (
                                      <button
                                        onClick={() =>
                                          handleOpenUbahJatuhTempo(pb)
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
        </div>

        <div ref={loadMoreRef} className="h-10"></div>
      </div>

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
                        "id-ID",
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
                              selectedPembelian.tanggalJatuhTempo,
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
                                item.diskonPerItem * item.jumlahDus,
                              )}`
                            : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatRupiah(
                            item.hargaPokok * item.jumlahDus -
                              item.diskonPerItem * item.jumlahDus,
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

              {/* Action Buttons */}
              {selectedPembelian.statusTransaksi === "SELESAI" &&
                selectedPembelian.statusPembayaran === "HUTANG" && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        handleOpenPelunasan(selectedPembelian);
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                    >
                      <Banknote className="w-5 h-5" />
                      Bayar Hutang
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setShowDetailModal(false);
                          handleOpenUbahJatuhTempo(selectedPembelian);
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
                            pelunasanPembelian.tanggalJatuhTempo,
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
                              getSisaHutang(pelunasanPembelian),
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
                            parseInt(jumlahBayar),
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

      {showUbahJatuhTempoModal && jatuhTempoPembelian && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowUbahJatuhTempoModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full"
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
                      {jatuhTempoPembelian.kodePembelian}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Supplier</span>
                    <span>{jatuhTempoPembelian.supplier?.namaSupplier}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Sisa Hutang</span>
                    <span className="font-bold text-red-600">
                      {formatRupiah(getSisaHutang(jatuhTempoPembelian))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t pt-2">
                    <span className="text-gray-500">Jatuh Tempo Saat Ini</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {formatDate(jatuhTempoPembelian.tanggalJatuhTempo)}
                      </span>
                      {(() => {
                        const status = getJatuhTempoStatus(
                          jatuhTempoPembelian.tanggalJatuhTempo,
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
                      const status = getJatuhTempoStatus(tanggalJatuhTempoBaru);
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
                  Perubahan tanggal jatuh tempo akan langsung disimpan dan tidak
                  dapat dibatalkan.
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
  );
};

export default HutangPembelianPage;
