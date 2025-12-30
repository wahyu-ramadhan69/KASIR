"use client";
import { useState, useEffect } from "react";
import {
  Package,
  Truck,
  MapPin,
  Calendar,
  User,
  ArrowLeft,
  ShoppingCart,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useParams } from "next/navigation";

interface PerjalananDetail {
  id: number;
  kodePerjalanan: string;
  karyawan: {
    id: number;
    nama: string;
    nik: string;
  };
  kotaTujuan: string;
  tanggalBerangkat: string;
  tanggalKembali: string | null;
  statusPerjalanan: string;
  keterangan: string | null;
  manifestBarang: any[];
  penjualanHeaders: any[];
  pengembalianBarang: any[];
  rekonsiliasi?: any[];
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

const DetailPerjalananPage = () => {
  const params = useParams();
  const id = params?.id as string;

  const [perjalanan, setPerjalanan] = useState<PerjalananDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPerjalananDetail();
    }
  }, [id]);

  const fetchPerjalananDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/penjualan-luar-kota/${id}`);
      const data = await res.json();
      if (data.success) {
        setPerjalanan(data.data);
      } else {
        toast.error("Gagal mengambil detail perjalanan");
      }
    } catch (error) {
      console.error("Error fetching detail:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  if (loading) {
    return (
      <div className="w-full min-h-[calc(100vh-6rem)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!perjalanan) {
    return (
      <div className="w-full min-h-[calc(100vh-6rem)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            Perjalanan tidak ditemukan
          </p>
          <Link
            href="/dashboard/admin/penjualan-luar-kota"
            className="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-bold"
          >
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  const statusColor =
    STATUS_COLORS[perjalanan.statusPerjalanan] || STATUS_COLORS.PERSIAPAN;
  const StatusIcon = statusColor.icon;

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
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {perjalanan.kodePerjalanan}
                </h1>
                <p className="text-blue-100 text-sm">Detail Perjalanan Sales</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchPerjalananDetail}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <Link
                href="/dashboard/admin/penjualan-luar-kota"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        <div className="space-y-3">
          {/* Info Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
            <div className="grid grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Status</p>
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusColor.bg} ${statusColor.border} border-2`}
                >
                  <StatusIcon className={`w-4 h-4 ${statusColor.text}`} />
                  <span className={`font-bold text-sm ${statusColor.text}`}>
                    {perjalanan.statusPerjalanan}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Sales
                </p>
                <p className="font-bold text-gray-900">
                  {perjalanan.karyawan.nama}
                </p>
                <p className="text-xs text-gray-500">
                  {perjalanan.karyawan.nik}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Tujuan
                </p>
                <p className="font-bold text-gray-900">
                  {perjalanan.kotaTujuan}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Berangkat
                </p>
                <p className="font-bold text-gray-900 text-sm">
                  {formatDate(perjalanan.tanggalBerangkat)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Kembali
                </p>
                <p className="font-bold text-gray-900 text-sm">
                  {perjalanan.tanggalKembali
                    ? formatDate(perjalanan.tanggalKembali)
                    : "-"}
                </p>
              </div>
            </div>
            {perjalanan.keterangan && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Keterangan</p>
                <p className="text-sm text-gray-900">{perjalanan.keterangan}</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 text-center">
              <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-700">
                {perjalanan.manifestBarang?.length || 0}
              </p>
              <p className="text-sm text-gray-600 font-medium">
                Manifest Barang
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 text-center">
              <ShoppingCart className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-700">
                {perjalanan.penjualanHeaders?.length || 0}
              </p>
              <p className="text-sm text-gray-600 font-medium">
                Transaksi Penjualan
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 text-center">
              <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-700">
                {perjalanan.pengembalianBarang?.length || 0}
              </p>
              <p className="text-sm text-gray-600 font-medium">
                Item Dikembalikan
              </p>
            </div>
          </div>

          {/* Manifest */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Manifest Barang
              </h3>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {perjalanan.manifestBarang?.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div>
                      <p className="font-bold text-gray-900">
                        {item.barang.namaBarang}
                      </p>
                      <p className="text-xs text-gray-600">
                        {item.barang.satuan}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">
                        {item.jumlahDus} dus, {item.jumlahPcs} pcs
                      </p>
                      <p className="text-xs text-gray-600">
                        Total: {item.totalItem} pcs
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/dashboard/admin/penjualan-sales/luar-kota/${id}/transaksi`}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl shadow-lg p-6 text-center transition-all group"
            >
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="font-bold text-lg">Input Transaksi</p>
              <p className="text-sm text-green-100 mt-1">
                {perjalanan.penjualanHeaders?.length || 0} transaksi tercatat
              </p>
            </Link>
            <Link
              href={`/dashboard/admin/penjualan-sales/luar-kota/${id}/pengembalian`}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-lg p-6 text-center transition-all group"
            >
              <Package className="w-10 h-10 mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="font-bold text-lg">Input Pengembalian</p>
              <p className="text-sm text-purple-100 mt-1">
                {perjalanan.pengembalianBarang?.length || 0} item dikembalikan
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailPerjalananPage;
