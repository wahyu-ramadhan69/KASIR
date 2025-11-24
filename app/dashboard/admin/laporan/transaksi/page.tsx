"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  Eye,
  X,
  Download,
  RefreshCw,
  Filter as FilterIcon,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface Barang {
  id: number;
  namaBarang: string;
  ukuran: number;
  satuan: string;
  jumlahPerkardus: number;
}

interface PenjualanItem {
  id: number;
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  hargaJual: number;
  hargaBeli: number;
  diskonPerItem: number;
  laba: number;
  barang: Barang;
}

interface Customer {
  id: number;
  nama: string;
  namaToko: string;
}

interface PenjualanHeader {
  id: number;
  kodePenjualan: string;
  customerId: number | null;
  namaCustomer: string | null;
  subtotal: number;
  diskonNota: number;
  totalHarga: number;
  jumlahDibayar: number;
  statusPembayaran: string;
  statusTransaksi: string;
  tanggalTransaksi: string;
  customer: Customer | null;
  items: PenjualanItem[];
}

interface Stats {
  totalPenjualan: number;
  totalModal: number;
  totalLaba: number;
  marginPersen: number;
  jumlahTransaksi: number;
  jumlahItem: number;
  totalDus?: number;
  totalPcs?: number;
}

const LaporanTransaksiPage = () => {
  const [penjualanList, setPenjualanList] = useState<PenjualanHeader[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>({
    totalPenjualan: 0,
    totalModal: 0,
    totalLaba: 0,
    marginPersen: 0,
    jumlahTransaksi: 0,
    jumlahItem: 0,
  });

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedPenjualan, setSelectedPenjualan] =
    useState<PenjualanHeader | null>(null);

  // Export loading
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);

  // Ref untuk infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset saat filter berubah
    setPenjualanList([]);
    setPage(1);
    setHasMore(true);
    fetchData(1, true);
  }, [startDate, endDate, searchTerm, statusFilter]);

  useEffect(() => {
    // Setup intersection observer untuk infinite scroll
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading, loadingMore, page]);

  const fetchData = async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let url = `/api/laporan/transaksi?page=${pageNum}&limit=20`;

      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (searchTerm) url += `&search=${searchTerm}`;
      if (statusFilter !== "all") url += `&statusPembayaran=${statusFilter}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        if (reset) {
          setPenjualanList(data.data);
        } else {
          setPenjualanList((prev) => [...prev, ...data.data]);
        }

        setHasMore(data.pagination.hasMore);
        setStats(data.stats.overall);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Gagal mengambil data transaksi");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage, false);
  };

  const handleViewDetail = (penjualan: PenjualanHeader) => {
    setSelectedPenjualan(penjualan);
    setShowDetailModal(true);
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
    setStatusFilter("all");
  };

  const handleExport = async (
    format: "excel" | "pdf",
    period: "monthly" | "yearly" | "current" = "current"
  ) => {
    if (format === "excel") {
      setExportingExcel(true);
    } else {
      setExportingPDF(true);
    }

    try {
      let url = `/api/laporan/transaksi/export?format=${format}&period=${period}`;

      // Default: detail=true (breakdown per item)
      url += `&detail=true`;

      // Untuk monthly dan yearly, gunakan tanggal saat ini
      if (period === "monthly" || period === "yearly") {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");

        if (period === "monthly") {
          // Bulan ini
          const firstDay = `${year}-${month}-01`;
          const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
          const lastDayFormatted = `${year}-${month}-${String(lastDay).padStart(
            2,
            "0"
          )}`;
          url += `&startDate=${firstDay}&endDate=${lastDayFormatted}`;
        } else {
          // Tahunan - full year
          url += `&year=${year}`;
        }
      } else {
        // Current filter
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        if (searchTerm) url += `&search=${searchTerm}`;
      }

      const res = await fetch(url);
      const blob = await res.blob();

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      let filename = "Laporan-Transaksi";
      if (period === "monthly") {
        const now = new Date();
        const monthName = now.toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric",
        });
        filename += `-Detail-${monthName}`;
      } else if (period === "yearly") {
        filename += `-Tahunan-${new Date().getFullYear()}`;
      } else {
        filename += "-Detail";
      }
      filename += `-${Date.now()}.${format === "excel" ? "xlsx" : "pdf"}`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`Laporan ${format.toUpperCase()} berhasil didownload`);
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Gagal export laporan");
    } finally {
      setExportingExcel(false);
      setExportingPDF(false);
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

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTotalLabaPenjualan = (penjualan: PenjualanHeader): number => {
    return penjualan.items?.reduce((sum, item) => sum + item.laba, 0) || 0;
  };

  const getTotalModalPenjualan = (penjualan: PenjualanHeader): number => {
    return (
      penjualan.items?.reduce((sum, item) => {
        const modalDus = item.hargaBeli * item.jumlahDus;
        const modalPcs =
          item.jumlahPcs > 0
            ? Math.round(
                (item.hargaBeli / item.barang.jumlahPerkardus) * item.jumlahPcs
              )
            : 0;
        return sum + modalDus + modalPcs;
      }, 0) || 0
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Laporan Transaksi
            </h1>
            <p className="text-blue-100">
              Analisis detail setiap transaksi penjualan
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("excel", "monthly")}
              disabled={exportingExcel}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              {exportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Excel Bulan Ini
            </button>
            <button
              onClick={() => handleExport("excel", "yearly")}
              disabled={exportingExcel}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              {exportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Excel Tahunan
            </button>
            <button
              onClick={() => handleExport("pdf", "current")}
              disabled={exportingPDF}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              {exportingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              PDF
            </button>
          </div>
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
            {formatRupiah(stats.totalPenjualan)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.jumlahTransaksi} transaksi
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Modal</p>
            <Package className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatRupiah(stats.totalModal)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{stats.jumlahItem} item</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Laba</p>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            {formatRupiah(stats.totalLaba)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Keuntungan bersih</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Margin</p>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {stats.marginPersen.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Persentase keuntungan</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Terjual</p>
            <Package className="w-8 h-8 text-indigo-500" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {stats.totalDus?.toLocaleString() || 0} dus
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.totalPcs?.toLocaleString() || 0} pcs
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-md border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari kode transaksi atau customer..."
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
              />
            </div>
            <span className="flex items-center text-gray-500">-</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="LUNAS">Lunas</option>
            <option value="HUTANG">Hutang</option>
          </select>

          {(startDate || endDate || searchTerm || statusFilter !== "all") && (
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
                    Modal
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Laba
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Margin
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
                {penjualanList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Tidak ada data transaksi</p>
                    </td>
                  </tr>
                ) : (
                  penjualanList.map((pj) => {
                    const totalLaba = getTotalLabaPenjualan(pj);
                    const totalModal = getTotalModalPenjualan(pj);
                    const margin =
                      pj.totalHarga > 0 ? (totalLaba / pj.totalHarga) * 100 : 0;

                    return (
                      <tr
                        key={pj.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">
                            {pj.kodePenjualan}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(pj.tanggalTransaksi)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">
                            {pj.customer?.nama || pj.namaCustomer || "-"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                          {formatRupiah(pj.totalHarga)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-orange-600">
                          {formatRupiah(totalModal)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                          {formatRupiah(totalLaba)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              margin >= 30
                                ? "bg-green-100 text-green-700"
                                : margin >= 20
                                ? "bg-blue-100 text-blue-700"
                                : margin >= 10
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              pj.statusPembayaran === "LUNAS"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {pj.statusPembayaran}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleViewDetail(pj)}
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
      {showDetailModal && selectedPenjualan && (
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
                <h2 className="text-xl font-bold text-white">
                  Detail Transaksi
                </h2>
                <p className="text-blue-100 text-sm">
                  {selectedPenjualan.kodePenjualan}
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
                  <p className="text-sm text-gray-500">Tanggal</p>
                  <p className="font-semibold">
                    {formatDateTime(selectedPenjualan.tanggalTransaksi)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-semibold">
                    {selectedPenjualan.customer?.nama ||
                      selectedPenjualan.namaCustomer ||
                      "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status Pembayaran</p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      selectedPenjualan.statusPembayaran === "LUNAS"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {selectedPenjualan.statusPembayaran}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Item</p>
                  <p className="font-semibold">
                    {selectedPenjualan.items?.length || 0} item
                  </p>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-3">
                Detail Per Item
              </h3>
              <div className="border rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Barang</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Harga Jual</th>
                      <th className="px-3 py-2 text-right">Modal</th>
                      <th className="px-3 py-2 text-right">Laba</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedPenjualan.items?.map((item) => {
                      const modalDus = item.hargaBeli * item.jumlahDus;
                      const modalPcs =
                        item.jumlahPcs > 0
                          ? Math.round(
                              (item.hargaBeli / item.barang.jumlahPerkardus) *
                                item.jumlahPcs
                            )
                          : 0;
                      const totalModal = modalDus + modalPcs;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <p className="font-medium">
                              {item.barang?.namaBarang}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.jumlahDus > 0 && (
                              <span>{item.jumlahDus} dus</span>
                            )}
                            {item.jumlahPcs > 0 && (
                              <span className="text-gray-500">
                                {" "}
                                +{item.jumlahPcs} pcs
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatRupiah(item.hargaJual)}
                          </td>
                          <td className="px-3 py-2 text-right text-orange-600">
                            {formatRupiah(totalModal)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-green-600">
                            {formatRupiah(item.laba)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total Penjualan</span>
                  <span className="text-blue-600">
                    {formatRupiah(selectedPenjualan.totalHarga)}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total Modal</span>
                  <span className="text-orange-600">
                    {formatRupiah(getTotalModalPenjualan(selectedPenjualan))}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total Laba</span>
                  <span className="text-green-600">
                    {formatRupiah(getTotalLabaPenjualan(selectedPenjualan))}
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

export default LaporanTransaksiPage;
