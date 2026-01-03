"use client";
import React, { useState } from "react";
import {
  Calendar,
  FileSpreadsheet,
  Download,
  TrendingUp,
  ShoppingCart,
  Loader2,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const toInputDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultDate = (): string => toInputDate(new Date());

const LaporanLengkapPage = () => {
  const [reportDate, setReportDate] = useState<string>(() => getDefaultDate());
  const [exporting, setExporting] = useState<boolean>(false);

  const handleExport = async () => {
    setExporting(true);

    try {
      let url = `/api/laporan/kasir`;

      const params = new URLSearchParams();
      if (reportDate) params.append("date", reportDate);

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

      let filename = "Laporan-Kasir";
      if (reportDate) {
        filename += `-${reportDate}`;
      }
      filename += `-${Date.now()}.pdf`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Laporan kasir berhasil didownload!");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Gagal export laporan kasir");
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
            Laporan Kasir Harian (PDF)
          </h1>
          <p className="text-blue-100 text-lg">
            Download ringkasan penjualan, pembayaran piutang, pengeluaran,
            kerugian, dan setoran harian
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-purple-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ringkasan</p>
              <p className="font-semibold text-gray-900">Penjualan & Piutang</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pengeluaran</p>
              <p className="font-semibold text-gray-900">Operasional Harian</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Setoran</p>
              <p className="font-semibold text-gray-900">Harus Dibayar</p>
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
          {/* Date Filter */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Tanggal Laporan
            </label>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-2">
                  Tanggal
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Selected Period Display */}
            {reportDate && (
              <div className="mt-4 bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Periode yang dipilih:</span>{" "}
                  {formatDate(reportDate)}
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
                    Ringkasan Penjualan
                  </p>
                  <p className="text-xs text-gray-600">
                    Total penjualan harian dari pembayaran
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs font-bold">✓</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Pembayaran Piutang
                  </p>
                  <p className="text-xs text-gray-600">
                    Total pembayaran piutang hari tersebut
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs font-bold">✓</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Pengeluaran Operasional
                  </p>
                  <p className="text-xs text-gray-600">
                    Total pengeluaran yang tercatat
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs font-bold">✓</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Kerugian Barang
                  </p>
                  <p className="text-xs text-gray-600">
                    Barang rusak/kadaluarsa
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs font-bold">✓</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Total Setoran
                  </p>
                  <p className="text-xs text-gray-600">
                    Penjualan + Piutang - Pengeluaran - Kerugian
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
                Download Laporan Kasir (PDF)
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
                <span className="font-semibold">Tips:</span> File PDF yang
                dihasilkan berisi ringkasan harian yang siap dicetak sebagai
                arsip kasir.
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
                Format PDF Rapi
              </p>
              <p className="text-xs text-gray-600">
                Siap dicetak untuk laporan harian
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 text-sm font-bold">2</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                Ringkasan Setoran
              </p>
              <p className="text-xs text-gray-600">
                Total setoran sesuai transaksi hari itu
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 text-sm font-bold">3</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">Detail Harian</p>
              <p className="text-xs text-gray-600">
                Penjualan, piutang, pengeluaran, kerugian
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
