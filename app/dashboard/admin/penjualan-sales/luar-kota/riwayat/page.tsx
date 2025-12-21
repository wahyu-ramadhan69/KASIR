"use client";
import { useState, useEffect, useRef } from "react";
import {
  Search,
  Receipt,
  RefreshCw,
  X,
  Check,
  ArrowLeft,
  Eye,
  Calendar,
  Package,
  Banknote,
  Loader2,
  Clock,
  MapPin,
  Truck,
  PackageX,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface ManifestBarang {
  id: number;
  barangId: number;
  totalItem: number;
  barang: {
    id: number;
    namaBarang: string;
    satuan: string;
    ukuran: number;
  };
}

interface PengembalianBarang {
  id: number;
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  kondisiBarang: "BAIK" | "RUSAK" | "KADALUARSA";
  keterangan: string | null;
  tanggalPengembalian: string;
  barang: {
    id: number;
    namaBarang: string;
    satuan: string;
    jumlahPerKemasan: number;
  };
}

interface PenjualanHeader {
  id: number;
  kodePenjualan: string;
  namaCustomer: string | null;
  totalHarga: number;
  statusPembayaran: "LUNAS" | "HUTANG";
  customer?: {
    id: number;
    nama: string;
    namaToko: string;
  } | null;
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
  karyawan: {
    id: number;
    nama: string;
    nik: string;
  };
  manifestBarang: ManifestBarang[];
  penjualanHeaders: PenjualanHeader[];
  pengembalianBarang?: PengembalianBarang[];
  _count: {
    penjualanHeaders: number;
    pengembalianBarang: number;
  };
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const RiwayatPerjalananLuarKotaPage = () => {
  // Data state
  const [perjalananList, setPerjalananList] = useState<PerjalananSales[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
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
  const [selectedPerjalanan, setSelectedPerjalanan] =
    useState<PerjalananSales | null>(null);

  // Statistik
  const [stats, setStats] = useState({
    totalPerjalanan: 0,
    totalPendapatan: 0,
    totalPenjualan: 0,
    perjalananSelesai: 0,
    perjalananAktif: 0,
    totalPengembalian: 0,
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
    fetchPerjalanan(1, true);
    fetchStats(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, debouncedSearch]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          pagination &&
          pagination.page < pagination.totalPages &&
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

    if (startDate) {
      params.append("startDate", startDate);
    }

    if (endDate) {
      params.append("endDate", endDate);
    }

    return params.toString();
  };

  const fetchPerjalanan = async (page: number = 1, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const queryParams = buildQueryParams(page);
      const res = await fetch(`/api/penjualan-luar-kota?${queryParams}`);
      const data = await res.json();

      if (data.success) {
        let perjalananData = data.data.perjalanan;

        // Filter by search term on client side if needed
        if (debouncedSearch) {
          const searchLower = debouncedSearch.toLowerCase();
          perjalananData = perjalananData.filter((p: PerjalananSales) => {
            return (
              p.kodePerjalanan.toLowerCase().includes(searchLower) ||
              p.karyawan.nama.toLowerCase().includes(searchLower) ||
              p.kotaTujuan.toLowerCase().includes(searchLower)
            );
          });
        }

        if (reset) {
          setPerjalananList(perjalananData);
        } else {
          setPerjalananList((prev) => [...prev, ...perjalananData]);
        }
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error("Error fetching perjalanan:", error);
      toast.error("Gagal mengambil data perjalanan");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const calculateStats = (perjalananData: PerjalananSales[]) => {
    const selesai = perjalananData.filter(
      (p) => p.statusPerjalanan === "SELESAI"
    );
    const aktif = perjalananData.filter(
      (p) => p.statusPerjalanan === "AKTIF"
    );

    // Hitung total pendapatan dari semua penjualan
    let totalPendapatan = 0;
    let totalPenjualan = 0;
    let totalPengembalian = 0;

    perjalananData.forEach((p) => {
      if (p.penjualanHeaders) {
        totalPenjualan += p._count.penjualanHeaders;
        p.penjualanHeaders.forEach((pj) => {
          // Convert to number to fix BigInt issue
          totalPendapatan += Number(pj.totalHarga);
        });
      }
      // Hitung total pengembalian
      if (p._count.pengembalianBarang) {
        totalPengembalian += p._count.pengembalianBarang;
      }
    });

    setStats({
      totalPerjalanan: perjalananData.length,
      totalPendapatan,
      totalPenjualan,
      perjalananSelesai: selesai.length,
      perjalananAktif: aktif.length,
      totalPengembalian,
    });
  };

  const fetchStats = async (page = 1) => {
    try {
      const queryParams = buildQueryParams(page);
      const res = await fetch(`/api/penjualan-luar-kota?${queryParams}&limit=10000`);
      const data = await res.json();

      if (data.success) {
        let perjalananData = data.data.perjalanan as PerjalananSales[];

        // Filter by search term on client side if needed
        if (debouncedSearch) {
          const searchLower = debouncedSearch.toLowerCase();
          perjalananData = perjalananData.filter((p: PerjalananSales) => {
            return (
              p.kodePerjalanan.toLowerCase().includes(searchLower) ||
              p.karyawan.nama.toLowerCase().includes(searchLower) ||
              p.kotaTujuan.toLowerCase().includes(searchLower)
            );
          });
        }

        calculateStats(perjalananData);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const loadMore = () => {
    if (pagination && pagination.page < pagination.totalPages && !loadingMore) {
      fetchPerjalanan(pagination.page + 1, false);
    }
  };

  const handleRefresh = () => {
    fetchPerjalanan(1, true);
    fetchStats();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStartDate("");
    setEndDate("");
  };

  const handleViewDetail = (perjalanan: PerjalananSales) => {
    setSelectedPerjalanan(perjalanan);
    setShowDetailModal(true);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "AKTIF":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "SELESAI":
        return "bg-green-100 text-green-700 border-green-200";
      case "DIBATALKAN":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
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
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-700 to-red-800 rounded-xl p-5 mb-6 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/admin/penjualan-sales/luar-kota"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2.5 rounded-lg transition-all shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Riwayat Perjalanan Luar Kota
                </h1>
                <p className="text-orange-100 text-sm">
                  Lihat riwayat perjalanan sales ke luar kota
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
                  Total Perjalanan
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {stats.totalPerjalanan}
                </p>
                <p className="text-[11px] text-gray-400">Semua perjalanan</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-lg shadow-md">
                <Truck className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Total Penjualan
                </p>
                <p className="text-xl font-bold text-blue-700">
                  {stats.totalPenjualan}
                </p>
                <p className="text-[11px] text-gray-400">Transaksi</p>
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
                <p className="text-lg font-bold text-emerald-700">
                  {formatRupiahSimple(stats.totalPendapatan)}
                </p>
                <p className="text-[11px] text-gray-400">Omzet</p>
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
                  Perjalanan Aktif
                </p>
                <p className="text-xl font-bold text-blue-600">
                  {stats.perjalananAktif}
                </p>
                <p className="text-[11px] text-gray-400">Sedang berjalan</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-lg shadow-md">
                <Clock className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Selesai
                </p>
                <p className="text-xl font-bold text-green-600">
                  {stats.perjalananSelesai}
                </p>
                <p className="text-[11px] text-gray-400">Sudah kembali</p>
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
                  Pengembalian
                </p>
                <p className="text-xl font-bold text-purple-600">
                  {stats.totalPengembalian}
                </p>
                <p className="text-[11px] text-gray-400">Total item</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2.5 rounded-lg shadow-md">
                <PackageX className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari kode perjalanan, nama sales, atau kota tujuan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all"
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

            {/* Date Filters */}
            <div className="flex gap-3 flex-wrap lg:flex-nowrap">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Tanggal Mulai"
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none text-sm bg-white"
                />
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Tanggal Akhir"
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none text-sm bg-white"
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
          {loading && perjalananList.length === 0 ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center">
                <div className="relative">
                  <div className="w-24 h-24 border-8 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto"></div>
                  <Truck className="w-10 h-10 text-orange-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500 mt-6 text-lg font-medium">
                  Memuat data perjalanan...
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Kode Perjalanan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Sales
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Kota Tujuan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tanggal Berangkat
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tanggal Kembali
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total Penjualan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Pengembalian
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {perjalananList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        <Truck className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Tidak ada data perjalanan ditemukan</p>
                      </td>
                    </tr>
                  ) : (
                    perjalananList.map((perjalanan) => (
                      <tr
                        key={perjalanan.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-gray-900 text-sm">
                            {perjalanan.kodePerjalanan}
                          </p>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">
                            {perjalanan.karyawan.nama}
                          </p>
                          <p className="text-xs text-gray-500">
                            NIK: {perjalanan.karyawan.nik}
                          </p>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-orange-600" />
                            <span className="text-sm font-medium text-gray-900">
                              {perjalanan.kotaTujuan}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(perjalanan.tanggalBerangkat)}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {perjalanan.tanggalKembali
                            ? formatDate(perjalanan.tanggalKembali)
                            : "-"}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium border ${getStatusColor(
                              perjalanan.statusPerjalanan
                            )}`}
                          >
                            {perjalanan.statusPerjalanan}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm">
                            <p className="font-medium text-gray-900">
                              {perjalanan._count.penjualanHeaders} transaksi
                            </p>
                            {perjalanan.penjualanHeaders && (
                              <p className="text-xs text-gray-500">
                                {formatRupiahSimple(
                                  perjalanan.penjualanHeaders.reduce(
                                    (sum, pj) => sum + pj.totalHarga,
                                    0
                                  )
                                )}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm">
                            <p className="font-medium text-gray-900">
                              {perjalanan._count.pengembalianBarang} item
                            </p>
                            {perjalanan._count.pengembalianBarang > 0 && (
                              <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-medium">
                                Ada retur
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleViewDetail(perjalanan)}
                            className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
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
              Menampilkan {perjalananList.length} dari {pagination.total}{" "}
              perjalanan
              {pagination.page < pagination.totalPages &&
                " • Scroll ke bawah untuk memuat lebih banyak"}
            </span>
          )}
        </div>

        {/* Modal Detail */}
        {showDetailModal && selectedPerjalanan && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-3xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  Detail Perjalanan
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
                      <p className="text-sm text-gray-500">Kode Perjalanan</p>
                      <p className="font-semibold">
                        {selectedPerjalanan.kodePerjalanan}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          selectedPerjalanan.statusPerjalanan
                        )}`}
                      >
                        {selectedPerjalanan.statusPerjalanan}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Sales</p>
                      <p className="font-semibold">
                        {selectedPerjalanan.karyawan.nama}
                      </p>
                      <p className="text-xs text-gray-500">
                        NIK: {selectedPerjalanan.karyawan.nik}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Kota Tujuan</p>
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-4 h-4 text-orange-600" />
                        <p className="font-semibold">
                          {selectedPerjalanan.kotaTujuan}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Tanggal Berangkat</p>
                      <p className="font-semibold">
                        {formatDate(selectedPerjalanan.tanggalBerangkat)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Tanggal Kembali</p>
                      <p className="font-semibold">
                        {selectedPerjalanan.tanggalKembali
                          ? formatDate(selectedPerjalanan.tanggalKembali)
                          : "Belum kembali"}
                      </p>
                    </div>
                    {selectedPerjalanan.keterangan && (
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500">Keterangan</p>
                        <p className="font-semibold">
                          {selectedPerjalanan.keterangan}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manifest Barang */}
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Manifest Barang
                </h3>
                <div className="border rounded-lg overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Nama Barang</th>
                        <th className="px-3 py-2 text-center">Total Item</th>
                        <th className="px-3 py-2 text-left">Satuan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedPerjalanan.manifestBarang?.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">
                            <p className="font-medium">
                              {item.barang.namaBarang}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-center font-medium">
                            {item.totalItem}
                          </td>
                          <td className="px-3 py-2">{item.barang.satuan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Penjualan */}
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Penjualan ({selectedPerjalanan._count.penjualanHeaders})
                </h3>
                <div className="border rounded-lg overflow-hidden mb-4">
                  {selectedPerjalanan.penjualanHeaders &&
                  selectedPerjalanan.penjualanHeaders.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Kode</th>
                          <th className="px-3 py-2 text-left">Customer</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-center">Status</th>
                          <th className="px-3 py-2 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedPerjalanan.penjualanHeaders.map((pj) => (
                          <tr key={pj.id}>
                            <td className="px-3 py-2 font-medium">
                              {pj.kodePenjualan}
                            </td>
                            <td className="px-3 py-2">
                              {pj.customer ? (
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {pj.customer.nama}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {pj.customer.namaToko}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-gray-500">
                                  {pj.namaCustomer || "-"}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatRupiah(pj.totalHarga)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`text-xs px-2 py-1 rounded font-medium ${
                                  pj.statusPembayaran === "LUNAS"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {pj.statusPembayaran}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => {
                                  window.open(
                                    `/api/penjualan/${pj.id}/print-receipt`,
                                    "_blank"
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all text-xs font-semibold shadow-sm hover:shadow-md"
                                title="Cetak Nota"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                Cetak
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Belum ada penjualan</p>
                    </div>
                  )}
                </div>

                {/* Pengembalian Barang */}
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <PackageX className="w-5 h-5" />
                  Pengembalian Barang ({selectedPerjalanan._count.pengembalianBarang})
                </h3>
                <div className="border rounded-lg overflow-hidden mb-4">
                  {selectedPerjalanan.pengembalianBarang &&
                  selectedPerjalanan.pengembalianBarang.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Nama Barang</th>
                          <th className="px-3 py-2 text-center">Jumlah</th>
                          <th className="px-3 py-2 text-center">Kondisi</th>
                          <th className="px-3 py-2 text-left">Tanggal</th>
                          <th className="px-3 py-2 text-left">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedPerjalanan.pengembalianBarang.map((item) => {
                          const getKondisiColor = (kondisi: string) => {
                            switch (kondisi) {
                              case "BAIK":
                                return "bg-green-100 text-green-700";
                              case "RUSAK":
                                return "bg-red-100 text-red-700";
                              case "KADALUARSA":
                                return "bg-orange-100 text-orange-700";
                              default:
                                return "bg-gray-100 text-gray-700";
                            }
                          };

                          const getKondisiIcon = (kondisi: string) => {
                            switch (kondisi) {
                              case "BAIK":
                                return <CheckCircle className="w-3 h-3" />;
                              case "RUSAK":
                                return <XCircle className="w-3 h-3" />;
                              case "KADALUARSA":
                                return <AlertTriangle className="w-3 h-3" />;
                              default:
                                return null;
                            }
                          };

                          return (
                            <tr key={item.id}>
                              <td className="px-3 py-2">
                                <p className="font-medium">
                                  {item.barang.namaBarang}
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
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getKondisiColor(
                                    item.kondisiBarang
                                  )}`}
                                >
                                  {getKondisiIcon(item.kondisiBarang)}
                                  {item.kondisiBarang}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600">
                                {formatDate(item.tanggalPengembalian)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600">
                                {item.keterangan || "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <PackageX className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Belum ada pengembalian barang</p>
                    </div>
                  )}
                </div>

                {/* Summary */}
                {selectedPerjalanan.penjualanHeaders &&
                  selectedPerjalanan.penjualanHeaders.length > 0 && (
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 border border-orange-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-700">
                          Total Pendapatan Perjalanan
                        </span>
                        <span className="text-xl font-bold text-orange-700">
                          {formatRupiah(
                            selectedPerjalanan.penjualanHeaders.reduce(
                              (sum, pj) => sum + pj.totalHarga,
                              0
                            )
                          )}
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiwayatPerjalananLuarKotaPage;
