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
  ArrowLeft,
  CheckCircle,
  FileText,
  AlertCircle,
  X,
  Clock,
  Timer,
  AlarmClock,
  TrendingDown,
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

interface KonfigurasiGaji {
  jamMasukBatas: string; // "HH:mm"
  jamKerjaMenit: number;
}

interface HariKerjaConfig {
  senin: boolean; selasa: boolean; rabu: boolean; kamis: boolean;
  jumat: boolean; sabtu: boolean; minggu: boolean;
}

interface HariLiburItem {
  id: number;
  tanggal: string;
  keterangan: string;
}

type StatusAbsensi = "HADIR" | "IZIN" | "SAKIT" | "ALPHA" | "LIBUR";

const STATUS_CONFIG: Record<
  StatusAbsensi,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  HADIR: {
    label: "Hadir",
    color: "text-green-700",
    bg: "bg-green-100",
    border: "border-green-200",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  IZIN: {
    label: "Izin",
    color: "text-blue-700",
    bg: "bg-blue-100",
    border: "border-blue-200",
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  SAKIT: {
    label: "Sakit",
    color: "text-yellow-700",
    bg: "bg-yellow-100",
    border: "border-yellow-200",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  ALPHA: {
    label: "Alpha",
    color: "text-red-700",
    bg: "bg-red-100",
    border: "border-red-200",
    icon: <X className="w-3.5 h-3.5" />,
  },
  LIBUR: {
    label: "Libur",
    color: "text-purple-700",
    bg: "bg-purple-100",
    border: "border-purple-200",
    icon: <Calendar className="w-3.5 h-3.5" />,
  },
};

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const AbsenDetailPage = () => {
  const [items, setItems] = useState<AbsensiItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [karyawan, setKaryawan] = useState<KaryawanInfo | null>(null);
  const [config, setConfig] = useState<KonfigurasiGaji | null>(null);
  const [hariKerja, setHariKerja] = useState<HariKerjaConfig | null>(null);
  const [hariLiburSet, setHariLiburSet] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
      if (!karyawanId) { setItems([]); return; }
      const res = await fetch(
        `/api/karyawan/absensi/bulanan?month=${selectedMonth}&karyawanId=${karyawanId}`
      );
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.data))
        throw new Error(data.error || "Invalid absensi response");
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
      if (!res.ok) throw new Error(data.error || "Gagal mengambil data karyawan");
      setKaryawan({ id: data.id, nama: data.nama, nik: data.nik, jenis: data.jenis });
    } catch (error) {
      console.error("Error fetching karyawan:", error);
      setKaryawan(null);
    }
  };

  useEffect(() => { fetchKaryawanInfo(); }, [karyawanId]);
  useEffect(() => { fetchAbsensi(); }, [selectedMonth, karyawanId]);
  useEffect(() => {
    const year = selectedMonth.split("-")[0];
    Promise.all([
      fetch("/api/konfigurasi-gaji").then((r) => r.json()),
      fetch("/api/hari-kerja").then((r) => r.json()),
      fetch(`/api/hari-libur?year=${year}`).then((r) => r.json()),
    ]).then(([konfig, hari, libur]) => {
      if (konfig.data) setConfig(konfig.data);
      if (hari.data) setHariKerja(hari.data);
      if (Array.isArray(libur.data)) {
        const keys = new Set<string>(
          (libur.data as HariLiburItem[]).map((h) => toLocalDateKey(new Date(h.tanggal)))
        );
        setHariLiburSet(keys);
      }
    }).catch(() => {});
  }, [selectedMonth]);

  const formatTime = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (start?: string | null, end?: string | null) => {
    if (!start || !end) return null;
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    const diffMs = e.getTime() - s.getTime();
    if (diffMs <= 0) return null;
    const totalMinutes = Math.round(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}j ${minutes}m`;
  };

  const isTerlambat = (jamMasuk: string | null | undefined, tanggal: Date): boolean => {
    if (!jamMasuk || !config) return false;
    const [bH, bM] = config.jamMasukBatas.split(":").map(Number);
    const batas = new Date(tanggal);
    batas.setHours(bH, bM, 0, 0);
    return new Date(jamMasuk) > batas;
  };

  const isKurangJam = (jamMasuk: string | null | undefined, jamKeluar: string | null | undefined): boolean => {
    if (!jamMasuk || !jamKeluar || !config) return false;
    const diffMs = new Date(jamKeluar).getTime() - new Date(jamMasuk).getTime();
    if (diffMs <= 0) return false;
    return Math.floor(diffMs / (1000 * 60)) < config.jamKerjaMenit;
  };

  const isHariLiburFn = (date: Date): boolean => {
    const dayNames = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"] as const;
    const dayKey = dayNames[date.getDay()];
    if (hariKerja && !hariKerja[dayKey]) return true;
    if (!hariKerja) {
      // fallback: Minggu = libur
      if (date.getDay() === 0) return true;
    }
    return hariLiburSet.has(toLocalDateKey(date));
  };

  const buildMonthDays = () => {
    if (!selectedMonth) return [];
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) return [];
    const days: Date[] = [];
    const current = new Date(year, month - 1, 1);
    while (current.getMonth() === month - 1) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const monthlyRows = useMemo(() => {
    const absensiByDate = new Map<string, AbsensiItem>();
    for (const item of items) {
      const key = toLocalDateKey(new Date(item.tanggal));
      absensiByDate.set(key, item);
    }
    return buildMonthDays().map((date) => ({
      date,
      data: absensiByDate.get(toLocalDateKey(date)),
    }));
  }, [items, selectedMonth]);

  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(selectedMonth + "-01T00:00:00"));

  // Stats
  const totalHadir = items.filter((i) => i.status === "HADIR").length;
  const totalIzin = items.filter((i) => i.status === "IZIN").length;
  const totalSakit = items.filter((i) => i.status === "SAKIT").length;
  const totalAlpha = items.filter((i) => i.status === "ALPHA").length;
  const workingDays = monthlyRows.filter((r) => !isHariLiburFn(r.date)).length;
  const totalJamKerja = items.reduce((acc, item) => {
    if (!item.jamMasuk || !item.jamKeluar) return acc;
    const diff = new Date(item.jamKeluar).getTime() - new Date(item.jamMasuk).getTime();
    return diff > 0 ? acc + diff / (1000 * 60 * 60) : acc;
  }, 0);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-indigo-50">
      <div className="w-full px-6 pb-8">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { background: "#1e293b", color: "#fff", borderRadius: "12px" },
            success: { style: { background: "#16a34a" } },
            error: { style: { background: "#dc2626" } },
          }}
        />

        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 rounded-2xl p-8 mb-6 shadow-2xl">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white opacity-5 rounded-full -mr-36 -mt-36" />
          <div className="absolute bottom-0 left-0 w-52 h-52 bg-white opacity-5 rounded-full -ml-26 -mb-26" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                {(karyawan?.nama ?? "K").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-violet-200 text-sm font-medium mb-0.5">Detail Absensi Bulanan</p>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  {karyawan?.nama ?? "Memuat..."}
                </h1>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1.5 text-violet-200 text-sm">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span className="font-mono">{karyawan?.nik ?? "-"}</span>
                  </span>
                  {karyawan?.jenis && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white">
                      <Briefcase className="w-3 h-3" />
                      {karyawan.jenis}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href="/dashboard/admin/absen"
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all font-medium text-sm border border-white/20"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali
              </Link>
              <button
                onClick={fetchAbsensi}
                disabled={loading}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 font-medium text-sm border border-white/20"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Month picker + stats */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
          {/* Month picker */}
          <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 flex flex-col justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Bulan</p>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 pointer-events-none" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-400 focus:border-transparent outline-none text-sm font-semibold transition-all"
              />
            </div>
            <p className="text-sm font-semibold text-gray-600 mt-2">{monthLabel}</p>
          </div>

          {/* Hadir */}
          <div className="bg-white rounded-2xl p-5 shadow-md border border-green-100">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-green-100 p-2 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-3xl font-bold text-green-700">{totalHadir}</span>
            </div>
            <p className="text-sm font-semibold text-green-600">Hadir</p>
            <p className="text-xs text-gray-400 mt-0.5">dari {workingDays} hari kerja</p>
          </div>

          {/* Izin */}
          <div className="bg-white rounded-2xl p-5 shadow-md border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-blue-100 p-2 rounded-xl">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-blue-700">{totalIzin}</span>
            </div>
            <p className="text-sm font-semibold text-blue-600">Izin</p>
            <p className="text-xs text-gray-400 mt-0.5">hari bulan ini</p>
          </div>

          {/* Sakit / Alpha */}
          <div className="bg-white rounded-2xl p-5 shadow-md border border-yellow-100">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-yellow-100 p-2 rounded-xl">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <span className="text-3xl font-bold text-yellow-700">{totalSakit}</span>
            </div>
            <p className="text-sm font-semibold text-yellow-600">Sakit</p>
            <p className="text-xs text-gray-400 mt-0.5">{totalAlpha} alpha</p>
          </div>

          {/* Jam Kerja */}
          <div className="bg-white rounded-2xl p-5 shadow-md border border-indigo-100">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-indigo-100 p-2 rounded-xl">
                <Timer className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-2xl font-bold text-indigo-700">
                {totalJamKerja.toFixed(1)}j
              </span>
            </div>
            <p className="text-sm font-semibold text-indigo-600">Total Jam Kerja</p>
            <p className="text-xs text-gray-400 mt-0.5">bulan ini</p>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="text-center">
              <div className="w-14 h-14 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 mt-4 font-medium text-sm">Memuat data...</p>
            </div>
          </div>
        ) : !karyawanId ? (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-16 text-center">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Karyawan belum dipilih</p>
          </div>
        ) : monthlyRows.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-16 text-center">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Tidak ada data absensi</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-violet-600 to-indigo-700 text-white">
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-widest w-12">
                      No
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-widest">
                      Tanggal
                    </th>
                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-widest">
                      Status
                    </th>
                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-widest">
                      Jam Masuk
                    </th>
                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-widest">
                      Jam Keluar
                    </th>
                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-widest">
                      Durasi
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-widest">
                      Catatan
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {monthlyRows.map(({ date, data }, index) => {
                    const isLibur = isHariLiburFn(date);
                    const isToday =
                      toLocalDateKey(date) === toLocalDateKey(new Date());

                    const rawStatus = data?.status ?? (isLibur ? "LIBUR" : null);
                    const statusKey = rawStatus as StatusAbsensi | null;
                    const statusCfg = statusKey ? STATUS_CONFIG[statusKey] : null;

                    const masuk = formatTime(data?.jamMasuk);
                    const keluar = formatTime(data?.jamKeluar);
                    const durasi = formatDuration(data?.jamMasuk, data?.jamKeluar);
                    const terlambat = data?.status === "HADIR" && isTerlambat(data?.jamMasuk, date);
                    const kurangJam = data?.status === "HADIR" && isKurangJam(data?.jamMasuk, data?.jamKeluar);

                    const dayName = new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date);
                    const dateNum = date.getDate();
                    const monthName = new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date);

                    return (
                      <tr
                        key={toLocalDateKey(date)}
                        className={`transition-colors ${
                          isToday
                            ? "bg-violet-50 border-l-4 border-violet-500"
                            : isLibur
                            ? "bg-slate-50/60"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        {/* No */}
                        <td className="px-5 py-3 text-center">
                          <span className="text-xs text-gray-400 font-medium">{index + 1}</span>
                        </td>

                        {/* Tanggal */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-sm ${
                                isToday
                                  ? "bg-violet-600 text-white"
                                  : isLibur
                                  ? "bg-slate-200 text-slate-500"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              <span className="text-xs font-semibold leading-none">{dayName}</span>
                              <span className="text-base font-bold leading-tight">{dateNum}</span>
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${isLibur ? "text-gray-400" : "text-gray-700"}`}>
                                {dateNum} {monthName}
                              </p>
                              {isToday && (
                                <span className="text-xs text-violet-600 font-semibold">Hari ini</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3 text-center">
                          {statusCfg ? (
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}
                            >
                              {statusCfg.icon}
                              {statusCfg.label}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-400 border border-gray-200">
                              <Clock className="w-3.5 h-3.5" />
                              —
                            </span>
                          )}
                        </td>

                        {/* Jam Masuk */}
                        <td className="px-5 py-3 text-center">
                          {masuk ? (
                            <div className="flex flex-col items-center gap-1.5">
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
                                terlambat
                                  ? "bg-red-50 border-red-300"
                                  : "bg-green-50 border-green-200"
                              }`}>
                                <LogIn className={`w-3.5 h-3.5 ${terlambat ? "text-red-500" : "text-green-600"}`} />
                                <span className={`font-mono text-sm font-semibold ${terlambat ? "text-red-700" : "text-green-700"}`}>
                                  {masuk}
                                </span>
                              </div>
                              {terlambat && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-bold border border-red-200">
                                  <AlarmClock className="w-3 h-3" />
                                  Terlambat
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>

                        {/* Jam Keluar */}
                        <td className="px-5 py-3 text-center">
                          {keluar ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
                              <LogOut className="w-3.5 h-3.5 text-orange-600" />
                              <span className="font-mono text-sm font-semibold text-orange-700">{keluar}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>

                        {/* Durasi */}
                        <td className="px-5 py-3 text-center">
                          {durasi ? (
                            <div className="flex flex-col items-center gap-1.5">
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
                                kurangJam
                                  ? "bg-amber-50 border-amber-300"
                                  : "bg-indigo-50 border-indigo-200"
                              }`}>
                                <Timer className={`w-3.5 h-3.5 ${kurangJam ? "text-amber-500" : "text-indigo-500"}`} />
                                <span className={`text-sm font-semibold ${kurangJam ? "text-amber-700" : "text-indigo-700"}`}>
                                  {durasi}
                                </span>
                              </div>
                              {kurangJam && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
                                  <TrendingDown className="w-3 h-3" />
                                  Kurang Jam
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>

                        {/* Catatan */}
                        <td className="px-5 py-3">
                          {data?.catatan ? (
                            <span className="text-xs text-gray-500 italic">{data.catatan}</span>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-violet-50 border-t border-gray-100 flex flex-wrap gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <strong className="text-green-700">{totalHadir}</strong> Hadir
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-500" />
                <strong className="text-blue-700">{totalIzin}</strong> Izin
              </span>
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <strong className="text-yellow-700">{totalSakit}</strong> Sakit
              </span>
              <span className="flex items-center gap-1.5">
                <X className="w-4 h-4 text-red-500" />
                <strong className="text-red-700">{totalAlpha}</strong> Alpha
              </span>
              <span className="flex items-center gap-1.5 ml-auto">
                <Timer className="w-4 h-4 text-indigo-500" />
                Total jam kerja: <strong className="text-indigo-700">{totalJamKerja.toFixed(1)} jam</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AbsenDetailPage;
