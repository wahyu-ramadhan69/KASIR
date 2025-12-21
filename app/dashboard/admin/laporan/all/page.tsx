"use client";
import React, { useState } from "react";
import {
  Calendar,
  FileSpreadsheet,
  Download,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Loader2,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const LaporanLengkapPage = () => {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [mode, setMode] = useState<"summary" | "detail">("summary");
  const [exporting, setExporting] = useState<boolean>(false);

  const handleExport = async () => {
    setExporting(true);

    try {
      let url = `/api/laporan/all`;

      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("mode", mode); // Add mode parameter

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const blob = await res.blob();

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      let filename = "Laporan-Lengkap";
      if (startDate && endDate) {
        filename += `-${startDate}-sd-${endDate}`;
      } else if (startDate) {
        filename += `-sejak-${startDate}`;
      } else if (endDate) {
        filename += `-sampai-${endDate}`;
      } else {
        filename += "-Semua-Periode";
      }
      filename += `-${Date.now()}.xlsx`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Laporan lengkap berhasil didownload!");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Gagal export laporan lengkap");
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-8 mb-6 shadow-lg">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            <FileSpreadsheet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Laporan Keuangan Lengkap
          </h1>
          <p className="text-blue-100 text-lg">
            Download laporan penjualan, pembelian, dan pengeluaran dalam satu
            file Excel
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Sheet 1</p>
              <p className="font-semibold text-gray-900">Laporan Penjualan</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Sheet 2</p>
              <p className="font-semibold text-gray-900">Laporan Pembelian</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-orange-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Sheet 3</p>
              <p className="font-semibold text-gray-900">Laporan Pengeluaran</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Export Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Filter Periode Laporan
          </h2>
          <p className="text-sm text-gray-600">
            Pilih rentang tanggal untuk laporan yang akan diexport
          </p>
        </div>

        <div className="p-8">
          {/* Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Mode Laporan
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setMode("summary")}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all border-2 ${
                  mode === "summary"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">Summary</div>
                    <div className="text-xs opacity-80">
                      Ringkasan per transaksi
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setMode("detail")}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all border-2 ${
                  mode === "detail"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">Detail</div>
                    <div className="text-xs opacity-80">Breakdown per item</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Periode Tanggal
            </label>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-2">
                  Tanggal Mulai
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex items-end justify-center pb-3">
                <span className="text-gray-400 font-medium">—</span>
              </div>

              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-2">
                  Tanggal Selesai
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Selected Period Display */}
            {(startDate || endDate) && (
              <div className="mt-4 bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Periode yang dipilih:</span>{" "}
                  {startDate && formatDate(startDate)}
                  {startDate && endDate && " s/d "}
                  {endDate && formatDate(endDate)}
                  {!startDate && endDate && `Sampai ${formatDate(endDate)}`}
                  {startDate && !endDate && `Sejak ${formatDate(startDate)}`}
                </p>
              </div>
            )}

            {!startDate && !endDate && (
              <div className="mt-4 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Catatan:</span> Jika tidak
                  memilih tanggal, laporan akan mencakup semua periode
                </p>
              </div>
            )}
          </div>

          {/* What's Included Section */}
          <div className="mb-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Yang Termasuk dalam Laporan:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs font-bold">✓</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Sheet 1: Laporan Penjualan
                  </p>
                  <p className="text-xs text-gray-600">
                    Detail transaksi penjualan dengan laba & margin
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs font-bold">✓</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Sheet 2: Laporan Pembelian
                  </p>
                  <p className="text-xs text-gray-600">
                    Detail pembelian barang dari supplier
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs font-bold">✓</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Sheet 3: Laporan Pengeluaran
                  </p>
                  <p className="text-xs text-gray-600">
                    Detail pengeluaran operasional
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs font-bold">✓</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Sheet 4: Ringkasan
                  </p>
                  <p className="text-xs text-gray-600">
                    Summary keuangan & laba bersih
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs font-bold">✓</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Sheet 5: Laba Barang
                  </p>
                  <p className="text-xs text-gray-600">
                    Summary dari laba per barang
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white py-4 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 text-lg"
          >
            {exporting ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Membuat Laporan...
              </>
            ) : (
              <>
                <Download className="w-6 h-6" />
                Download Laporan Lengkap (Excel)
              </>
            )}
          </button>

          {/* Additional Info */}
          <div className="mt-6 flex items-start gap-3 bg-amber-50 rounded-lg px-4 py-3 border border-amber-200">
            <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-amber-600 text-xs font-bold">i</span>
            </div>
            <div>
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Tips:</span> File Excel yang
                dihasilkan berisi 5 sheet berbeda. Anda dapat membuka dan
                menganalisis setiap sheet secara terpisah di Microsoft Excel
                atau Google Sheets.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features List */}
      <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Fitur Laporan:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 text-sm font-bold">1</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                Professional Formatting
              </p>
              <p className="text-xs text-gray-600">
                Header berwarna, borders, dan number formatting
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 text-sm font-bold">2</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                Grand Total per Sheet
              </p>
              <p className="text-xs text-gray-600">
                Total otomatis di setiap laporan
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 text-sm font-bold">3</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                Summary Keuangan
              </p>
              <p className="text-xs text-gray-600">
                Analisis laba kotor dan laba bersih
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 text-sm font-bold">4</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                Filter Tanggal Fleksibel
              </p>
              <p className="text-xs text-gray-600">
                Pilih periode sesuai kebutuhan
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaporanLengkapPage;
