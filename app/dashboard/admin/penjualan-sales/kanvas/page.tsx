"use client";
import { useState, useEffect } from "react";
import {
  Truck,
  MapPin,
  Calendar,
  User,
  FileText,
  RefreshCw,
  Plus,
  ArrowLeft,
  Package,
  ShoppingCart,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Undo,
  Undo2,
  Edit,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface Karyawan {
  id: number;
  nama: string;
  nik: string;
}

interface PerjalananSales {
  id: number;
  kodePerjalanan: string;
  karyawan: Karyawan;
  kotaTujuan: string;
  tanggalBerangkat: string;
  tanggalKembali: string | null;
  statusPerjalanan: string;
  keterangan: string | null;
  manifestBarang: any[];
  penjualanHeaders: any[];
  pengembalianBarang: any[];
  createdAt: string;
}

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; border: string; icon: any }
> = {
  PERSIAPAN: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: Clock,
  },
  DI_PERJALANAN: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    icon: Truck,
  },
  KEMBALI: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    icon: AlertCircle,
  },
  SELESAI: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    icon: CheckCircle2,
  },
  DIBATALKAN: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    icon: XCircle,
  },
};

const STATUS_COLUMNS = ["DI_PERJALANAN", "KEMBALI", "SELESAI"];

const DaftarPerjalananPage = () => {
  const [perjalananList, setPerjalananList] = useState<PerjalananSales[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showKembaliModal, setShowKembaliModal] = useState(false);
  const [showBatalkanModal, setShowBatalkanModal] = useState(false);
  const [selectedPerjalananId, setSelectedPerjalananId] = useState<
    number | null
  >(null);
  const [selectedPerjalananDetail, setSelectedPerjalananDetail] =
    useState<PerjalananSales | null>(null);
  const [perjalananToBatal, setPerjalananToBatal] =
    useState<PerjalananSales | null>(null);

  useEffect(() => {
    fetchPerjalanan();
  }, []);

  const fetchPerjalanan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/penjualan-luar-kota?page=1&limit=100");
      const data = await res.json();
      if (data.success) {
        // Fetch detail untuk setiap perjalanan agar mendapatkan pengembalianBarang
        const perjalananWithDetails = await Promise.all(
          data.data.perjalanan.map(async (p: PerjalananSales) => {
            try {
              const detailRes = await fetch(`/api/penjualan-luar-kota/${p.id}`);
              const detailData = await detailRes.json();
              if (detailData.success) {
                return detailData.data;
              }
              return p;
            } catch (error) {
              console.error(`Error fetching detail for ${p.id}:`, error);
              return p;
            }
          })
        );

        // Filter out DIBATALKAN and PERSIAPAN from kanban
        setPerjalananList(
          perjalananWithDetails.filter(
            (p: PerjalananSales) =>
              p.statusPerjalanan !== "DIBATALKAN" &&
              p.statusPerjalanan !== "PERSIAPAN"
          )
        );
      }
    } catch (error) {
      console.error("Error fetching perjalanan:", error);
      toast.error("Gagal mengambil data perjalanan");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    // Untuk status KEMBALI, tampilkan modal
    if (newStatus === "KEMBALI") {
      setSelectedPerjalananId(id);
      setShowKembaliModal(true);
      return;
    }

    // Untuk status lain, gunakan konfirmasi biasa
    if (!confirm(`Ubah status menjadi ${newStatus}?`)) return;

    await updateStatus(id, newStatus);
  };

  const updateStatus = async (id: number, newStatus: string) => {
    setLoading(true);
    try {
      const body: any = { status: newStatus };

      if (newStatus === "KEMBALI") {
        body.tanggalKembali = new Date().toISOString();
      }

      const res = await fetch(`/api/penjualan-luar-kota/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchPerjalanan();
        setShowKembaliModal(false);
        setSelectedPerjalananId(null);
      } else {
        toast.error(data.message || "Gagal mengubah status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmKembali = () => {
    if (selectedPerjalananId) {
      updateStatus(selectedPerjalananId, "KEMBALI");
    }
  };

  const handleCancelKembali = () => {
    setShowKembaliModal(false);
    setSelectedPerjalananId(null);
  };

  const handleOpenDetail = (perjalanan: PerjalananSales) => {
    setSelectedPerjalananDetail(perjalanan);
    setShowDetailModal(true);
  };

  const handleCloseDetail = () => {
    setShowDetailModal(false);
    setSelectedPerjalananDetail(null);
  };

  const handleOpenBatalkanModal = (perjalanan: PerjalananSales) => {
    setPerjalananToBatal(perjalanan);
    setShowBatalkanModal(true);
  };

  const handleCloseBatalkanModal = () => {
    setShowBatalkanModal(false);
    setPerjalananToBatal(null);
  };

  const handleConfirmBatalkan = async () => {
    if (!perjalananToBatal) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/penjualan-luar-kota/${perjalananToBatal.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success("Perjalanan berhasil dibatalkan dan stok dikembalikan");
        fetchPerjalanan();
        handleCloseBatalkanModal();
      } else {
        toast.error(data.message || "Gagal membatalkan perjalanan");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleBatalkanPerjalanan = async () => {
    if (!selectedPerjalananDetail) return;
    if (
      !confirm(
        "Apakah Anda yakin ingin membatalkan perjalanan ini? Stok barang akan dikembalikan."
      )
    )
      return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/penjualan-luar-kota/${selectedPerjalananDetail.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success("Perjalanan berhasil dibatalkan dan stok dikembalikan");
        fetchPerjalanan();
        handleCloseDetail();
      } else {
        toast.error(data.message || "Gagal membatalkan perjalanan");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getPerjalananbByStatus = (status: string) => {
    const filtered = perjalananList.filter(
      (p) => p.statusPerjalanan === status
    );

    // Untuk status SELESAI, hanya tampilkan data hari ini
    if (status === "SELESAI") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return filtered.filter((p) => {
        // Gunakan tanggalKembali jika ada, jika tidak ada gunakan createdAt
        const checkDate = p.tanggalKembali
          ? new Date(p.tanggalKembali)
          : new Date(p.createdAt);
        checkDate.setHours(0, 0, 0, 0);
        return checkDate.getTime() === today.getTime();
      });
    }

    // Untuk DI_PERJALANAN dan KEMBALI, tampilkan semua data
    return filtered;
  };

  return (
    <div className="w-full min-h-[calc(100vh-6rem)] max-h-[calc(100vh-6rem)] overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#363636",
            color: "#fff",
            borderRadius: "12px",
            padding: "12px 16px",
          },
          success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
        }}
      />

      {/* Header */}
      <div className="mx-3 mb-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-5 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-lg shadow-lg">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Daftar Perjalanan Sales
                </h1>
                <p className="text-blue-100 text-sm">
                  Kelola perjalanan sales ke luar kota
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchPerjalanan}
                disabled={loading}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <Link
                href="/dashboard/admin/penjualan-sales/luar-kota"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
              >
                <Plus className="w-4 h-4" />
                Buat Perjalanan
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden p-3 min-h-0">
        <div className="flex gap-3 h-full">
          {STATUS_COLUMNS.map((status) => {
            const perjalanans = getPerjalananbByStatus(status);
            const statusColor = STATUS_COLORS[status];
            const StatusIcon = statusColor.icon;

            return (
              <div
                key={status}
                className="flex-1 bg-white rounded-xl shadow-lg border-2 border-gray-200 flex flex-col overflow-hidden"
              >
                {/* Column Header */}
                <div
                  className={`p-2 ${statusColor.bg} border-b-2 ${statusColor.border}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded-lg ${statusColor.bg} border ${statusColor.border}`}
                      >
                        <StatusIcon className={`w-4 h-4 ${statusColor.text}`} />
                      </div>
                      <h3
                        className={`font-bold ${statusColor.text} uppercase text-xs tracking-wider`}
                      >
                        {status === "DI_PERJALANAN"
                          ? "EKSPEDISI"
                          : status === "KEMBALI"
                          ? "KEMBALI KE GUDANG"
                          : status}
                      </h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}
                    >
                      {perjalanans.length}
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 bg-linear-to-br from-gray-50 to-gray-100/50">
                  {perjalanans.map((perjalanan) => {
                    return (
                      <div
                        key={perjalanan.id}
                        className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-xl transition-all group"
                      >
                        <div className="p-2.5">
                          {/* Card Header */}
                          <div className="mb-2.5">
                            <h4 className="font-bold text-gray-900 text-sm mb-2 group-hover:text-blue-600 transition-colors">
                              {perjalanan.kodePerjalanan}
                            </h4>
                            {/* Info Grid - 2 baris */}
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span className="font-medium truncate">
                                  {perjalanan.karyawan.nama}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                <span className="font-medium truncate">
                                  {perjalanan.kotaTujuan}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                <Calendar className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                <span className="font-medium">
                                  {formatDate(perjalanan.tanggalBerangkat)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                <span className="font-medium">
                                  {perjalanan.tanggalKembali
                                    ? formatDate(perjalanan.tanggalKembali)
                                    : "-"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-2 mb-2.5 pb-2.5 border-b border-gray-200">
                            <div className="bg-blue-50 rounded-lg p-2 text-center">
                              <Package className="w-3.5 h-3.5 text-blue-600 mx-auto mb-1" />
                              <p className="text-xs font-bold text-blue-700">
                                {perjalanan.manifestBarang?.length || 0}
                              </p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-2 text-center">
                              <ShoppingCart className="w-3.5 h-3.5 text-green-600 mx-auto mb-1" />
                              <p className="text-xs font-bold text-green-700">
                                {perjalanan.penjualanHeaders?.length || 0}
                              </p>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-2 text-center">
                              <Package className="w-3.5 h-3.5 text-purple-600 mx-auto mb-1" />
                              <p className="text-xs font-bold text-purple-700">
                                {perjalanan.pengembalianBarang?.length || 0}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons - Single Row */}
                          <div className="space-y-2">
                            {/* Untuk kolom EKSPEDISI (DI_PERJALANAN): tombol Edit, Kembali dan Batalkan */}
                            {perjalanan.statusPerjalanan ===
                              "DI_PERJALANAN" && (
                              <>
                                <Link
                                  href={`/dashboard/admin/penjualan-sales/luar-kota/${perjalanan.id}/edit`}
                                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  Edit Manifest
                                </Link>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      handleUpdateStatus(
                                        perjalanan.id,
                                        "KEMBALI"
                                      )
                                    }
                                    disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                                  >
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Pulang
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleOpenBatalkanModal(perjalanan)
                                    }
                                    disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    Batalkan
                                  </button>
                                </div>
                              </>
                            )}

                            {/* Untuk kolom KEMBALI KE GUDANG: hanya tombol Rekonsiliasi */}
                            {perjalanan.statusPerjalanan === "KEMBALI" && (
                              <button
                                onClick={() => handleOpenDetail(perjalanan)}
                                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-3 rounded-lg font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Rekonsiliasi
                              </button>
                            )}

                            {/* Untuk kolom SELESAI: tombol Detail */}
                            {perjalanan.statusPerjalanan === "SELESAI" && (
                              <button
                                onClick={() => handleOpenDetail(perjalanan)}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Detail
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {perjalanans.length === 0 && (
                    <div className="text-center py-4 text-gray-400">
                      <p className="text-xs font-medium">
                        Tidak ada perjalanan
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Konfirmasi Kembali ke Gudang */}
      {showKembaliModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn border border-gray-200">
            {/* Header */}
            <div className="bg-linear-to-r from-blue-600 to-indigo-600 p-5">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Konfirmasi Kembali ke Gudang
                  </h3>
                  <p className="text-blue-100 text-sm">
                    Pastikan data sudah benar
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-700 text-base leading-relaxed mb-6">
                Apakah Anda yakin ingin mengubah status perjalanan ini menjadi{" "}
                <span className="font-bold text-blue-700">
                  "Kembali ke Gudang"
                </span>
                ?
              </p>
              <p className="text-sm text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <strong className="text-blue-700">Catatan:</strong> Tanggal
                kembali akan diset ke waktu saat ini.
              </p>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t border-gray-200">
              <button
                onClick={handleCancelKembali}
                disabled={loading}
                className="px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmKembali}
                disabled={loading}
                className="px-4 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Pulang Ke Gudang
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Pembatalan Perjalanan */}
      {showBatalkanModal && perjalananToBatal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn border border-gray-200">
            {/* Header */}
            <div className="bg-linear-to-r from-red-600 to-red-700 p-5">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-lg">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Konfirmasi Pembatalan Perjalanan
                  </h3>
                  <p className="text-red-100 text-sm">
                    Tindakan ini tidak dapat dibatalkan
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 text-base leading-relaxed mb-2">
                  Apakah Anda yakin ingin membatalkan perjalanan{" "}
                  <span className="font-bold text-red-700">
                    {perjalananToBatal.kodePerjalanan}
                  </span>
                  ?
                </p>
                <p className="text-gray-600 text-sm">
                  Sales:{" "}
                  <span className="font-semibold">
                    {perjalananToBatal.karyawan.nama}
                  </span>
                  <br />
                  Tujuan:{" "}
                  <span className="font-semibold">
                    {perjalananToBatal.kotaTujuan}
                  </span>
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong className="text-red-900">Perhatian:</strong>
                </p>
                <ul className="text-sm text-red-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Semua stok barang akan dikembalikan ke gudang</li>
                  <li>Data perjalanan akan dihapus permanen</li>
                  <li>Tindakan ini tidak dapat dibatalkan</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t border-gray-200">
              <button
                onClick={handleCloseBatalkanModal}
                disabled={loading}
                className="px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmBatalkan}
                disabled={loading}
                className="px-4 py-2.5 bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Ya, Batalkan Perjalanan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Perjalanan */}
      {showDetailModal && selectedPerjalananDetail && (
        <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-200">
            {/* Header */}
            <div className="bg-linear-to-r from-blue-600 to-indigo-600 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-lg">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Detail Perjalanan Sales
                  </h3>
                  <p className="text-blue-100 text-sm">
                    {selectedPerjalananDetail.kodePerjalanan}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseDetail}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-all"
              >
                <XCircle className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6">
              {/* Info Utama */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-5 h-5 text-blue-600" />
                    <h4 className="font-bold text-blue-900">Sales</h4>
                  </div>
                  <p className="text-gray-800 font-semibold">
                    {selectedPerjalananDetail.karyawan.nama}
                  </p>
                  <p className="text-sm text-gray-600">
                    NIK: {selectedPerjalananDetail.karyawan.nik}
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-5 h-5 text-red-600" />
                    <h4 className="font-bold text-red-900">Tujuan</h4>
                  </div>
                  <p className="text-gray-800 font-semibold">
                    {selectedPerjalananDetail.kotaTujuan}
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                    <h4 className="font-bold text-green-900">
                      Tanggal Berangkat
                    </h4>
                  </div>
                  <p className="text-gray-800 font-semibold">
                    {formatDate(selectedPerjalananDetail.tanggalBerangkat)}
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-orange-600" />
                    <h4 className="font-bold text-orange-900">
                      Tanggal Kembali
                    </h4>
                  </div>
                  <p className="text-gray-800 font-semibold">
                    {selectedPerjalananDetail.tanggalKembali
                      ? formatDate(selectedPerjalananDetail.tanggalKembali)
                      : "Belum kembali"}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="mb-6">
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold ${
                    STATUS_COLORS[selectedPerjalananDetail.statusPerjalanan]?.bg
                  } ${
                    STATUS_COLORS[selectedPerjalananDetail.statusPerjalanan]
                      ?.text
                  } ${
                    STATUS_COLORS[selectedPerjalananDetail.statusPerjalanan]
                      ?.border
                  } border-2`}
                >
                  {(() => {
                    const StatusIcon =
                      STATUS_COLORS[selectedPerjalananDetail.statusPerjalanan]
                        ?.icon;
                    return StatusIcon ? (
                      <StatusIcon className="w-5 h-5" />
                    ) : null;
                  })()}
                  Status:{" "}
                  {selectedPerjalananDetail.statusPerjalanan.replace("_", " ")}
                </div>
              </div>

              {/* Keterangan */}
              {selectedPerjalananDetail.keterangan && (
                <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    Keterangan
                  </h4>
                  <p className="text-gray-700">
                    {selectedPerjalananDetail.keterangan}
                  </p>
                </div>
              )}

              {/* Manifest Barang */}
              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Manifest Barang (
                  {selectedPerjalananDetail.manifestBarang?.length || 0})
                </h4>
                {selectedPerjalananDetail.manifestBarang?.length > 0 ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-100">
                        <tr>
                          <th className="px-4 py-2 text-left font-bold text-blue-900">
                            No
                          </th>
                          <th className="px-4 py-2 text-left font-bold text-blue-900">
                            Nama Barang
                          </th>
                          <th className="px-4 py-2 text-center font-bold text-blue-900">
                            Barang Dibawa
                          </th>
                          <th className="px-4 py-2 text-center font-bold text-blue-900">
                            Satuan
                          </th>
                          <th className="px-4 py-2 text-right font-bold text-blue-900">
                            Total Item Dibawa
                          </th>
                          <th className="px-4 py-2 text-right font-bold text-blue-900">
                            Sisa
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPerjalananDetail.manifestBarang.map(
                          (item: any, idx: number) => {
                            const jenisKemasan =
                              item.barang?.jenisKemasan || "Dus";
                            const satuan = item.barang?.satuan || "Pcs";
                            const ukuran = Number(item.barang?.ukuran || 0);
                            const jumlahPerKemasan = Number(
                              item.barang?.jumlahPerKemasan || 1
                            );
                            const jumlahDibawa = Number(item.jumlahDibawa || 0);
                            const totalItem = Number(item.totalItem || 0);

                            // Hitung jumlah kemasan: jumlahDibawa / jumlahPerKemasan
                            const jumlahKemasan =
                              jumlahPerKemasan > 0
                                ? Math.floor(jumlahDibawa / jumlahPerKemasan)
                                : 0;

                            // Tampilkan ukuran dan satuan dari barang
                            const satuanDisplay =
                              ukuran > 0 ? `${ukuran} ${satuan}` : satuan;

                            return (
                              <tr
                                key={idx}
                                className="border-t border-blue-200"
                              >
                                <td className="px-4 py-2 text-gray-700">
                                  {idx + 1}
                                </td>
                                <td className="px-4 py-2 text-gray-700">
                                  {item.barang?.namaBarang || "-"}
                                </td>
                                <td className="px-4 py-2 text-center text-gray-700 font-semibold">
                                  {jumlahKemasan} {jenisKemasan}
                                </td>
                                <td className="px-4 py-2 text-center text-gray-700 font-semibold">
                                  {satuanDisplay}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-700 font-semibold">
                                  {jumlahDibawa} item
                                </td>
                                <td className="px-4 py-2 text-right text-gray-700 font-semibold">
                                  {totalItem} item
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">
                    Tidak ada barang dalam manifest
                  </p>
                )}
              </div>

              {/* Penjualan */}
              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-green-600" />
                  Transaksi Penjualan (
                  {selectedPerjalananDetail.penjualanHeaders?.length || 0})
                </h4>
                {selectedPerjalananDetail.penjualanHeaders?.length > 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-green-100">
                        <tr>
                          <th className="px-4 py-2 text-left font-bold text-green-900">
                            No
                          </th>
                          <th className="px-4 py-2 text-left font-bold text-green-900">
                            Kode Penjualan
                          </th>
                          <th className="px-4 py-2 text-right font-bold text-green-900">
                            Total Harga
                          </th>
                          <th className="px-4 py-2 text-center font-bold text-green-900">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPerjalananDetail.penjualanHeaders.map(
                          (item: any, idx: number) => (
                            <tr key={idx} className="border-t border-green-200">
                              <td className="px-4 py-2 text-gray-700">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-2 text-gray-700">
                                {item.kodePenjualan || "-"}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-700 font-semibold">
                                Rp{" "}
                                {(item.totalHarga || 0).toLocaleString("id-ID")}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <span className="px-2 py-1 bg-green-200 text-green-800 rounded text-xs font-bold">
                                  {item.status || "-"}
                                </span>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">
                    Belum ada transaksi penjualan
                  </p>
                )}
              </div>

              {/* Pengembalian Barang */}
              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Undo className="w-5 h-5 text-purple-600" />
                  Pengembalian Barang (
                  {selectedPerjalananDetail.pengembalianBarang?.length || 0})
                </h4>
                {selectedPerjalananDetail.pengembalianBarang?.length > 0 ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-purple-100">
                        <tr>
                          <th className="px-4 py-2 text-left font-bold text-purple-900">
                            No
                          </th>
                          <th className="px-4 py-2 text-left font-bold text-purple-900">
                            Nama Barang
                          </th>
                          <th className="px-4 py-2 text-center font-bold text-purple-900">
                            Barang Dikembalikan
                          </th>
                          <th className="px-4 py-2 text-center font-bold text-purple-900">
                            Satuan
                          </th>
                          <th className="px-4 py-2 text-right font-bold text-purple-900">
                            Total item
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPerjalananDetail.pengembalianBarang.map(
                          (item: any, idx: number) => {
                            const jenisKemasan =
                              item.barang?.jenisKemasan || "Dus";
                            const satuan = item.barang?.satuan || "Pcs";
                            const ukuran = Number(item.barang?.ukuran || 0);
                            const jumlahPerKemasan = Number(
                              item.barang?.jumlahPerKemasan || 1
                            );

                            // Total item = jumlahDus * jumlahPerKemasan + jumlahPcs
                            const totalItem =
                              Number(item.jumlahDus || 0) * jumlahPerKemasan +
                              Number(item.jumlahPcs || 0);

                            // Hitung jumlah kemasan: totalItem / jumlahPerKemasan
                            const jumlahKemasan =
                              jumlahPerKemasan > 0
                                ? Math.floor(totalItem / jumlahPerKemasan)
                                : 0;

                            // Tampilkan ukuran dan satuan dari barang
                            const satuanDisplay =
                              ukuran > 0 ? `${ukuran} ${satuan}` : satuan;

                            return (
                              <tr
                                key={idx}
                                className="border-t border-purple-200"
                              >
                                <td className="px-4 py-2 text-gray-700">
                                  {idx + 1}
                                </td>
                                <td className="px-4 py-2 text-gray-700">
                                  {item.barang?.namaBarang || "-"}
                                </td>
                                <td className="px-4 py-2 text-center text-gray-700 font-semibold">
                                  {jumlahKemasan} {jenisKemasan}
                                </td>
                                <td className="px-4 py-2 text-center text-gray-700 font-semibold">
                                  {satuanDisplay}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-700 font-semibold">
                                  {totalItem} item
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">
                    Tidak ada barang yang dikembalikan
                  </p>
                )}
              </div>
            </div>

            {/* Footer with Action Buttons */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex gap-3 justify-end flex-wrap">
                {/* Tombol Batalkan Perjalanan - hanya untuk status DI_PERJALANAN */}
                {selectedPerjalananDetail.statusPerjalanan ===
                  "DI_PERJALANAN" && (
                  <button
                    onClick={handleBatalkanPerjalanan}
                    disabled={loading}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Batalkan Perjalanan
                  </button>
                )}

                {/* Tombol Catat Transaksi & Pengembalian Barang - hanya untuk status KEMBALI */}
                {selectedPerjalananDetail.statusPerjalanan === "KEMBALI" && (
                  <>
                    <Link
                      href={`/dashboard/admin/penjualan-sales/luar-kota/${selectedPerjalananDetail.id}/transaksi`}
                      className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Catat Transaksi
                    </Link>
                    <Link
                      href={`/dashboard/admin/penjualan-sales/luar-kota/${selectedPerjalananDetail.id}/pengembalian`}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                      <Undo2 className="w-4 h-4" />
                      Pengembalian Barang
                    </Link>
                  </>
                )}

                <button
                  onClick={handleCloseDetail}
                  className="px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DaftarPerjalananPage;
