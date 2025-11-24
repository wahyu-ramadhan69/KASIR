"use client";
import React, { useState, useEffect } from "react";
import {
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Eye,
  X,
  Download,
  RefreshCw,
  Filter,
  ArrowLeft,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface Barang {
  id: number;
  namaBarang: string;
  hargaBeli: number;
  hargaJual: number;
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

interface LabaRugiStats {
  totalPenjualan: number;
  totalModal: number;
  totalLaba: number;
  marginPersen: number;
  jumlahTransaksi: number;
  jumlahItem: number;
}

const LaporanLabaRugiPage = () => {
  const [penjualanList, setPenjualanList] = useState<PenjualanHeader[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<LabaRugiStats>({
    totalPenjualan: 0,
    totalModal: 0,
    totalLaba: 0,
    marginPersen: 0,
    jumlahTransaksi: 0,
    jumlahItem: 0,
  });

  // Filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedPenjualan, setSelectedPenjualan] =
    useState<PenjualanHeader | null>(null);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = "/api/penjualan?status=SELESAI&limit=1000";

      if (startDate) {
        url += `&startDate=${startDate}`;
      }
      if (endDate) {
        url += `&endDate=${endDate}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        const penjualanData = data.data as PenjualanHeader[];
        setPenjualanList(penjualanData);
        calculateStats(penjualanData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Gagal mengambil data penjualan");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: PenjualanHeader[]) => {
    let totalPenjualan = 0;
    let totalModal = 0;
    let totalLaba = 0;
    let jumlahItem = 0;

    data.forEach((penjualan) => {
      totalPenjualan += penjualan.totalHarga;

      penjualan.items?.forEach((item) => {
        jumlahItem += item.jumlahDus;

        // Hitung modal
        const modalDus = item.hargaBeli * item.jumlahDus;
        const modalPcs =
          item.jumlahPcs > 0
            ? Math.round(
                (item.hargaBeli / item.barang.jumlahPerkardus) * item.jumlahPcs
              )
            : 0;
        totalModal += modalDus + modalPcs;

        // Ambil laba yang sudah tersimpan
        totalLaba += item.laba;
      });
    });

    const marginPersen =
      totalPenjualan > 0 ? (totalLaba / totalPenjualan) * 100 : 0;

    setStats({
      totalPenjualan,
      totalModal,
      totalLaba,
      marginPersen,
      jumlahTransaksi: data.length,
      jumlahItem,
    });
  };

  const handleViewDetail = (penjualan: PenjualanHeader) => {
    setSelectedPenjualan(penjualan);
    setShowDetailModal(true);
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
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

  const filteredPenjualan = penjualanList.filter(
    (pj) =>
      pj.kodePenjualan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pj.namaCustomer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pj.customer?.nama.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Hitung total per penjualan
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
      <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/admin/penjualan/riwayat"
              className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Laporan Laba/Rugi Penjualan
              </h1>
              <p className="text-green-100">
                Analisis keuntungan dan margin dari setiap transaksi penjualan
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="bg-white hover:bg-green-50 text-green-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              onClick={() => window.print()}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
          <p className="text-xs text-gray-500 mt-1">
            {stats.jumlahItem} item terjual
          </p>
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
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-md border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari kode transaksi atau customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent outline-none"
            />
          </div>

          {/* Date Range */}
          <div className="flex gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent outline-none"
              />
            </div>
            <span className="flex items-center text-gray-500">-</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {(startDate || endDate || searchTerm) && (
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Kode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Penjualan
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Modal
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Laba
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Margin
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPenjualan.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Tidak ada data penjualan</p>
                    </td>
                  </tr>
                ) : (
                  filteredPenjualan.map((pj) => {
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
                          {pj.customer?.namaToko && (
                            <p className="text-xs text-gray-500">
                              {pj.customer.namaToko}
                            </p>
                          )}
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
                          <button
                            onClick={() => handleViewDetail(pj)}
                            className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all"
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
      </div>

      {/* Summary Footer */}
      {filteredPenjualan.length > 0 && (
        <div className="mt-4 bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 mb-1">Transaksi</p>
              <p className="text-lg font-bold text-gray-900">
                {filteredPenjualan.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Penjualan</p>
              <p className="text-lg font-bold text-blue-600">
                {formatRupiah(
                  filteredPenjualan.reduce((sum, pj) => sum + pj.totalHarga, 0)
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Modal</p>
              <p className="text-lg font-bold text-orange-600">
                {formatRupiah(
                  filteredPenjualan.reduce(
                    (sum, pj) => sum + getTotalModalPenjualan(pj),
                    0
                  )
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Laba</p>
              <p className="text-lg font-bold text-green-600">
                {formatRupiah(
                  filteredPenjualan.reduce(
                    (sum, pj) => sum + getTotalLabaPenjualan(pj),
                    0
                  )
                )}
              </p>
            </div>
          </div>
        </div>
      )}

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
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Detail Laba/Rugi
                </h2>
                <p className="text-green-100 text-sm">
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
              {/* Header Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tanggal Transaksi</p>
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

              {/* Items Table */}
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
                      <th className="px-3 py-2 text-right">Harga Beli</th>
                      <th className="px-3 py-2 text-right">Diskon</th>
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
                            <p className="text-xs text-gray-500">
                              {item.barang?.ukuran} {item.barang?.satuan}
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
                            {formatRupiah(item.hargaBeli)}
                          </td>
                          <td className="px-3 py-2 text-right text-red-500">
                            {item.diskonPerItem > 0
                              ? `-${formatRupiah(
                                  item.diskonPerItem * item.jumlahDus
                                )}`
                              : "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-orange-600">
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

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal Penjualan</span>
                  <span>{formatRupiah(selectedPenjualan.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Diskon Nota</span>
                  <span className="text-red-500">
                    -{formatRupiah(selectedPenjualan.diskonNota)}
                  </span>
                </div>
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
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Margin Keuntungan</span>
                  <span className="font-bold text-purple-600">
                    {selectedPenjualan.totalHarga > 0
                      ? (
                          (getTotalLabaPenjualan(selectedPenjualan) /
                            selectedPenjualan.totalHarga) *
                          100
                        ).toFixed(2)
                      : 0}
                    %
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

export default LaporanLabaRugiPage;
