"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  RefreshCw,
  Users,
  CreditCard,
  Briefcase,
  CheckCircle,
  X,
  LogIn,
  LogOut,
  Calendar,
  ClipboardList,
  AlertCircle,
  Clock,
  FileText,
  ChevronRight,
  Edit,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface Karyawan {
  id: number;
  nama: string;
  nik: string;
  noHp: string | null;
  alamat: string | null;
  jenis: string;
  gajiPokok: number;
  tunjanganMakan: number;
  totalPinjaman: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

interface AbsensiStatus {
  id: number;
  karyawanId: number;
  jamMasuk: string | null;
  jamKeluar: string | null;
  status: string;
  catatan: string | null;
  tanggal: string;
}

const VALID_STATUS = ["HADIR", "IZIN", "SAKIT", "ALPHA", "LIBUR"] as const;
const MODAL_STATUS = ["IZIN", "SAKIT"] as const satisfies readonly StatusAbsensi[];
type StatusAbsensi = (typeof VALID_STATUS)[number];

const STATUS_CONFIG: Record<
  StatusAbsensi,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  HADIR: {
    label: "Hadir",
    color: "text-green-700",
    bg: "bg-green-100",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  IZIN: {
    label: "Izin",
    color: "text-blue-700",
    bg: "bg-blue-100",
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  SAKIT: {
    label: "Sakit",
    color: "text-yellow-700",
    bg: "bg-yellow-100",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  ALPHA: {
    label: "Alpha",
    color: "text-red-700",
    bg: "bg-red-100",
    icon: <X className="w-3.5 h-3.5" />,
  },
  LIBUR: {
    label: "Libur",
    color: "text-purple-700",
    bg: "bg-purple-100",
    icon: <Calendar className="w-3.5 h-3.5" />,
  },
};

const AbsenKaryawanPage = () => {
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [absensiMap, setAbsensiMap] = useState<
    Record<number, AbsensiStatus | undefined>
  >({});
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = `${today.getMonth() + 1}`.padStart(2, "0");
    const day = `${today.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [actionLoading, setActionLoading] = useState<
    Record<number, { checkin?: boolean; checkout?: boolean }>
  >({});

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Karyawan | null>(null);
  const [editType, setEditType] = useState<"in" | "out">("in");
  const [editTime, setEditTime] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Input (izin/sakit) modal state
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputTarget, setInputTarget] = useState<Karyawan | null>(null);
  const [inputStatus, setInputStatus] = useState<StatusAbsensi>("HADIR");
  const [inputJamMasuk, setInputJamMasuk] = useState("");
  const [inputJamKeluar, setInputJamKeluar] = useState("");
  const [inputCatatan, setInputCatatan] = useState("");
  const [isSavingInput, setIsSavingInput] = useState(false);

  const observerTarget = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef<boolean>(false);

  useEffect(() => {
    fetchKaryawan(true);
  }, []);

  const fetchKaryawan = async (reset: boolean = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      let url = `/api/karyawan?limit=20&excludeJenis=OWNER`;
      if (!reset && nextCursor) url += `&cursor=${nextCursor}`;
      if (searchTerm.trim())
        url += `&search=${encodeURIComponent(searchTerm)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.data))
        throw new Error(data.error || "Invalid response");

      const incoming: Karyawan[] = data.data;
      if (reset) {
        setKaryawanList(incoming);
        setAbsensiMap({});
      } else {
        setKaryawanList((prev) => [...prev, ...incoming]);
      }

      setNextCursor(data.nextCursor ?? null);
      setHasMore(data.nextCursor !== null);
      await fetchAbsensiStatus(
        incoming.map((i) => i.id),
        selectedDate
      );
    } catch (error) {
      console.error("Error fetching karyawan:", error);
      toast.error("Gagal mengambil data karyawan");
      if (reset) setKaryawanList([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (!searchTerm.trim()) return;
    const timer = setTimeout(() => {
      setKaryawanList([]);
      setNextCursor(null);
      fetchKaryawan(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore)
          fetchKaryawan(false);
      },
      { threshold: 0.1 }
    );
    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);
    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasMore, loading, loadingMore, nextCursor]);

  const handleRefresh = () => {
    setSearchTerm("");
    setKaryawanList([]);
    setNextCursor(null);
    fetchKaryawan(true);
  };

  const setLoadingState = (
    id: number,
    type: "checkin" | "checkout",
    value: boolean
  ) => {
    setActionLoading((prev) => ({
      ...prev,
      [id]: { ...prev[id], [type]: value },
    }));
  };

  const fetchAbsensiStatus = async (ids: number[], tanggal: string) => {
    if (!ids.length) return;
    try {
      const url = `/api/karyawan/absensi?tanggal=${tanggal}&ids=${ids.join(",")}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.data))
        throw new Error(data.error || "Invalid absensi response");
      const mapUpdate: Record<number, AbsensiStatus> = {};
      for (const item of data.data as AbsensiStatus[])
        mapUpdate[item.karyawanId] = item;
      setAbsensiMap((prev) => ({ ...prev, ...mapUpdate }));
    } catch (error) {
      console.error("Error fetching absensi status:", error);
      toast.error("Gagal mengambil status absensi");
    }
  };

  useEffect(() => {
    if (karyawanList.length === 0) return;
    setAbsensiMap({});
    fetchAbsensiStatus(
      karyawanList.map((item) => item.id),
      selectedDate
    );
  }, [selectedDate]);

  const handleCheckin = async (karyawan: Karyawan) => {
    setLoadingState(karyawan.id, "checkin", true);
    try {
      const res = await fetch("/api/karyawan/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ karyawanId: karyawan.id, tanggal: selectedDate }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Check-in: ${karyawan.nama}`);
        if (data?.data?.karyawanId)
          setAbsensiMap((prev) => ({
            ...prev,
            [data.data.karyawanId]: data.data,
          }));
      } else {
        toast.error(data.error || "Gagal check-in");
      }
    } catch {
      toast.error("Terjadi kesalahan saat check-in");
    } finally {
      setLoadingState(karyawan.id, "checkin", false);
    }
  };

  const handleCheckout = async (karyawan: Karyawan) => {
    setLoadingState(karyawan.id, "checkout", true);
    try {
      const res = await fetch("/api/karyawan/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ karyawanId: karyawan.id, tanggal: selectedDate }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Check-out: ${karyawan.nama}`);
        if (data?.data?.karyawanId)
          setAbsensiMap((prev) => ({
            ...prev,
            [data.data.karyawanId]: data.data,
          }));
      } else {
        toast.error(data.error || "Gagal check-out");
      }
    } catch {
      toast.error("Terjadi kesalahan saat check-out");
    } finally {
      setLoadingState(karyawan.id, "checkout", false);
    }
  };

  const toTimeValue = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const handleOpenEdit = (karyawan: Karyawan) => {
    const absensi = absensiMap[karyawan.id];
    const inTime = toTimeValue(absensi?.jamMasuk);
    const outTime = toTimeValue(absensi?.jamKeluar);
    const type = inTime ? "in" : "out";
    setEditTarget(karyawan);
    setEditType(type);
    setEditTime(type === "in" ? inTime : outTime);
    setShowEditModal(true);
  };

  const handleSubmitEdit = async () => {
    if (!editTarget) return;
    setIsSavingEdit(true);
    try {
      const payload =
        editType === "in"
          ? { karyawanId: editTarget.id, tanggal: selectedDate, jamMasuk: editTime }
          : { karyawanId: editTarget.id, tanggal: selectedDate, jamKeluar: editTime };
      const res = await fetch("/api/karyawan/absensi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Edit ${editType === "in" ? "jam masuk" : "jam keluar"} berhasil`);
        if (data?.data?.karyawanId)
          setAbsensiMap((prev) => ({ ...prev, [data.data.karyawanId]: data.data }));
        setShowEditModal(false);
        setEditTarget(null);
      } else {
        toast.error(data.error || "Gagal mengupdate absensi");
      }
    } catch {
      toast.error("Terjadi kesalahan saat mengupdate absensi");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenInputModal = (karyawan: Karyawan) => {
    const absensi = absensiMap[karyawan.id];
    setInputTarget(karyawan);
    const existingStatus = absensi?.status as StatusAbsensi | undefined;
    setInputStatus(MODAL_STATUS.includes(existingStatus as any) ? (existingStatus as typeof MODAL_STATUS[number]) : "IZIN");
    setInputJamMasuk(toTimeValue(absensi?.jamMasuk));
    setInputJamKeluar(toTimeValue(absensi?.jamKeluar));
    setInputCatatan(absensi?.catatan || "");
    setShowInputModal(true);
  };

  const handleSubmitInput = async () => {
    if (!inputTarget) return;
    setIsSavingInput(true);
    try {
      const payload: Record<string, unknown> = {
        karyawanId: inputTarget.id,
        tanggal: selectedDate,
        status: inputStatus,
        catatan: inputCatatan || null,
      };
      if (inputStatus === "HADIR") {
        if (inputJamMasuk) payload.jamMasuk = inputJamMasuk;
        if (inputJamKeluar) payload.jamKeluar = inputJamKeluar;
      }

      const res = await fetch("/api/karyawan/absensi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Absensi ${inputTarget.nama} berhasil disimpan`);
        if (data?.data?.karyawanId)
          setAbsensiMap((prev) => ({
            ...prev,
            [data.data.karyawanId]: data.data,
          }));
        setShowInputModal(false);
        setInputTarget(null);
      } else {
        toast.error(data.error || "Gagal menyimpan absensi");
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan absensi");
    } finally {
      setIsSavingInput(false);
    }
  };

  const selectedDateLabel = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(selectedDate + "T00:00:00"));

  const absensiValues = Object.values(absensiMap);
  const totalHadir = absensiValues.filter((a) => a?.status === "HADIR").length;
  const totalIzin = absensiValues.filter((a) => a?.status === "IZIN").length;
  const totalSakit = absensiValues.filter((a) => a?.status === "SAKIT").length;
  const totalAlpha = absensiValues.filter((a) => a?.status === "ALPHA").length;
  const totalBelumAbsen = karyawanList.filter((k) => !absensiMap[k.id]).length;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
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
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 rounded-2xl p-8 mb-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white opacity-5 rounded-full -mr-40 -mt-40" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-white opacity-5 rounded-full -ml-28 -mb-28" />
          <div className="absolute top-1/2 right-24 w-32 h-32 bg-white opacity-5 rounded-full" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl shadow-lg">
                <ClipboardList className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white tracking-tight">
                  Absensi Karyawan
                </h1>
                <p className="text-purple-200 text-base mt-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {selectedDateLabel}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 font-medium shadow-lg border border-white/20"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-blue-100 p-2.5 rounded-xl">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{karyawanList.length}</span>
            </div>
            <p className="text-sm font-semibold text-gray-500">Total</p>
            <p className="text-xs text-gray-400 mt-0.5">Karyawan aktif</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md border border-green-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-green-100 p-2.5 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-3xl font-bold text-green-700">{totalHadir}</span>
            </div>
            <p className="text-sm font-semibold text-green-600">Hadir</p>
            <p className="text-xs text-gray-400 mt-0.5">Hari ini</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md border border-blue-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-blue-100 p-2.5 rounded-xl">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-blue-700">{totalIzin}</span>
            </div>
            <p className="text-sm font-semibold text-blue-600">Izin</p>
            <p className="text-xs text-gray-400 mt-0.5">Hari ini</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md border border-yellow-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-yellow-100 p-2.5 rounded-xl">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <span className="text-3xl font-bold text-yellow-700">{totalSakit + totalAlpha}</span>
            </div>
            <p className="text-sm font-semibold text-yellow-600">Sakit/Alpha</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalSakit} sakit · {totalAlpha} alpha
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 hover:shadow-lg transition-all col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-slate-100 p-2.5 rounded-xl">
                <Clock className="w-5 h-5 text-slate-500" />
              </div>
              <span className="text-3xl font-bold text-slate-500">{totalBelumAbsen}</span>
            </div>
            <p className="text-sm font-semibold text-slate-500">Belum Absen</p>
            <p className="text-xs text-gray-400 mt-0.5">Perlu diisi</p>
          </div>
        </div>

        {/* Search & Date Filter */}
        <div className="bg-white rounded-2xl p-5 mb-6 shadow-md border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari nama, NIK..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-400 focus:border-transparent outline-none transition-all text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-400 focus:border-transparent outline-none transition-all text-sm"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 mt-4 font-medium">Memuat data...</p>
            </div>
          </div>
        ) : karyawanList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-16 text-center">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">
              {searchTerm
                ? `Tidak ada karyawan untuk "${searchTerm}"`
                : "Tidak ada data karyawan"}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-violet-600 to-indigo-700 text-white">
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest">
                        Karyawan
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-widest hidden sm:table-cell">
                        NIK / Jabatan
                      </th>
                      <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-widest">
                        Status
                      </th>
                      <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-widest hidden md:table-cell">
                        Jam Masuk / Keluar
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-widest">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {karyawanList.map((karyawan) => {
                      const isCheckinLoading = actionLoading[karyawan.id]?.checkin ?? false;
                      const isCheckoutLoading = actionLoading[karyawan.id]?.checkout ?? false;
                      const absensi = absensiMap[karyawan.id];
                      const currentStatus = absensi?.status as StatusAbsensi | undefined;
                      const isHadir = currentStatus === "HADIR";
                      const isCheckedIn = Boolean(absensi?.jamMasuk);
                      const isCheckedOut = Boolean(absensi?.jamKeluar);

                      return (
                        <tr
                          key={karyawan.id}
                          className="hover:bg-slate-50 transition-colors group"
                        >
                          {/* Karyawan */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                                {karyawan.nama.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">
                                  {karyawan.nama}
                                </p>
                                <p className="text-xs text-gray-400 sm:hidden">
                                  {karyawan.nik}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* NIK / Jabatan */}
                          <td className="px-4 py-4 hidden sm:table-cell">
                            <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-1">
                              <CreditCard className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="font-mono">{karyawan.nik}</span>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                karyawan.jenis === "KASIR"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              <Briefcase className="w-3 h-3" />
                              {karyawan.jenis}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4 text-center">
                            {currentStatus ? (
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${STATUS_CONFIG[currentStatus].bg} ${STATUS_CONFIG[currentStatus].color}`}
                              >
                                {STATUS_CONFIG[currentStatus].icon}
                                {STATUS_CONFIG[currentStatus].label}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-400">
                                <Clock className="w-3.5 h-3.5" />
                                Belum
                              </span>
                            )}
                          </td>

                          {/* Jam */}
                          <td className="px-4 py-4 text-center hidden md:table-cell">
                            {isHadir ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-center gap-1.5 text-xs text-green-700">
                                  <LogIn className="w-3.5 h-3.5" />
                                  <span className="font-mono font-semibold">
                                    {toTimeValue(absensi?.jamMasuk) || "—"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-center gap-1.5 text-xs text-orange-600">
                                  <LogOut className="w-3.5 h-3.5" />
                                  <span className="font-mono font-semibold">
                                    {toTimeValue(absensi?.jamKeluar) || "—"}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-sm">—</span>
                            )}
                          </td>

                          {/* Aksi */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {/* Check-in */}
                              <button
                                onClick={() => handleCheckin(karyawan)}
                                disabled={isCheckedIn || isCheckinLoading || isCheckoutLoading}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                  isCheckedIn
                                    ? "bg-green-50 text-green-600 cursor-default"
                                    : "bg-green-100 text-green-700 hover:bg-green-200"
                                }`}
                                title={isCheckedIn ? `Masuk: ${toTimeValue(absensi?.jamMasuk)}` : "Absen Masuk"}
                              >
                                <LogIn className="w-3.5 h-3.5" />
                                {isCheckinLoading ? "..." : isCheckedIn ? toTimeValue(absensi?.jamMasuk) || "Masuk" : "Masuk"}
                              </button>

                              {/* Check-out */}
                              <button
                                onClick={() => handleCheckout(karyawan)}
                                disabled={!isCheckedIn || isCheckedOut || isCheckoutLoading || isCheckinLoading}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                  isCheckedOut
                                    ? "bg-orange-50 text-orange-600 cursor-default"
                                    : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                                }`}
                                title={isCheckedOut ? `Keluar: ${toTimeValue(absensi?.jamKeluar)}` : "Absen Keluar"}
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                {isCheckoutLoading ? "..." : isCheckedOut ? toTimeValue(absensi?.jamKeluar) || "Keluar" : "Keluar"}
                              </button>

                              {/* Input Izin/Sakit */}
                              <button
                                onClick={() => handleOpenInputModal(karyawan)}
                                className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors text-xs font-semibold flex items-center gap-1.5"
                              >
                                <ClipboardList className="w-3.5 h-3.5" />
                                Izin/Sakit
                              </button>

                              {/* Edit Jam */}
                              <button
                                onClick={() => handleOpenEdit(karyawan)}
                                disabled={!absensi}
                                className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Edit
                              </button>

                              {/* Detail */}
                              <Link
                                href={`/dashboard/admin/absen/detail?karyawanId=${karyawan.id}`}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors text-xs font-semibold flex items-center gap-1"
                              >
                                Detail
                                <ChevronRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Infinite Scroll */}
            <div ref={observerTarget} className="mt-8">
              {loadingMore && (
                <div className="flex justify-center py-8">
                  <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                </div>
              )}
              {!hasMore && karyawanList.length > 0 && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white rounded-full shadow-sm border border-gray-200">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <p className="text-sm text-gray-500 font-medium">
                      Semua data telah ditampilkan
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Input Absensi Modal */}
        {showInputModal && inputTarget && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowInputModal(false)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2.5 rounded-xl">
                      <ClipboardList className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Input Absensi</h2>
                      <p className="text-violet-200 text-sm flex items-center gap-1 mt-0.5">
                        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                          {inputTarget.nama.charAt(0).toUpperCase()}
                        </span>
                        {inputTarget.nama}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowInputModal(false)}
                    className="text-white/70 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Status Selector */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                    Status Kehadiran
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {MODAL_STATUS.map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      const isSelected = inputStatus === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setInputStatus(s)}
                          className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all text-xs font-bold ${
                            isSelected
                              ? `${cfg.bg} ${cfg.color} border-current shadow-sm`
                              : "bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Catatan */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Catatan <span className="text-gray-400 normal-case font-normal">(opsional)</span>
                  </label>
                  <textarea
                    value={inputCatatan}
                    onChange={(e) => setInputCatatan(e.target.value)}
                    placeholder="Tambahkan catatan..."
                    rows={2}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-400 focus:border-transparent outline-none text-sm resize-none transition-all"
                  />
                </div>

                {/* Tanggal info */}
                <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>
                    Tanggal: <strong className="text-gray-600">{selectedDateLabel}</strong>
                  </span>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowInputModal(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-all text-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitInput}
                    disabled={isSavingInput}
                    className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white py-3 rounded-xl font-semibold transition-all text-sm shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isSavingInput ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {isSavingInput ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Jam Modal */}
        {showEditModal && editTarget && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowEditModal(false)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2.5 rounded-xl">
                      <Edit className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Edit Jam Absensi</h2>
                      <p className="text-blue-200 text-sm">{editTarget.nama}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-white/70 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                    Pilih Jam
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["in", "out"] as const).map((type) => {
                      const isSelected = editType === type;
                      const ab = absensiMap[editTarget.id];
                      const currentTime = type === "in"
                        ? toTimeValue(ab?.jamMasuk)
                        : toTimeValue(ab?.jamKeluar);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setEditType(type);
                            setEditTime(currentTime);
                          }}
                          className={`flex flex-col items-center gap-1.5 py-3 px-4 rounded-xl border-2 transition-all text-sm font-semibold ${
                            isSelected
                              ? type === "in"
                                ? "bg-green-100 text-green-700 border-green-400 shadow-sm"
                                : "bg-orange-100 text-orange-700 border-orange-400 shadow-sm"
                              : "bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {type === "in"
                            ? <LogIn className="w-5 h-5" />
                            : <LogOut className="w-5 h-5" />
                          }
                          <span>{type === "in" ? "Jam Masuk" : "Jam Keluar"}</span>
                          {currentTime && (
                            <span className={`text-xs font-mono font-bold ${isSelected ? "" : "text-gray-400"}`}>
                              {currentTime}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Ubah {editType === "in" ? "Jam Masuk" : "Jam Keluar"}
                  </label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold transition-all text-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitEdit}
                    disabled={isSavingEdit}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2.5 rounded-xl font-semibold transition-all text-sm shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isSavingEdit ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {isSavingEdit ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AbsenKaryawanPage;
