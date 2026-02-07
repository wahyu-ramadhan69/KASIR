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
  Edit,
  LogIn,
  LogOut,
  Calendar,
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
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<{
    karyawan: Karyawan;
  } | null>(null);
  const [editType, setEditType] = useState<"in" | "out">("in");
  const [editTime, setEditTime] = useState<string>("");
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

  const observerTarget = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef<boolean>(false);

  useEffect(() => {
    fetchKaryawan(true);
  }, []);

  const fetchKaryawan = async (reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let url = `/api/karyawan?limit=20&excludeJenis=OWNER`;

      if (!reset && nextCursor) {
        url += `&cursor=${nextCursor}`;
      }

      if (searchTerm.trim()) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !Array.isArray(data.data)) {
        throw new Error(data.error || "Invalid karyawan response");
      }

      const incoming: Karyawan[] = data.data;

      if (reset) {
        setKaryawanList(incoming);
        setAbsensiMap({});
      } else {
        setKaryawanList((prev) => [...prev, ...incoming]);
      }

      setNextCursor(data.nextCursor ?? null);
      setHasMore(data.nextCursor !== null);

      const incomingIds = incoming.map((item) => item.id);
      await fetchAbsensiStatus(incomingIds, selectedDate);
    } catch (error) {
      console.error("Error fetching karyawan:", error);
      toast.error("Gagal mengambil data karyawan");
      if (reset) {
        setKaryawanList([]);
      }
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
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchKaryawan(false);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
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
      [id]: {
        ...prev[id],
        [type]: value,
      },
    }));
  };

  const fetchAbsensiStatus = async (ids: number[], tanggal: string) => {
    if (!ids.length) return;
    try {
      const url = `/api/karyawan/absensi?tanggal=${tanggal}&ids=${ids.join(
        ","
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.data)) {
        throw new Error(data.error || "Invalid absensi response");
      }
      const mapUpdate: Record<number, AbsensiStatus> = {};
      for (const item of data.data as AbsensiStatus[]) {
        mapUpdate[item.karyawanId] = item;
      }
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
        toast.success(`Check-in berhasil: ${karyawan.nama}`);
        if (data?.data?.karyawanId) {
          setAbsensiMap((prev) => ({
            ...prev,
            [data.data.karyawanId]: data.data,
          }));
        }
      } else {
        toast.error(data.error || "Gagal melakukan check-in");
      }
    } catch (error) {
      console.error("Error check-in:", error);
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
        toast.success(`Check-out berhasil: ${karyawan.nama}`);
        if (data?.data?.karyawanId) {
          setAbsensiMap((prev) => ({
            ...prev,
            [data.data.karyawanId]: data.data,
          }));
        }
      } else {
        toast.error(data.error || "Gagal melakukan check-out");
      }
    } catch (error) {
      console.error("Error check-out:", error);
      toast.error("Terjadi kesalahan saat check-out");
    } finally {
      setLoadingState(karyawan.id, "checkout", false);
    }
  };

  const toTimeValue = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleOpenEdit = (karyawan: Karyawan) => {
    const absensi = absensiMap[karyawan.id];
    const inTime = toTimeValue(absensi?.jamMasuk ?? null);
    const outTime = toTimeValue(absensi?.jamKeluar ?? null);
    const initialType = inTime ? "in" : "out";
    setEditTarget({ karyawan });
    setEditType(initialType);
    setEditTime(initialType === "in" ? inTime : outTime);
    setShowEditModal(true);
  };

  const handleSubmitEdit = async () => {
    if (!editTarget) return;
    const { karyawan } = editTarget;
    try {
      const payload =
        editType === "in"
          ? { karyawanId: karyawan.id, tanggal: selectedDate, jamMasuk: editTime }
          : {
              karyawanId: karyawan.id,
              tanggal: selectedDate,
              jamKeluar: editTime,
            };

      const res = await fetch("/api/karyawan/absensi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Edit ${editType === "in" ? "check-in" : "check-out"} berhasil`
        );
        if (data?.data?.karyawanId) {
          setAbsensiMap((prev) => ({
            ...prev,
            [data.data.karyawanId]: data.data,
          }));
        }
        setShowEditModal(false);
        setEditTarget(null);
      } else {
        toast.error(data.error || "Gagal mengupdate absensi");
      }
    } catch (error) {
      console.error("Error updating absensi:", error);
      toast.error("Terjadi kesalahan saat mengupdate absensi");
    }
  };

  const selectedDateLabel = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(selectedDate));

  const totalCheckin = Object.values(absensiMap).filter(
    (item) => item?.jamMasuk
  ).length;
  const totalCheckout = Object.values(absensiMap).filter(
    (item) => item?.jamKeluar
  ).length;

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
                  Absensi Karyawan
                </h1>
                <p className="text-blue-100 text-lg">
                  Check-in dan check-out karyawan harian
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Karyawan
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {karyawanList.length}
                </p>
                <p className="text-xs text-gray-400 mt-2">Karyawan aktif</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Tanggal
                </p>
                <p className="text-2xl font-bold text-indigo-600 mt-2">
                  {selectedDateLabel}
                </p>
                <p className="text-xs text-indigo-400 mt-2">
                  Tanggal terpilih
                </p>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Calendar className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Check-in
                </p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {totalCheckin}
                </p>
                <p className="text-xs text-green-400 mt-2">
                  Tanggal terpilih
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <LogIn className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Check-out
                </p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {totalCheckout}
                </p>
                <p className="text-xs text-orange-400 mt-2">
                  Tanggal terpilih
                </p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <LogOut className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari nama, NIK..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                  }}
                  className="pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="text-center">
              <div className="relative">
                <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                <Users className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-gray-500 mt-6 text-lg font-medium">
                Memuat data karyawan...
              </p>
            </div>
          </div>
        ) : karyawanList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
            <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg font-medium">
              {searchTerm
                ? `Tidak ada karyawan ditemukan untuk "${searchTerm}"`
                : "Tidak ada data karyawan"}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <tr>
                      <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                        Nama
                      </th>
                      <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                        NIK
                      </th>
                      <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                        Jenis
                      </th>
                      <th className="px-6 py-4 text-center font-bold uppercase text-sm tracking-wide">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {karyawanList.map((karyawan) => {
                      const isCheckinLoading =
                        actionLoading[karyawan.id]?.checkin ?? false;
                      const isCheckoutLoading =
                        actionLoading[karyawan.id]?.checkout ?? false;
                      const absensi = absensiMap[karyawan.id];
                      const isCheckedIn = Boolean(absensi?.jamMasuk);
                      const isCheckedOut = Boolean(absensi?.jamKeluar);
                      const disableCheckin =
                        isCheckedIn || isCheckinLoading || isCheckoutLoading;
                      const disableCheckout =
                        !isCheckedIn ||
                        isCheckedOut ||
                        isCheckoutLoading ||
                        isCheckinLoading;
                      return (
                        <tr
                          key={karyawan.id}
                          className="hover:bg-blue-50 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md group-hover:scale-110 transition-transform">
                                {karyawan.nama.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {karyawan.nama}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-gray-400" />
                              <span className="font-mono text-sm text-gray-700">
                                {karyawan.nik}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                                karyawan.jenis === "KASIR"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              <Briefcase className="w-3 h-3" />
                              {karyawan.jenis}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleCheckin(karyawan)}
                                disabled={disableCheckin}
                                className="px-4 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Absen Masuk"
                              >
                                <LogIn className="w-4 h-4" />
                                {isCheckinLoading
                                  ? "Memproses..."
                                  : isCheckedIn
                                  ? toTimeValue(absensi?.jamMasuk ?? null) ||
                                    "Check-in"
                                  : "Check-in"}
                              </button>
                              <button
                                onClick={() => handleCheckout(karyawan)}
                                disabled={disableCheckout}
                                className="px-4 py-2 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Absen Keluar"
                              >
                                <LogOut className="w-4 h-4" />
                                {isCheckoutLoading
                                  ? "Memproses..."
                                  : isCheckedOut
                                  ? toTimeValue(absensi?.jamKeluar ?? null) ||
                                    "Check-out"
                                  : "Check-out"}
                              </button>
                              <button
                                onClick={() => handleOpenEdit(karyawan)}
                                disabled={!absensi}
                                className="px-3 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Edit Absensi"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                              <Link
                                href={`/dashboard/admin/absen/detail?karyawanId=${karyawan.id}`}
                                className="px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors font-semibold flex items-center gap-2"
                                title="Detail Absen Bulanan"
                              >
                                Detail
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

            {/* Infinite Scroll Trigger */}
            <div ref={observerTarget} className="mt-10">
              {loadingMore && (
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                    </div>
                    <p className="text-sm text-gray-500 mt-4 font-medium">
                      Memuat lebih banyak...
                    </p>
                  </div>
                </div>
              )}
              {!hasMore && karyawanList.length > 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 rounded-full">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-gray-600 font-medium">
                      Semua data telah ditampilkan
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {showEditModal && editTarget && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setShowEditModal(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                      <Edit className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        Edit Absensi
                      </h2>
                      <p className="text-blue-100 text-sm">
                        {editTarget.karyawan.nama}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    Tipe
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => {
                      const nextType = e.target.value as "in" | "out";
                      setEditType(nextType);
                      const absensi = absensiMap[editTarget.karyawan.id];
                      const nextTime =
                        nextType === "in"
                          ? toTimeValue(absensi?.jamMasuk ?? null)
                          : toTimeValue(absensi?.jamKeluar ?? null);
                      setEditTime(nextTime);
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                  >
                    <option value="in">Check-in</option>
                    <option value="out">Check-out</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    Jam {editType === "in" ? "Masuk" : "Keluar"} (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Kosongkan untuk menghapus jam.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-3 rounded-xl transition-all font-bold shadow-md hover:shadow-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitEdit}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 py-3 rounded-xl transition-all font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Simpan
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
