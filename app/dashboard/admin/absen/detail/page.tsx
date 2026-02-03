"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  RefreshCw,
  Users,
  CreditCard,
  Briefcase,
  LogIn,
  LogOut,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface AbsensiItem {
  id: number;
  karyawanId: number;
  tanggal: string;
  jamMasuk: string | null;
  jamKeluar: string | null;
  status: string;
  catatan: string | null;
  karyawan: {
    id: number;
    nama: string;
    nik: string;
    jenis: string;
  };
}

interface KaryawanInfo {
  id: number;
  nama: string;
  nik: string;
  jenis: string;
}

const AbsenDetailPage = () => {
  const [items, setItems] = useState<AbsensiItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [karyawan, setKaryawan] = useState<KaryawanInfo | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    return `${year}-${month}`;
  });
  const searchParams = useSearchParams();
  const karyawanId = useMemo(() => {
    const raw = searchParams.get("karyawanId");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  const fetchAbsensi = async () => {
    setLoading(true);
    try {
      if (!karyawanId) {
        setItems([]);
        return;
      }
      const res = await fetch(
        `/api/karyawan/absensi/bulanan?month=${selectedMonth}&karyawanId=${karyawanId}`
      );
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.data)) {
        throw new Error(data.error || "Invalid absensi response");
      }
      setItems(data.data);
    } catch (error) {
      console.error("Error fetching absensi bulanan:", error);
      toast.error("Gagal mengambil data absensi bulanan");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchKaryawanInfo = async () => {
    if (!karyawanId) return;
    try {
      const res = await fetch(`/api/karyawan/${karyawanId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengambil data karyawan");
      }
      setKaryawan({
        id: data.id,
        nama: data.nama,
        nik: data.nik,
        jenis: data.jenis,
      });
    } catch (error) {
      console.error("Error fetching karyawan:", error);
      setKaryawan(null);
    }
  };

  useEffect(() => {
    fetchKaryawanInfo();
  }, [karyawanId]);

  useEffect(() => {
    fetchAbsensi();
  }, [selectedMonth, karyawanId]);

  const formatTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (start?: string | null, end?: string | null) => {
    if (!start || !end) return "-";
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return "-";
    }
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs <= 0) return "-";
    const totalMinutes = Math.round(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}j ${minutes}m`;
  };

  const filteredItems = items;

  const buildMonthDays = () => {
    if (!selectedMonth) return [];
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) return [];
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const days: Date[] = [];
    const current = new Date(start);
    while (current < end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const formatDayLabel = (date: Date) =>
    new Intl.DateTimeFormat("id-ID", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);

  const monthlyRows = (() => {
    const absensiByDate = new Map<string, AbsensiItem>();
    for (const item of filteredItems) {
      const key = new Date(item.tanggal).toISOString().slice(0, 10);
      absensiByDate.set(key, item);
    }
    return buildMonthDays().map((date) => {
      const key = date.toISOString().slice(0, 10);
      const data = absensiByDate.get(key);
      return { date, data };
    });
  })();

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full px-6 pb-8">
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
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-8 mb-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
                <Users className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                  Detail Absensi Bulanan
                </h1>
                <p className="text-blue-100 text-lg">
                  Rekap check-in dan check-out per bulan
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                href="/dashboard/admin/absen"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-xl transition-all shadow-lg"
              >
                Kembali
              </Link>
              <button
                onClick={fetchAbsensi}
                disabled={loading}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg"
              >
                <RefreshCw
                  className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                  {(karyawan?.nama ?? "K").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-gray-900 font-semibold">
                    {karyawan?.nama ?? "Karyawan"}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <span className="font-mono">
                      {karyawan?.nik ?? "-"}
                    </span>
                    {karyawan?.jenis && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        <Briefcase className="w-3 h-3" />
                        {karyawan.jenis}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="text-center">
              <div className="relative">
                <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                <Users className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-gray-500 mt-6 text-lg font-medium">
                Memuat data absensi bulanan...
              </p>
            </div>
          </div>
        ) : !karyawanId ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
            <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg font-medium">
              Karyawan belum dipilih
            </p>
          </div>
        ) : monthlyRows.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
            <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg font-medium">
              Tidak ada data absensi
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                      Tanggal
                    </th>
                    <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                      Nama
                    </th>
                    <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                      NIK
                    </th>
                    <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                      Jenis
                    </th>
                    <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                      Jam Masuk
                    </th>
                    <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                      Jam Keluar
                    </th>
                    <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                      Jam Kerja
                    </th>
                    <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {monthlyRows.map(({ date, data }) => {
                    const day = date.getDay();
                    const isSunday = day === 0;
                    return (
                      <tr
                        key={date.toISOString()}
                        className="hover:bg-blue-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          {formatDayLabel(date)}
                        </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                            {(data?.karyawan.nama ?? karyawan?.nama ?? "K")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900">
                            {data?.karyawan.nama ?? karyawan?.nama ?? "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          <span className="font-mono text-sm text-gray-700">
                            {data?.karyawan.nik ?? karyawan?.nik ?? "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                            (data?.karyawan.jenis ?? karyawan?.jenis) === "KASIR"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          <Briefcase className="w-3 h-3" />
                          {data?.karyawan.jenis ?? karyawan?.jenis ?? "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-green-700 font-semibold">
                          <LogIn className="w-4 h-4" />
                          {data ? formatTime(data.jamMasuk) : "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-orange-700 font-semibold">
                          <LogOut className="w-4 h-4" />
                          {data ? formatTime(data.jamKeluar) : "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-700">
                          {data
                            ? formatDuration(data.jamMasuk, data.jamKeluar)
                            : "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-700">
                          {data?.status ?? (isSunday ? "LIBUR" : "-")}
                        </span>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AbsenDetailPage;
