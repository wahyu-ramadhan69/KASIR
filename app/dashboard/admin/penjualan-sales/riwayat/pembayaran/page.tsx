"use client";
import { useState, useEffect, useRef } from "react";
import {
  Search,
  Receipt,
  RefreshCw,
  X,
  ArrowLeft,
  Calendar,
  Banknote,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface PembayaranRow {
  id: number;
  kodePembayaran: string;
  penjualanId: number;
  tanggalBayar: string;
  nominal: number;
  metode: string;
  penjualan: {
    id: number;
    kodePenjualan: string;
    tanggalTransaksi: string;
    totalHarga: number;
    jumlahDibayar: number;
    statusPembayaran: string;
    namaCustomer: string | null;
    customer: {
      id: number;
      nama: string;
      namaToko: string | null;
    } | null;
    karyawan: {
      id: number;
      nama: string;
      noHp: string | null;
    } | null;
  };
}

interface Summary {
  totalPembayaran: number;
  totalNominal: number;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

const getToday = () => new Date().toISOString().split("T")[0];

export default function PembayaranSalesPage() {
  const [pembayaranList, setPembayaranList] = useState<PembayaranRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalPembayaran: 0,
    totalNominal: 0,
  });
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  // Fetch ulang saat filter berubah
  useEffect(() => {
    fetchPembayaran(1, true);
  }, [startDate, endDate, debouncedSearch]);

  // Infinite scroll observer
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
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [pagination, loadingMore, loading]);

  const buildQueryParams = (page: number) => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", "20");
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return params.toString();
  };

  const fetchPembayaran = async (page: number = 1, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await fetch(
        `/api/penjualan-sales/pembayaran?${buildQueryParams(page)}`
      );
      const data = await res.json();

      if (data.success) {
        if (reset) {
          setPembayaranList(data.data);
          setSummary(data.summary);
        } else {
          setPembayaranList((prev) => [...prev, ...data.data]);
        }
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching pembayaran:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (pagination?.hasMore && !loadingMore) {
      fetchPembayaran(pagination.page + 1, false);
    }
  };

  const handleRefresh = () => fetchPembayaran(1, true);

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStartDate(getToday());
    setEndDate(getToday());
  };

  const formatRupiah = (number: number): string =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);

  const formatRupiahSimple = (amount: number): string => {
    const abs = Math.abs(amount);
    if (abs >= 1_000_000_000)
      return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
    if (abs >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}Jt`;
    if (abs >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}Rb`;
    return `Rp ${amount}`;
  };

  const formatDate = (dateString: string): string =>
    new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const formatDateTime = (dateString: string): string =>
    new Date(dateString).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getCustomerName = (row: PembayaranRow): string => {
    if (row.penjualan.customer) return row.penjualan.customer.nama;
    return row.penjualan.namaCustomer || "-";
  };

  const getSalesName = (row: PembayaranRow): string => {
    if (row.penjualan.karyawan) return row.penjualan.karyawan.nama;
    return "-";
  };

  const hasActiveFilters =
    startDate !== getToday() || endDate !== getToday() || !!debouncedSearch;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full max-w-7xl mx-auto px-6 pb-8">

        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-xl p-5 mb-6 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/admin/penjualan-sales/riwayat"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2.5 rounded-lg transition-all shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Pembayaran Sales
                </h1>
                <p className="text-emerald-100 text-sm">
                  Rekap pembayaran masuk dari transaksi penjualan sales
                </p>
              </div>
            </div>
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

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Total Pembayaran
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {summary.totalPembayaran}
                </p>
                <p className="text-[11px] text-gray-400">
                  Transaksi pembayaran
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-lg shadow-md">
                <Receipt className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Total Nominal
                </p>
                <p className="text-lg font-bold text-emerald-700">
                  {formatRupiahSimple(summary.totalNominal)}
                </p>
                <p className="text-[11px] text-gray-500">
                  {formatRupiah(summary.totalNominal)}
                </p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-lg shadow-md">
                <Banknote className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari kode penjualan, nama customer, atau sales..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none transition-all"
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

            <div className="flex gap-3 flex-wrap lg:flex-nowrap items-center">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm bg-white"
                />
              </div>
              <span className="text-gray-400 text-sm hidden lg:block">s/d</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm bg-white"
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap font-medium"
                  title="Reset ke hari ini"
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
          {loading && pembayaranList.length === 0 ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center">
                <div className="relative">
                  <div className="w-24 h-24 border-8 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
                  <Banknote className="w-10 h-10 text-emerald-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500 mt-6 text-lg font-medium">
                  Memuat data pembayaran...
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Kode Penjualan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Sales
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Jumlah Transaksi
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Jumlah Pembayaran
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tgl Transaksi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tgl Pembayaran
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Metode
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Sisa Piutang
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pembayaranList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        <Banknote className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Tidak ada data pembayaran ditemukan</p>
                      </td>
                    </tr>
                  ) : (
                    pembayaranList.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {/* Kode */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="font-semibold text-gray-900 text-sm">
                              {row.penjualan.kodePenjualan}
                            </p>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                row.penjualan.statusPembayaran === "HUTANG"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {row.penjualan.statusPembayaran === "HUTANG"
                                ? "PIUTANG"
                                : "LUNAS"}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400">
                            {row.kodePembayaran}
                          </p>
                        </td>

                        {/* Customer */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">
                            {getCustomerName(row)}
                          </p>
                          {row.penjualan.customer?.namaToko && (
                            <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium">
                              {row.penjualan.customer.namaToko}
                            </span>
                          )}
                        </td>

                        {/* Sales */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">
                            {getSalesName(row)}
                          </p>
                          {row.penjualan.karyawan?.noHp && (
                            <p className="text-xs text-blue-600 mt-0.5">
                              {row.penjualan.karyawan.noHp}
                            </p>
                          )}
                        </td>

                        {/* Jumlah Transaksi */}
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {formatRupiah(row.penjualan.totalHarga)}
                          </p>
                        </td>

                        {/* Jumlah Pembayaran */}
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <p className="text-sm font-bold text-emerald-700">
                            {formatRupiah(row.nominal)}
                          </p>
                        </td>

                        {/* Tgl Transaksi */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(row.penjualan.tanggalTransaksi)}
                        </td>

                        {/* Tgl Pembayaran */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {formatDateTime(row.tanggalBayar)}
                        </td>

                        {/* Metode */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
                              row.metode === "CASH"
                                ? "bg-green-100 text-green-700"
                                : row.metode === "TRANSFER"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {row.metode}
                          </span>
                        </td>

                        {/* Sisa Piutang */}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {row.penjualan.statusPembayaran === "HUTANG" ? (
                            <span className="inline-flex flex-col items-center gap-0.5">
                              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-red-100 text-red-700 whitespace-nowrap">
                                {formatRupiah(
                                  row.penjualan.totalHarga -
                                    row.penjualan.jumlahDibayar
                                )}
                              </span>
                              <span className="text-[10px] text-red-400 font-medium">
                                Belum lunas
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-700">
                              Lunas
                            </span>
                          )}
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
              Menampilkan {pembayaranList.length} dari {pagination.totalCount}{" "}
              pembayaran
              {pagination.hasMore &&
                " • Scroll ke bawah untuk memuat lebih banyak"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
