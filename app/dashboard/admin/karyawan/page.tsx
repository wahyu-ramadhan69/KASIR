"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  RefreshCw,
  Phone,
  MapPin,
  Briefcase,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  Eye,
  Calendar,
  CheckCircle,
  Activity,
  Users,
  TrendingUp,
  Wallet,
  ChevronDown,
  ChevronUp,
  Building2,
  CreditCard,
  Printer,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

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

interface KaryawanFormData {
  nama: string;
  nik: string;
  noHp: string;
  alamat: string;
  jenis: string;
  gajiPokok: string;
  tunjanganMakan: string;
  totalPinjaman: string;
}

interface EstimasiGajiItem {
  karyawan: {
    id: number;
  };
  gajiProrate: number;
}

interface PembayaranGajiItem {
  id: number;
  karyawanId: number;
  nominal: number;
  periode: string;
  bulan: string;
  minggu: number | null;
}

const DataKaryawanPage = () => {
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [estimasiGajiMap, setEstimasiGajiMap] = useState<
    Record<number, number>
  >({});
  const [estimasiMingguanMap, setEstimasiMingguanMap] = useState<
    Record<number, number>
  >({});
  const [pembayaranBulananMap, setPembayaranBulananMap] = useState<
    Record<number, PembayaranGajiItem>
  >({});
  const [pembayaranMingguanMap, setPembayaranMingguanMap] = useState<
    Record<number, PembayaranGajiItem>
  >({});
  const [pembayaranMingguanAllMap, setPembayaranMingguanAllMap] = useState<
    Record<number, PembayaranGajiItem[]>
  >({});
  const [pembayaranMingguanTotalMap, setPembayaranMingguanTotalMap] = useState<
    Record<number, number>
  >({});
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedKaryawan, setSelectedKaryawan] = useState<Karyawan | null>(
    null
  );
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [sortField, setSortField] = useState<string>("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editingKaryawan, setEditingKaryawan] = useState<{
    id: number;
    data: KaryawanFormData;
  } | null>(null);
  const [showSlipModal, setShowSlipModal] = useState<boolean>(false);
  const [slipKaryawan, setSlipKaryawan] = useState<Karyawan | null>(null);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [payKaryawan, setPayKaryawan] = useState<Karyawan | null>(null);
  const [payPeriod, setPayPeriod] = useState<"BULANAN" | "MINGGUAN">("BULANAN");
  const [payNominal, setPayNominal] = useState<string>("");
  const [payNote, setPayNote] = useState<string>("");
  const [formData, setFormData] = useState<KaryawanFormData>({
    nama: "",
    nik: "",
    noHp: "",
    alamat: "",
    jenis: "KASIR",
    gajiPokok: "",
    tunjanganMakan: "",
    totalPinjaman: "",
  });
  const now = new Date();
  const currentMonthValue = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthValue);
  const [selectedWeek, setSelectedWeek] = useState<number>(() => {
    const day = now.getDate();
    return Math.min(5, Math.max(1, Math.ceil(day / 7)));
  });
  const maxWeek = (() => {
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) return 4;
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === 6) count += 1; // Saturday
    }
    return Math.max(1, count);
  })();
  const currentMonthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
  }).format(new Date(`${selectedMonth}-01T00:00:00`));
  const currentWeekLabel = `Minggu ke-${selectedWeek}`;

  const observerTarget = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef<boolean>(false);

  useEffect(() => {
    fetchKaryawan(true);
  }, []);

  useEffect(() => {
    if (selectedWeek > maxWeek) {
      setSelectedWeek(maxWeek);
      return;
    }
    setKaryawanList([]);
    setNextCursor(null);
    fetchKaryawan(true);
  }, [selectedMonth, selectedWeek]);

  const fetchKaryawan = async (reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let url = `/api/karyawan?limit=20`;

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

      if (reset) {
        setKaryawanList(data.data);
      } else {
        setKaryawanList((prev) => [...prev, ...data.data]);
      }

      if (reset && Array.isArray(data.data)) {
        try {
          const salaryRes = await fetch(
            `/api/karyawan/absensi/gaji?month=${selectedMonth}`
          );
          const salaryData = await salaryRes.json();
          if (salaryRes.ok && Array.isArray(salaryData.data)) {
            const map: Record<number, number> = {};
            for (const item of salaryData.data as EstimasiGajiItem[]) {
              map[item.karyawan.id] = item.gajiProrate ?? 0;
            }
            setEstimasiGajiMap(map);
          }

          const weeklyRes = await fetch(
            `/api/karyawan/absensi/gaji?period=weekly&month=${selectedMonth}&week=${selectedWeek}`
          );
          const weeklyData = await weeklyRes.json();
          if (weeklyRes.ok && Array.isArray(weeklyData.data)) {
            const map: Record<number, number> = {};
            for (const item of weeklyData.data as EstimasiGajiItem[]) {
              map[item.karyawan.id] = item.gajiProrate ?? 0;
            }
            setEstimasiMingguanMap(map);
          }

          const pembayaranBulananRes = await fetch(
            `/api/penggajian?period=BULANAN&month=${selectedMonth}`
          );
          const pembayaranBulananData = await pembayaranBulananRes.json();
          if (
            pembayaranBulananRes.ok &&
            Array.isArray(pembayaranBulananData.data)
          ) {
            const map: Record<number, PembayaranGajiItem> = {};
            for (const item of pembayaranBulananData.data as PembayaranGajiItem[]) {
              map[item.karyawanId] = item;
            }
            setPembayaranBulananMap(map);
          }

          const pembayaranMingguanRes = await fetch(
            `/api/penggajian?period=MINGGUAN&month=${selectedMonth}&week=${selectedWeek}`
          );
          const pembayaranMingguanData = await pembayaranMingguanRes.json();
          if (
            pembayaranMingguanRes.ok &&
            Array.isArray(pembayaranMingguanData.data)
          ) {
            const map: Record<number, PembayaranGajiItem> = {};
            for (const item of pembayaranMingguanData.data as PembayaranGajiItem[]) {
              map[item.karyawanId] = item;
            }
            setPembayaranMingguanMap(map);
          }

          const pembayaranMingguanAllRes = await fetch(
            `/api/penggajian?period=MINGGUAN&month=${selectedMonth}`
          );
          const pembayaranMingguanAllData = await pembayaranMingguanAllRes.json();
          if (
            pembayaranMingguanAllRes.ok &&
            Array.isArray(pembayaranMingguanAllData.data)
          ) {
            const map: Record<number, PembayaranGajiItem[]> = {};
            const totalMap: Record<number, number> = {};
            for (const item of pembayaranMingguanAllData.data as PembayaranGajiItem[]) {
              if (!map[item.karyawanId]) map[item.karyawanId] = [];
              map[item.karyawanId].push(item);
              totalMap[item.karyawanId] =
                (totalMap[item.karyawanId] ?? 0) + (item.nominal ?? 0);
            }
            setPembayaranMingguanAllMap(map);
            setPembayaranMingguanTotalMap(totalMap);
          }
        } catch (salaryError) {
          console.error("Error fetching estimasi gaji:", salaryError);
        }
      }

      setNextCursor(data.nextCursor ?? null);
      setHasMore(data.nextCursor !== null);
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

  const formatRupiah = (amount: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const parseRupiahInput = (value: string): string => {
    return value.replace(/[^0-9]/g, "");
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    if (
      name === "gajiPokok" ||
      name === "tunjanganMakan" ||
      name === "totalPinjaman"
    ) {
      setFormData((prev) => ({
        ...prev,
        [name]: parseRupiahInput(value),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    if (editingKaryawan) {
      if (
        name === "gajiPokok" ||
        name === "tunjanganMakan" ||
        name === "totalPinjaman"
      ) {
        setEditingKaryawan({
          ...editingKaryawan,
          data: {
            ...editingKaryawan.data,
            [name]: parseRupiahInput(value),
          },
        });
      } else {
        setEditingKaryawan({
          ...editingKaryawan,
          data: {
            ...editingKaryawan.data,
            [name]: value,
          },
        });
      }
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = {
        nama: formData.nama,
        nik: formData.nik,
        noHp: formData.noHp || null,
        alamat: formData.alamat || null,
        jenis: formData.jenis,
        gajiPokok: parseInt(formData.gajiPokok) || 0,
        tunjanganMakan: parseInt(formData.tunjanganMakan) || 0,
        totalPinjaman: parseInt(formData.totalPinjaman) || 0,
      };

      const res = await fetch("/api/karyawan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Karyawan berhasil ditambahkan!");
        setShowAddModal(false);
        setFormData({
          nama: "",
          nik: "",
          noHp: "",
          alamat: "",
          jenis: "KASIR",
          gajiPokok: "",
          tunjanganMakan: "",
          totalPinjaman: "",
        });
        setKaryawanList([]);
        setNextCursor(null);
        fetchKaryawan(true);
      } else {
        toast.error(data.error || "Gagal menambahkan karyawan");
      }
    } catch (error) {
      console.error("Error adding karyawan:", error);
      toast.error("Terjadi kesalahan saat menambahkan karyawan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (karyawan: Karyawan) => {
    setEditingKaryawan({
      id: karyawan.id,
      data: {
        nama: karyawan.nama,
        nik: karyawan.nik,
        noHp: karyawan.noHp || "",
        alamat: karyawan.alamat || "",
        jenis: karyawan.jenis,
        gajiPokok: karyawan.gajiPokok.toString(),
        tunjanganMakan: karyawan.tunjanganMakan.toString(),
        totalPinjaman: karyawan.totalPinjaman.toString(),
      },
    });
    setShowEditModal(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingKaryawan) return;

    setIsSubmitting(true);

    try {
      const submitData = {
        nama: editingKaryawan.data.nama,
        nik: editingKaryawan.data.nik,
        noHp: editingKaryawan.data.noHp || null,
        alamat: editingKaryawan.data.alamat || null,
        jenis: editingKaryawan.data.jenis,
        gajiPokok: parseInt(editingKaryawan.data.gajiPokok) || 0,
        tunjanganMakan: parseInt(editingKaryawan.data.tunjanganMakan) || 0,
        totalPinjaman: parseInt(editingKaryawan.data.totalPinjaman) || 0,
      };

      const res = await fetch(`/api/karyawan/${editingKaryawan.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Karyawan berhasil diupdate!");
        setShowEditModal(false);
        setEditingKaryawan(null);
        setKaryawanList((prev) =>
          prev.map((k) => (k.id === data.id ? data : k))
        );
      } else {
        toast.error(data.error || "Gagal mengupdate karyawan");
      }
    } catch (error) {
      console.error("Error updating karyawan:", error);
      toast.error("Terjadi kesalahan saat mengupdate karyawan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Apakah Anda yakin ingin menonaktifkan karyawan "${nama}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/karyawan/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Karyawan berhasil dinonaktifkan!");
        setKaryawanList((prev) => prev.filter((k) => k.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error || "Gagal menonaktifkan karyawan");
      }
    } catch (error) {
      console.error("Error deleting karyawan:", error);
      toast.error("Terjadi kesalahan saat menonaktifkan karyawan");
    }
  };

  const handleRefresh = () => {
    setSearchTerm("");
    setKaryawanList([]);
    setNextCursor(null);
    fetchKaryawan(true);
  };

  const openPayModal = (karyawan: Karyawan) => {
    setPayKaryawan(karyawan);
    setPayPeriod("BULANAN");
    const defaultNominal = estimasiGajiMap[karyawan.id] ?? 0;
    setPayNominal(defaultNominal ? defaultNominal.toString() : "");
    setPayNote("");
    setShowPayModal(true);
  };

  const closePayModal = () => {
    setShowPayModal(false);
    setPayKaryawan(null);
  };

  const handlePaySubmit = async () => {
    if (!payKaryawan) return;
    const nominalValue = Number(payNominal.replace(/[^0-9]/g, ""));
    if (!nominalValue || nominalValue <= 0) {
      toast.error("Nominal pembayaran tidak valid");
      return;
    }

    const payload: any = {
      karyawanId: payKaryawan.id,
      periode: payPeriod,
      bulan: selectedMonth,
      nominal: nominalValue,
      catatan: payNote || null,
    };
    if (payPeriod === "MINGGUAN") {
      payload.minggu = selectedWeek;
    }

    try {
      const res = await fetch("/api/penggajian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Pembayaran gaji berhasil disimpan");
        closePayModal();
        fetchKaryawan(true);
      } else {
        toast.error(data.error || "Gagal menyimpan pembayaran gaji");
      }
    } catch (error) {
      console.error("Error saving pembayaran gaji:", error);
      toast.error("Terjadi kesalahan saat menyimpan pembayaran");
    }
  };

  const openSlipModal = (karyawan: Karyawan) => {
    setSlipKaryawan(karyawan);
    setShowSlipModal(true);
  };

  const closeSlipModal = () => {
    setShowSlipModal(false);
    setSlipKaryawan(null);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedKaryawan = [...karyawanList].sort((a, b) => {
    const aVal = a[sortField as keyof Karyawan];
    const bVal = b[sortField as keyof Karyawan];

    if (aVal === null) return 1;
    if (bVal === null) return -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });

  const getTotalGajiPokok = () => {
    return karyawanList.reduce((sum, k) => sum + k.gajiPokok, 0);
  };

  const getTotalPinjaman = () => {
    return karyawanList.reduce((sum, k) => sum + k.totalPinjaman, 0);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field)
      return <ChevronDown className="w-4 h-4 text-gray-400" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="w-4 h-4 text-blue-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-blue-600" />
    );
  };

  const getEstimasiBreakdown = (karyawan: Karyawan) => {
    const totalBulanan = karyawan.gajiPokok + karyawan.tunjanganMakan;
    const totalEstimasi = estimasiGajiMap[karyawan.id] ?? 0;
    if (totalBulanan <= 0 || totalEstimasi <= 0) {
      return { pokok: 0, tunjangan: 0, total: totalEstimasi };
    }
    const ratio = Math.max(0, Math.min(1, totalEstimasi / totalBulanan));
    const pokok = Math.round(karyawan.gajiPokok * ratio);
    const tunjangan = Math.max(0, totalEstimasi - pokok);
    return { pokok, tunjangan, total: totalEstimasi };
  };

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
                  Data Karyawan
                </h1>
                <p className="text-blue-100 text-lg">
                  Kelola informasi karyawan dan penggajian
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="group bg-white hover:bg-blue-50 text-blue-600 px-6 py-3 rounded-xl flex items-center gap-2 transition-all font-semibold shadow-lg hover:shadow-xl hover:scale-105 transform"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                Tambah Karyawan
              </button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
                  Total Gaji Pokok
                </p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  {formatRupiah(getTotalGajiPokok())}
                </p>
                <p className="text-xs text-green-400 mt-2">Per bulan</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Pinjaman
                </p>
                <p className="text-2xl font-bold text-orange-600 mt-2">
                  {formatRupiah(getTotalPinjaman())}
                </p>
                <p className="text-xs text-orange-400 mt-2">Akumulasi</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Wallet className="w-8 h-8 text-white" />
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
                placeholder="Cari nama, NIK, nomor HP..."
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
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                />
              </div>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
              >
                {Array.from({ length: maxWeek }, (_, i) => i + 1).map(
                  (week) => (
                    <option key={week} value={week}>
                      Minggu {week}
                    </option>
                  )
                )}
              </select>
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
        ) : sortedKaryawan.length === 0 ? (
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
                      <th className="px-6 py-4 text-left">
                        <button
                          onClick={() => handleSort("nama")}
                          className="flex items-center gap-2 font-bold uppercase text-sm tracking-wide hover:text-blue-100 transition-colors"
                        >
                          Nama
                          <SortIcon field="nama" />
                        </button>
                      </th>
                      <th className="px-6 py-4 text-left">
                        <button
                          onClick={() => handleSort("nik")}
                          className="flex items-center gap-2 font-bold uppercase text-sm tracking-wide hover:text-blue-100 transition-colors"
                        >
                          NIK
                          <SortIcon field="nik" />
                        </button>
                      </th>
                      <th className="px-6 py-4 text-left">
                        <button
                          onClick={() => handleSort("jenis")}
                          className="flex items-center gap-2 font-bold uppercase text-sm tracking-wide hover:text-blue-100 transition-colors"
                        >
                          Jenis
                          <SortIcon field="jenis" />
                        </button>
                      </th>
                      <th className="px-6 py-4 text-left">
                        <button
                          onClick={() => handleSort("gajiPokok")}
                          className="flex items-center gap-2 font-bold uppercase text-sm tracking-wide hover:text-blue-100 transition-colors"
                        >
                          Gaji Pokok
                          <SortIcon field="gajiPokok" />
                        </button>
                      </th>
                      <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                        Estimasi Gaji
                      </th>
                      <th className="px-6 py-4 text-left font-bold uppercase text-sm tracking-wide">
                        Estimasi Mingguan
                      </th>
                      <th className="px-6 py-4 text-center font-bold uppercase text-sm tracking-wide">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedKaryawan.map((karyawan, index) => (
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
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {karyawan.noHp || "-"}
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
                          <div>
                            <p className="font-bold text-green-600">
                              {formatRupiah(karyawan.gajiPokok)}
                            </p>
                            <p className="text-xs text-gray-500">
                              + {formatRupiah(karyawan.tunjanganMakan)}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const weeks =
                              pembayaranMingguanAllMap[karyawan.id]
                                ?.map((item) => item.minggu)
                                .filter(
                                  (v): v is number => typeof v === "number"
                                ) ?? [];
                            const uniqueWeeks = new Set(weeks);
                            const allWeeksPaid =
                              maxWeek > 0 &&
                              Array.from({ length: maxWeek }, (_, i) => i + 1)
                                .every((week) => uniqueWeeks.has(week));
                            const hasMonthly = Boolean(
                              pembayaranBulananMap[karyawan.id]
                            );
                            const weeklyPaidTotal =
                              pembayaranMingguanTotalMap[karyawan.id] ?? 0;
                            const estimasiBulanan =
                              estimasiGajiMap[karyawan.id] ?? 0;
                            const estimasiDisplay = allWeeksPaid || hasMonthly
                              ? estimasiBulanan
                              : Math.max(0, estimasiBulanan - weeklyPaidTotal);
                            return (
                              <p className="font-bold text-blue-600">
                                {formatRupiah(estimasiDisplay)}
                              </p>
                            );
                          })()}
                          <p className="text-xs text-gray-500">
                            Bulan: {currentMonthLabel}
                          </p>
                          {(() => {
                            const weeks =
                              pembayaranMingguanAllMap[karyawan.id]
                                ?.map((item) => item.minggu)
                                .filter(
                                  (v): v is number => typeof v === "number"
                                ) ?? [];
                            const uniqueWeeks = new Set(weeks);
                            const allWeeksPaid =
                              maxWeek > 0 &&
                              Array.from({ length: maxWeek }, (_, i) => i + 1)
                                .every((week) => uniqueWeeks.has(week));
                            const hasMonthly = Boolean(
                              pembayaranBulananMap[karyawan.id]
                            );
                            const paid =
                              hasMonthly ||
                              allWeeksPaid;
                            return (
                              <p
                                className={`text-xs font-semibold mt-1 ${
                                  paid ? "text-green-600" : "text-orange-600"
                                }`}
                              >
                                {paid ? "Sudah dibayar" : "Belum dibayar"}
                              </p>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-indigo-600">
                            {formatRupiah(estimasiMingguanMap[karyawan.id] ?? 0)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Minggu: {currentWeekLabel}
                          </p>
                          <p
                            className={`text-xs font-semibold mt-1 ${
                              pembayaranMingguanMap[karyawan.id] ||
                              pembayaranBulananMap[karyawan.id]
                                ? "text-green-600"
                                : "text-orange-600"
                            }`}
                          >
                            {pembayaranMingguanMap[karyawan.id] ||
                            pembayaranBulananMap[karyawan.id]
                              ? "Sudah dibayar"
                              : "Belum dibayar"}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedKaryawan(karyawan)}
                              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors group/btn"
                              title="Lihat Detail"
                            >
                              <Eye className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                            </button>
                            <button
                              onClick={() => openSlipModal(karyawan)}
                              className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors group/btn"
                              title="Cetak Slip Gaji"
                            >
                              <Printer className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                            </button>
                            <button
                              onClick={() => openPayModal(karyawan)}
                              className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors group/btn"
                              title="Bayar Gaji"
                            >
                              <Wallet className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                            </button>
                            <button
                              onClick={() => handleEdit(karyawan)}
                              className="p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200 transition-colors group/btn"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(karyawan.id, karyawan.nama)
                              }
                              className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors group/btn"
                              title="Nonaktifkan"
                            >
                              <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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

        {/* Detail Modal */}
        {selectedKaryawan && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedKaryawan(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                      <Eye className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">
                      Detail Karyawan
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedKaryawan(null)}
                    className="text-white hover:bg-white/20 p-3 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5">
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-2">
                      Nama Karyawan
                    </p>
                    <p className="text-gray-900 text-xl font-bold">
                      {selectedKaryawan.nama}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-5">
                    <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mb-2">
                      Jenis Karyawan
                    </p>
                    <p className="text-gray-900 text-xl font-bold">
                      {selectedKaryawan.jenis}
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-white p-2 rounded-lg">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                      NIK
                    </p>
                  </div>
                  <p className="text-gray-900 font-mono font-bold text-lg pl-11">
                    {selectedKaryawan.nik}
                  </p>
                </div>

                {selectedKaryawan.alamat && (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-white p-2 rounded-lg">
                        <MapPin className="w-5 h-5 text-gray-600" />
                      </div>
                      <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                        Alamat
                      </p>
                    </div>
                    <p className="text-gray-900 leading-relaxed pl-11">
                      {selectedKaryawan.alamat}
                    </p>
                  </div>
                )}

                {selectedKaryawan.noHp && (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-white p-2 rounded-lg">
                        <Phone className="w-5 h-5 text-gray-600" />
                      </div>
                      <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                        Nomor HP
                      </p>
                    </div>
                    <p className="text-gray-900 font-semibold text-lg pl-11">
                      {selectedKaryawan.noHp}
                    </p>
                  </div>
                )}

                {/* Gaji Section */}
                <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-6 border-2 border-green-200">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="bg-green-600 p-3 rounded-xl">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">
                      Informasi Gaji
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-md">
                      <p className="text-xs text-gray-500 font-semibold uppercase mb-2">
                        Gaji Pokok
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatRupiah(selectedKaryawan.gajiPokok)}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-md">
                      <p className="text-xs text-gray-500 font-semibold uppercase mb-2">
                        Tunjangan Makan
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatRupiah(selectedKaryawan.tunjanganMakan)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-3">
                      Estimasi Gaji Bulan Ini (Prorate)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-4 shadow-md">
                        <p className="text-xs text-gray-500 font-semibold uppercase mb-2">
                          Estimasi Gaji Pokok
                        </p>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatRupiah(
                            getEstimasiBreakdown(selectedKaryawan).pokok
                          )}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-md">
                        <p className="text-xs text-gray-500 font-semibold uppercase mb-2">
                          Estimasi Tunjangan
                        </p>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatRupiah(
                            getEstimasiBreakdown(selectedKaryawan).tunjangan
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pinjaman Section */}
                <div className="bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 rounded-2xl p-6 border-2 border-orange-200">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="bg-orange-600 p-3 rounded-xl">
                      <Wallet className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">
                      Informasi Pinjaman
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-md">
                      <p className="text-xs text-gray-500 font-semibold uppercase mb-2">
                        Total Pinjaman
                      </p>
                      <p className="text-xl font-bold text-orange-600">
                        {formatRupiah(selectedKaryawan.totalPinjaman)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                        Tanggal Daftar
                      </p>
                    </div>
                    <p className="text-gray-900 font-semibold">
                      {formatDate(selectedKaryawan.createdAt)}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-gray-600" />
                      <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                        Terakhir Update
                      </p>
                    </div>
                    <p className="text-gray-900 font-semibold">
                      {formatDate(selectedKaryawan.updatedAt)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedKaryawan(null)}
                  className="w-full mt-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-4 rounded-xl transition-all font-bold text-base shadow-lg hover:shadow-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                      <Plus className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">
                      Tambah Karyawan Baru
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-white hover:bg-white/20 p-3 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitAdd} className="p-8">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        Nama <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="nama"
                        value={formData.nama}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                        placeholder="Masukkan nama"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        NIK <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="nik"
                        value={formData.nik}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                        placeholder="Masukkan NIK"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Phone className="w-4 h-4 text-blue-600" />
                        Nomor HP
                      </label>
                      <input
                        type="text"
                        name="noHp"
                        value={formData.noHp}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                        placeholder="Contoh: 081234567890"
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Briefcase className="w-4 h-4 text-blue-600" />
                        Jenis Karyawan <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="jenis"
                        value={formData.jenis}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                        required
                      >
                        <option value="KASIR">KASIR</option>
                        <option value="SALES">SALES</option>
                        <option value="KARYAWAN">KARYAWAN</option>
                        <option value="KEPALA_GUDANG">KEPALA GUDANG</option>
                        <option value="OWNER">OWNER</option>
                      </select>
                    </div>
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      Alamat
                    </label>
                    <textarea
                      name="alamat"
                      value={formData.alamat}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none resize-none transition-all"
                      placeholder="Masukkan alamat lengkap"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        Gaji Pokok <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="gajiPokok"
                          value={
                            formData.gajiPokok
                              ? parseInt(formData.gajiPokok).toLocaleString(
                                  "id-ID"
                                )
                              : ""
                          }
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                          placeholder="0"
                          required
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        Tunjangan Makan <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="tunjanganMakan"
                          value={
                            formData.tunjanganMakan
                              ? parseInt(
                                  formData.tunjanganMakan
                                ).toLocaleString("id-ID")
                              : ""
                          }
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                          placeholder="0"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Wallet className="w-4 h-4 text-orange-600" />
                        Total Pinjaman
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="totalPinjaman"
                          value={
                            formData.totalPinjaman
                              ? parseInt(formData.totalPinjaman).toLocaleString(
                                  "id-ID"
                                )
                              : ""
                          }
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-4 rounded-xl transition-all font-bold shadow-md hover:shadow-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-4 rounded-xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Simpan Karyawan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingKaryawan && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setShowEditModal(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-yellow-500 via-yellow-600 to-orange-600 p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                      <Edit className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">
                      Edit Karyawan
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-white hover:bg-white/20 p-3 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitEdit} className="p-8">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Building2 className="w-4 h-4 text-yellow-600" />
                        Nama <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="nama"
                        value={editingKaryawan.data.nama}
                        onChange={handleEditInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                        placeholder="Masukkan nama"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <CreditCard className="w-4 h-4 text-yellow-600" />
                        NIK <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="nik"
                        value={editingKaryawan.data.nik}
                        onChange={handleEditInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                        placeholder="Masukkan NIK"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Phone className="w-4 h-4 text-yellow-600" />
                        Nomor HP
                      </label>
                      <input
                        type="text"
                        name="noHp"
                        value={editingKaryawan.data.noHp}
                        onChange={handleEditInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                        placeholder="Contoh: 081234567890"
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Briefcase className="w-4 h-4 text-yellow-600" />
                        Jenis Karyawan <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="jenis"
                        value={editingKaryawan.data.jenis}
                        onChange={handleEditInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                        required
                      >
                        <option value="KASIR">KASIR</option>
                        <option value="SALES">SALES</option>
                        <option value="KARYAWAN">KARYAWAN</option>
                        <option value="KEPALA_GUDANG">KEPALA GUDANG</option>
                        <option value="OWNER">OWNER</option>
                      </select>
                    </div>
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <MapPin className="w-4 h-4 text-yellow-600" />
                      Alamat
                    </label>
                    <textarea
                      name="alamat"
                      value={editingKaryawan.data.alamat}
                      onChange={handleEditInputChange}
                      rows={3}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none resize-none transition-all"
                      placeholder="Masukkan alamat lengkap"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        Gaji Pokok <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="gajiPokok"
                          value={
                            editingKaryawan.data.gajiPokok
                              ? parseInt(
                                  editingKaryawan.data.gajiPokok
                                ).toLocaleString("id-ID")
                              : ""
                          }
                          onChange={handleEditInputChange}
                          className="w-full pl-12 pr-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                          placeholder="0"
                          required
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        Tunjangan Makan <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="tunjanganMakan"
                          value={
                            editingKaryawan.data.tunjanganMakan
                              ? parseInt(
                                  editingKaryawan.data.tunjanganMakan
                                ).toLocaleString("id-ID")
                              : ""
                          }
                          onChange={handleEditInputChange}
                          className="w-full pl-12 pr-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                          placeholder="0"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Wallet className="w-4 h-4 text-orange-600" />
                        Total Pinjaman
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="totalPinjaman"
                          value={
                            editingKaryawan.data.totalPinjaman
                              ? parseInt(
                                  editingKaryawan.data.totalPinjaman
                                ).toLocaleString("id-ID")
                              : ""
                          }
                          onChange={handleEditInputChange}
                          className="w-full pl-12 pr-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-4 rounded-xl transition-all font-bold shadow-md hover:shadow-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-6 py-4 rounded-xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Update Karyawan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showSlipModal && slipKaryawan && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={closeSlipModal}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                      <Printer className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        Cetak Slip Gaji
                      </h2>
                      <p className="text-blue-100 text-sm">
                        {slipKaryawan.nama} • {slipKaryawan.nik}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeSlipModal}
                    className="text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        `/api/laporan/slip?karyawanId=${slipKaryawan.id}&month=${selectedMonth}`,
                        "_blank"
                      )
                    }
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl transition-all font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    Slip Bulanan
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        `/api/laporan/slip?karyawanId=${slipKaryawan.id}&month=${selectedMonth}&week=${selectedWeek}&period=weekly`,
                        "_blank"
                      )
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl transition-all font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    Slip Mingguan
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeSlipModal}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-3 rounded-xl transition-all font-bold shadow-md hover:shadow-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {showPayModal && payKaryawan && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={closePayModal}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-green-600 via-green-700 to-emerald-700 p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                      <Wallet className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        Pembayaran Gaji
                      </h2>
                      <p className="text-green-100 text-sm">
                        {payKaryawan.nama} • {payKaryawan.nik}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closePayModal}
                    className="text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    Periode
                  </label>
                  <select
                    value={payPeriod}
                    onChange={(e) => {
                      const next = e.target.value as "BULANAN" | "MINGGUAN";
                      setPayPeriod(next);
                      const nominal =
                        next === "BULANAN"
                          ? estimasiGajiMap[payKaryawan.id] ?? 0
                          : estimasiMingguanMap[payKaryawan.id] ?? 0;
                      setPayNominal(nominal ? nominal.toString() : "");
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent outline-none transition-all"
                  >
                    <option value="BULANAN">Bulanan</option>
                    <option value="MINGGUAN">Mingguan</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      Bulan
                    </label>
                    <input
                      type="month"
                      value={selectedMonth}
                      disabled
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      Minggu
                    </label>
                    <select
                      value={selectedWeek}
                      disabled={payPeriod !== "MINGGUAN"}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                    >
                      <option value={1}>Minggu 1</option>
                      <option value={2}>Minggu 2</option>
                      <option value={3}>Minggu 3</option>
                      <option value={4}>Minggu 4</option>
                      <option value={5}>Minggu 5</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    Nominal Dibayar
                  </label>
                  <input
                    type="text"
                    value={
                      payNominal
                        ? parseInt(payNominal).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) =>
                      setPayNominal(parseRupiahInput(e.target.value))
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent outline-none transition-all"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    Catatan
                  </label>
                  <textarea
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent outline-none resize-none transition-all"
                    placeholder="Opsional"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={closePayModal}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-3 rounded-xl transition-all font-bold shadow-md hover:shadow-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handlePaySubmit}
                    className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl transition-all font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    Simpan Pembayaran
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

export default DataKaryawanPage;
