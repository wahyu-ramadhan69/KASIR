"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Calendar,
  DollarSign,
  Wallet,
  AlertTriangle,
  Users,
  Receipt,
  Eye,
  X,
  FileSpreadsheet,
  Loader2,
  Package,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface Customer {
  id: number;
  nama: string;
  namaToko: string;
  noHp: string;
  limit_piutang: number;
}

interface Pembayaran {
  id: number;
  kodePembayaran: string;
  tanggalBayar: string;
  nominal: number;
  metode: string;
  catatan: string | null;
}

interface Piutang {
  id: number;
  kodePenjualan: string;
  customerId: number | null;
  namaCustomer: string | null;
  customer: Customer | null;
  totalHarga: number;
  jumlahDibayar: number;
  sisaPiutang: number;
  metodePembayaran: string;
  statusPembayaran: "LUNAS" | "HUTANG";
  tanggalTransaksi: string;
  tanggalJatuhTempo: string | null;
  pembayaran: Pembayaran[];
}

interface Stats {
  jumlahTransaksi: number;
  jumlahCustomer: number;
  totalPiutang: number;
  totalDibayar: number;
  totalSisaPiutang: number;
  jumlahJatuhTempo: number;
}

const emptyStats: Stats = {
  jumlahTransaksi: 0,
  jumlahCustomer: 0,
  totalPiutang: 0,
  totalDibayar: 0,
  totalSisaPiutang: 0,
  jumlahJatuhTempo: 0,
};

const getJatuhTempoInfo = (
  tanggalJatuhTempo: string | null,
  statusPembayaran: string,
) => {
  if (statusPembayaran === "LUNAS") {
    return { label: "Lunas", className: "bg-green-100 text-green-700" };
  }
  if (!tanggalJatuhTempo) {
    return { label: "-", className: "bg-gray-100 text-gray-600" };
  }
  const diffDays = Math.ceil(
    (new Date(tanggalJatuhTempo).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) {
    return {
      label: `Terlambat ${Math.abs(diffDays)} hari`,
      className: "bg-red-100 text-red-700",
    };
  }
  if (diffDays <= 7) {
    return {
      label: diffDays === 0 ? "Hari ini" : `${diffDays} hari lagi`,
      className: "bg-orange-100 text-orange-700",
    };
  }
  if (diffDays <= 30) {
    return {
      label: `${diffDays} hari lagi`,
      className: "bg-yellow-100 text-yellow-700",
    };
  }
  return {
    label: `${diffDays} hari lagi`,
    className: "bg-green-100 text-green-700",
  };
};

const LaporanPiutangCustomerPage = () => {
  const [piutangList, setPiutangList] = useState<Piutang[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [fetchBlocked, setFetchBlocked] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>(emptyStats);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Filter state (default: semua periode, hanya yang belum lunas)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("HUTANG");
  const [jatuhTempoFilter, setJatuhTempoFilter] = useState<string>("all");

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedPiutang, setSelectedPiutang] = useState<Piutang | null>(null);

  // Export loading
  const [exportingSummary, setExportingSummary] = useState<boolean>(false);
  const [exportingDetail, setExportingDetail] = useState<boolean>(false);

  // Ref untuk infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    // Reset saat filter berubah
    setPiutangList([]);
    setPage(1);
    setHasMore(true);
    setFetchBlocked(false);
    fetchData(1, true);
  }, [startDate, endDate, debouncedSearch, statusFilter, jatuhTempoFilter]);

  useEffect(() => {
    // Setup intersection observer untuk infinite scroll
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !loading &&
          !loadingMore &&
          !fetchBlocked
        ) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    const target = observerTarget.current;
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMore, loading, loadingMore, page]);

  const buildFilterParams = () => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (debouncedSearch) params.append("search", debouncedSearch);
    params.append("statusPembayaran", statusFilter);
    params.append("jatuhTempo", jatuhTempoFilter);
    return params;
  };

  const fetchData = async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = buildFilterParams();
      params.append("page", pageNum.toString());
      params.append("limit", "20");

      const res = await fetch(`/api/laporan/piutang-customer?${params}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.success) {
        if (reset) {
          setPiutangList(data.data);
        } else {
          setPiutangList((prev) => [...prev, ...data.data]);
        }
        setHasMore(data.pagination.hasMore);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Gagal mengambil data piutang");
      setFetchBlocked(true);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (fetchBlocked) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage, false);
  };

  const handleViewDetail = (piutang: Piutang) => {
    setSelectedPiutang(piutang);
    setShowDetailModal(true);
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
    setStatusFilter("HUTANG");
    setJatuhTempoFilter("all");
  };

  const handleExport = async (exportType: "summary" | "detail") => {
    if (exportType === "summary") {
      setExportingSummary(true);
    } else {
      setExportingDetail(true);
    }

    try {
      const params = buildFilterParams();
      params.append("format", "excel");
      params.append("detail", exportType === "detail" ? "true" : "false");

      const res = await fetch(`/api/laporan/piutang-customer/export?${params}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const blob = await res.blob();

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      let filename = "Laporan-Piutang-Customer";
      filename += exportType === "summary" ? "-Summary" : "-Detail";
      if (startDate && endDate) {
        filename += `-${startDate}-sd-${endDate}`;
      } else if (startDate) {
        filename += `-sejak-${startDate}`;
      } else if (endDate) {
        filename += `-sampai-${endDate}`;
      }
      filename += `-${Date.now()}.xlsx`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Laporan EXCEL berhasil didownload");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Gagal export laporan");
    } finally {
      setExportingSummary(false);
      setExportingDetail(false);
    }
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatNumber = (num: number): string => {
    const sign = num < 0 ? "-" : "";
    const abs = Math.abs(num);
    const formatShort = (value: number, suffix: string) => {
      const rounded = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
      return `${sign}${rounded} ${suffix}`;
    };

    if (abs >= 1000000000) return formatShort(abs / 1000000000, "M");
    if (abs >= 1000000) return formatShort(abs / 1000000, "jt");
    if (abs >= 1000) return formatShort(abs / 1000, "rb");
    return `${num}`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatMetode = (metode: string) =>
    metode === "CASH_TRANSFER" ? "CASH + TRANSFER" : metode;

  const getNamaCustomer = (p: Piutang) =>
    p.customer?.nama || p.namaCustomer || "-";

  const hasActiveFilters =
    startDate ||
    endDate ||
    searchTerm ||
    statusFilter !== "HUTANG" ||
    jatuhTempoFilter !== "all";

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Laporan Piutang Customer
            </h1>
            <p className="text-blue-100">
              Rekap piutang penjualan toko per nota dan per customer
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("summary")}
              disabled={exportingSummary}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
              title="Export daftar piutang + rekap per customer"
            >
              {exportingSummary ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Excel Summary
            </button>
            <button
              onClick={() => handleExport("detail")}
              disabled={exportingDetail}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
              title="Export summary + riwayat pembayaran/cicilan"
            >
              {exportingDetail ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Excel Detail
            </button>
          </div>
        </div>

        {/* Info filter yang akan di-export */}
        <div className="mt-4 bg-blue-700/50 rounded-lg px-4 py-2">
          <p className="text-sm text-blue-100">
            📅 Export akan menggunakan filter:{" "}
            <span className="font-semibold text-white">
              {startDate || endDate ? (
                <>
                  {startDate && `Dari ${formatDate(startDate)}`}
                  {startDate && endDate && " "}
                  {endDate && `Sampai ${formatDate(endDate)}`}
                </>
              ) : (
                "Semua periode"
              )}
              {" · "}
              {statusFilter === "HUTANG"
                ? "Belum lunas"
                : statusFilter === "LUNAS"
                  ? "Lunas"
                  : "Semua status"}
              {jatuhTempoFilter === "overdue" && " · Lewat jatuh tempo"}
              {jatuhTempoFilter === "7hari" && " · Jatuh tempo ≤ 7 hari"}
            </span>
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Penjualan</p>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            Rp {formatNumber(stats.totalPiutang)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.jumlahTransaksi} nota
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Sudah Dibayar</p>
            <Wallet className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            Rp {formatNumber(stats.totalDibayar)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Termasuk cicilan</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Sisa Piutang</p>
            <Receipt className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            Rp {formatNumber(stats.totalSisaPiutang)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Belum terbayar</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">
              Lewat Jatuh Tempo
            </p>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">
            {stats.jumlahJatuhTempo}
          </p>
          <p className="text-xs text-gray-500 mt-1">Nota terlambat bayar</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Customer</p>
            <Users className="w-8 h-8 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.jumlahCustomer}
          </p>
          <p className="text-xs text-gray-500 mt-1">Customer terdaftar</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-md border border-gray-100">
        <div className="flex flex-col md:flex-row md:flex-wrap gap-4">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari kode, customer, atau nama toko..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                title="Tanggal transaksi dari"
              />
            </div>
            <span className="flex items-center text-gray-500">-</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                title="Tanggal transaksi sampai"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
          >
            <option value="HUTANG">Belum Lunas</option>
            <option value="LUNAS">Lunas</option>
            <option value="all">Semua Status</option>
          </select>

          <select
            value={jatuhTempoFilter}
            onChange={(e) => setJatuhTempoFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
          >
            <option value="all">Semua Jatuh Tempo</option>
            <option value="overdue">Lewat Jatuh Tempo</option>
            <option value="7hari">≤ 7 Hari Lagi</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Kode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Penjualan
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Dibayar
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Sisa Piutang
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Jatuh Tempo
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {piutangList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Tidak ada data piutang</p>
                    </td>
                  </tr>
                ) : (
                  piutangList.map((p) => {
                    const jt = getJatuhTempoInfo(
                      p.tanggalJatuhTempo,
                      p.statusPembayaran,
                    );
                    const dibayar = Math.max(0, p.totalHarga - p.sisaPiutang);

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">
                            {p.kodePenjualan}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(p.tanggalTransaksi)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">
                            {getNamaCustomer(p)}
                          </p>
                          {p.customer?.namaToko && (
                            <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium">
                              {p.customer.namaToko}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                          {formatRupiah(p.totalHarga)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-orange-600">
                          {formatRupiah(dibayar)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                          {formatRupiah(p.sisaPiutang)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <p className="text-xs text-gray-500 mb-1">
                            {formatDate(p.tanggalJatuhTempo)}
                          </p>
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${jt.className}`}
                          >
                            {jt.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              p.statusPembayaran === "LUNAS"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {p.statusPembayaran}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleViewDetail(p)}
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

        {/* Infinite Scroll Trigger */}
        {hasMore && (
          <div ref={observerTarget} className="flex justify-center py-4">
            {loadingMore && (
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedPiutang && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Detail Piutang</h2>
                <p className="text-blue-100 text-sm">
                  {selectedPiutang.kodePenjualan}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="bg-gray-50 rounded-lg p-4 mb-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tanggal Transaksi</p>
                  <p className="font-semibold">
                    {formatDateTime(selectedPiutang.tanggalTransaksi)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-semibold">
                    {getNamaCustomer(selectedPiutang)}
                  </p>
                  {selectedPiutang.customer?.namaToko && (
                    <p className="text-xs text-gray-500">
                      {selectedPiutang.customer.namaToko}
                      {selectedPiutang.customer.noHp &&
                        ` · ${selectedPiutang.customer.noHp}`}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Jatuh Tempo</p>
                  <p className="font-semibold">
                    {formatDate(selectedPiutang.tanggalJatuhTempo)}
                  </p>
                  {(() => {
                    const jt = getJatuhTempoInfo(
                      selectedPiutang.tanggalJatuhTempo,
                      selectedPiutang.statusPembayaran,
                    );
                    return (
                      <span
                        className={`inline-block mt-1 px-2 py-1 rounded text-xs font-semibold ${jt.className}`}
                      >
                        {jt.label}
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status Pembayaran</p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      selectedPiutang.statusPembayaran === "LUNAS"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {selectedPiutang.statusPembayaran}
                  </span>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-3">
                Riwayat Pembayaran
              </h3>
              <div className="border rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Kode</th>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-center">Metode</th>
                      <th className="px-3 py-2 text-right">Nominal</th>
                      <th className="px-3 py-2 text-left">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedPiutang.pembayaran.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-gray-500"
                        >
                          Belum ada pembayaran
                        </td>
                      </tr>
                    ) : (
                      selectedPiutang.pembayaran.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">
                            {b.kodePembayaran}
                          </td>
                          <td className="px-3 py-2">
                            {formatDateTime(b.tanggalBayar)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {formatMetode(b.metode)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-orange-600">
                            {formatRupiah(b.nominal)}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {b.catatan || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between font-bold">
                  <span>Total Penjualan</span>
                  <span className="text-blue-600">
                    {formatRupiah(selectedPiutang.totalHarga)}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Sudah Dibayar</span>
                  <span className="text-orange-600">
                    {formatRupiah(
                      Math.max(
                        0,
                        selectedPiutang.totalHarga -
                          selectedPiutang.sisaPiutang,
                      ),
                    )}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Sisa Piutang</span>
                  <span className="text-green-600">
                    {formatRupiah(selectedPiutang.sisaPiutang)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaporanPiutangCustomerPage;
