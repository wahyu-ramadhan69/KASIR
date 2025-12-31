"use client";
import { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Minus,
  Truck,
  Calendar,
  User,
  Search,
  X,
  Check,
  ArrowLeft,
  RefreshCw,
  Trash2,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Karyawan {
  id: number;
  nama: string;
  nik: string;
  jenis: string;
}

interface Barang {
  id: number;
  namaBarang: string;
  jumlahPerKemasan: number;
  stok: number;
  hargaJual: number;
  jenisKemasan: string;
  limitPenjualan: number;
  berat?: number | string;
}

interface ManifestItem {
  barangId: number;
  totalItem: number;
}

const CreatePerjalananPage = () => {
  const router = useRouter();
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchBarang, setSearchBarang] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [searchKaryawan, setSearchKaryawan] = useState("");
  const [showKaryawanDropdown, setShowKaryawanDropdown] = useState(false);
  const [searchingKaryawan, setSearchingKaryawan] = useState(false);
  const [expandKaryawanSearch, setExpandKaryawanSearch] = useState(false);
  const [todaySales, setTodaySales] = useState<{ [barangId: number]: number }>(
    {}
  );

  // Form state
  const [selectedKaryawan, setSelectedKaryawan] = useState<Karyawan | null>(
    null
  );
  const [kotaTujuan, setKotaTujuan] = useState("");
  const [tanggalBerangkat, setTanggalBerangkat] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [manifestItems, setManifestItems] = useState<ManifestItem[]>([]);

  useEffect(() => {
    fetchBarang();
    fetchTodaySales();
    const today = new Date().toISOString().split("T")[0];
    setTanggalBerangkat(today);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchKaryawan.trim().length >= 2) {
        searchKaryawanByKeyword(searchKaryawan);
      } else if (searchKaryawan.trim().length === 0) {
        setKaryawanList([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchKaryawan]);

  const fetchKaryawan = async () => {
    try {
      const res = await fetch("/api/karyawan?limit=100");
      const data = await res.json();
      if (data.data) {
        setKaryawanList(data.data);
      }
    } catch (error) {
      console.error("Error fetching karyawan:", error);
      toast.error("Gagal mengambil data karyawan");
    }
  };

  const fetchBarang = async () => {
    try {
      const res = await fetch("/api/barang");
      const data = await res.json();
      if (data.success) {
        setBarangList(data.data);
      }
    } catch (error) {
      console.error("Error fetching barang:", error);
      toast.error("Gagal mengambil data barang");
    }
  };

  const fetchTodaySales = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/penjualan/daily-summary?date=${today}`);
      const data = await res.json();
      if (data.success && data.data) {
        const map: { [barangId: number]: number } = {};
        data.data.forEach((item: any) => {
          map[item.barangId] = Number(item.totalTerjual) || 0;
        });
        setTodaySales(map);
      }
    } catch (error) {
      console.error("Error fetching today sales:", error);
    }
  };

  const searchKaryawanByKeyword = async (keyword: string) => {
    setSearchingKaryawan(true);
    try {
      const res = await fetch(
        `/api/karyawan?search=${encodeURIComponent(keyword)}&limit=5`
      );
      const data = await res.json();
      if (data.data) {
        const salesOnly = data.data.filter(
          (k: Karyawan) => k.jenis === "SALES"
        );
        setKaryawanList(salesOnly);
      }
    } catch (error) {
      console.error("Error searching karyawan:", error);
    } finally {
      setSearchingKaryawan(false);
    }
  };

  const getTodaySold = (barangId: number): number => todaySales[barangId] || 0;

  const getManifestPcsForBarang = (barangId: number): number => {
    const item = manifestItems.find((i) => i.barangId === barangId);
    return item ? item.totalItem : 0;
  };

  const handleAddManifestItem = async (
    barang: Barang,
    type: "dus" | "pcs" = "dus"
  ) => {
    try {
      // Fetch stok terbaru dari database
      const res = await fetch(`/api/barang/${barang.id}`);
      const data = await res.json();

      if (!data.success) {
        toast.error("Gagal mengecek stok barang");
        return;
      }

      const currentStok = Number(data.data.stok);
      const jumlahPerKemasan = Number(data.data.jumlahPerKemasan);
      const limitPenjualan = Number(data.data.limitPenjualan || 0);
      const todaySold = getTodaySold(barang.id);

      // Hitung total yang sudah ada di manifest untuk barang ini
      const existing = manifestItems.find(
        (item) => item.barangId === barang.id
      );
      let totalDiManifest = existing ? existing.totalItem : 0;

      // Hitung sisa stok yang tersedia
      const sisaStok = currentStok - totalDiManifest;

      // Auto-detect: jika sisa stok < jumlahPerKemasan, otomatis tambahkan per pcs
      let finalType = type;
      if (type === "dus" && sisaStok < jumlahPerKemasan) {
        finalType = "pcs";
      }

      // Hitung total setelah penambahan
      let tambahan = 0;
      if (finalType === "dus") {
        tambahan = jumlahPerKemasan;
      } else {
        tambahan = 1;
      }

      const totalSetelahTambah = totalDiManifest + tambahan;

      // Validasi stok
      if (totalSetelahTambah > currentStok) {
        toast.error(
          `Stok tidak mencukupi! Stok tersedia: ${currentStok} pcs, sudah di manifest: ${totalDiManifest} pcs, sisa: ${sisaStok} pcs`
        );
        return;
      }

      if (limitPenjualan > 0) {
        const totalIfAdded = todaySold + totalSetelahTambah;
        if (totalIfAdded > limitPenjualan) {
          const remaining = Math.max(
            0,
            limitPenjualan - (todaySold + totalDiManifest)
          );
          const sisaDus = Math.floor(remaining / jumlahPerKemasan);
          toast.error(
            `Limit penjualan harian tercapai!\nTerjual: ${todaySold} item • Di manifest: ${totalDiManifest} item\nSisa limit: ${remaining} item / ${sisaDus} Dus`
          );
          return;
        }
      }

      // Jika validasi lolos, tambahkan ke manifest
      if (existing) {
        // Update total item
        setManifestItems(
          manifestItems.map((item) =>
            item.barangId === barang.id
              ? { ...item, totalItem: item.totalItem + tambahan }
              : item
          )
        );
        toast.success(`${barang.namaBarang} +${tambahan} pcs`);
      } else {
        // Item baru
        setManifestItems([
          ...manifestItems,
          { barangId: barang.id, totalItem: tambahan },
        ]);
        toast.success(`${barang.namaBarang} ditambahkan (${tambahan} pcs)`);
      }

      // Refresh data barang untuk update tampilan stok
      await fetchBarang();
    } catch (error) {
      console.error("Error adding manifest item:", error);
      toast.error("Terjadi kesalahan saat menambahkan barang");
    }
  };

  const handleUpdateManifestItem = async (barangId: number, value: number) => {
    let warningMessage: string | null = null;
    try {
      // Fetch stok terbaru dari database
      const res = await fetch(`/api/barang/${barangId}`);
      const data = await res.json();

      if (!data.success) {
        toast.error("Gagal mengecek stok barang");
        return;
      }

      const currentStok = Number(data.data.stok);
      let newTotalItem = Math.max(0, value);

      // Validasi stok
      if (newTotalItem > currentStok) {
        toast.error(`Stok tidak mencukupi! Stok tersedia: ${currentStok} pcs`);
        return;
      }

      const limitPenjualan = Number(data.data.limitPenjualan || 0);
      if (limitPenjualan > 0) {
        const todaySold = getTodaySold(barangId);
        const totalIfUpdated = todaySold + newTotalItem;
        if (totalIfUpdated > limitPenjualan) {
          const allowed = Math.max(0, limitPenjualan - todaySold);
          warningMessage = `Limit penjualan harian telah tercapai !`;
          newTotalItem = allowed;
        }
      }

      // Update manifest item
      setManifestItems(
        manifestItems.map((item) =>
          item.barangId === barangId
            ? { ...item, totalItem: newTotalItem }
            : item
        )
      );

      // Refresh data barang
      await fetchBarang();
    } catch (error) {
      console.error("Error updating manifest item:", error);
      toast.error("Terjadi kesalahan saat mengupdate barang");
    } finally {
      if (warningMessage) {
        toast.error(warningMessage);
      }
    }
  };

  const handleRemoveManifestItem = (barangId: number) => {
    setManifestItems(
      manifestItems.filter((item) => item.barangId !== barangId)
    );
    const barang = barangList.find((b) => b.id === barangId);
    if (barang) {
      toast.success(`${barang.namaBarang} dihapus dari manifest`);
    }
  };

  const handleOpenConfirmModal = () => {
    if (manifestItems.length === 0) {
      toast.error("Tambahkan minimal 1 barang ke manifest");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleCreatePerjalanan = async () => {
    // Validasi form di dalam modal
    if (!selectedKaryawan || !kotaTujuan || !tanggalBerangkat) {
      toast.error("Lengkapi semua field yang wajib");
      return;
    }

    if (manifestItems.length === 0) {
      toast.error("Tambahkan minimal 1 barang ke manifest");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/penjualan-luar-kota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          karyawanId: selectedKaryawan.id,
          kotaTujuan,
          tanggalBerangkat: new Date(tanggalBerangkat).toISOString(),
          keterangan,
          manifestBarang: manifestItems,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Perjalanan berhasil dibuat");
        setShowConfirmModal(false);
        handleResetForm();
        setSearchBarang("");
        await fetchBarang(); // refresh stok barang setelah dikurangi
        await fetchTodaySales();
        // router.push("/dashboard/admin/penjualan-sales/luar-kota"); // tetap di halaman agar form kosong dan stok ter-update
      } else {
        toast.error(data.message || "Gagal membuat perjalanan");
      }
    } catch (error) {
      console.error("Error creating perjalanan:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setSelectedKaryawan(null);
    setKotaTujuan("");
    setKeterangan("");
    setManifestItems([]);
    const today = new Date().toISOString().split("T")[0];
    setTanggalBerangkat(today);
    toast.success("Form direset");
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatBeratKg = (grams: number): string => {
    const kg = grams / 1000;
    return `${kg.toLocaleString("id-ID", {
      minimumFractionDigits: kg % 1 === 0 ? 0 : 3,
      maximumFractionDigits: 3,
    })} KG`;
  };

  const filteredBarang = barangList.filter((b) =>
    b.namaBarang.toLowerCase().includes(searchBarang.toLowerCase())
  );

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
                <ArrowLeft className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Buat Perjalanan Baru
                </h1>
                <p className="text-blue-100 text-sm">
                  Input data perjalanan sales ke luar kota
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard/admin/penjualan-sales/kanvas"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
              >
                <Truck className="w-4 h-4" />
                Kanvas
              </Link>
              <button
                onClick={handleResetForm}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Transaksi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        <div className="flex gap-3 h-full min-h-0">
          {/* Left Side - Daftar Barang (60%) - Enhanced Interactive Design */}
          <div className="w-[60%] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
              <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-lg shadow-md">
                  <Package className="w-5 h-5 text-white" />
                </div>
                Daftar Produk
                <span className="ml-auto text-xs bg-blue-600 text-white px-2.5 py-1 rounded-full font-bold">
                  {filteredBarang.length} produk
                </span>
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 z-10" />
                <input
                  type="text"
                  placeholder="Cari produk..."
                  value={searchBarang}
                  onChange={(e) => setSearchBarang(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium shadow-sm transition-all duration-200"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
              <div className="grid grid-cols-2 gap-3">
                  {filteredBarang.map((barang) => {
                    const isLowStock = barang.stok < barang.jumlahPerKemasan;
                    const isOutOfStock = barang.stok <= 0;
                    const isMediumStock =
                      barang.stok >= barang.jumlahPerKemasan &&
                      barang.stok < barang.jumlahPerKemasan * 5;
                  const isInManifest = manifestItems.some(
                    (item) => item.barangId === barang.id
                  );

                  // Hitung stok dalam kardus dan pcs
                  const stokDus = Math.floor(
                    Number(barang.stok) / Number(barang.jumlahPerKemasan)
                  );
                  const stokPcs =
                    Number(barang.stok) % Number(barang.jumlahPerKemasan);

                  // Limit penjualan
                  const limitPenjualan = Number(barang.limitPenjualan || 0);
                  const hasLimit = limitPenjualan > 0;
                  const todaySold = getTodaySold(barang.id);
                  const inManifest = getManifestPcsForBarang(barang.id);
                  const totalUsed = todaySold + inManifest;
                  const perDus = Number(barang.jumlahPerKemasan) || 1;
                  const sisaLimit = hasLimit
                    ? Math.max(0, limitPenjualan - totalUsed)
                    : Infinity;
                  const terjualDus = Math.floor(totalUsed / perDus);
                  const sisaDus = Math.floor(sisaLimit / perDus);
                  const isLimitReached = hasLimit && sisaLimit <= 0;
                  const isNearLimit =
                    hasLimit && !isLimitReached && sisaLimit <= perDus;

                  // Disable button jika stok habis atau limit tercapai
                  const isDisabled = barang.stok === 0 || isLimitReached;

                  return (
                    <div
                      key={barang.id}
                      className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                        isDisabled
                          ? "border-red-300 bg-gradient-to-br from-red-50 to-red-100/50 shadow-md"
                          : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-xl hover:shadow-blue-100/50"
                      }`}
                    >
                      {/* Gradient Overlay on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                      {/* In Manifest Indicator */}
                      {isInManifest && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg z-10 animate-in fade-in zoom-in duration-300">
                          <Check className="w-2.5 h-2.5" />
                          Di Manifest
                        </div>
                      )}

                      {/* Limit Reached Indicator */}
                      {isLimitReached && (
                        <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg z-10 animate-in fade-in zoom-in duration-300">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Limit Tercapai
                        </div>
                      )}

                      <div className="relative flex items-center justify-between p-3">
                        {/* Left Side - Product Info */}
                        <div className="flex-1 min-w-0 pr-2">
                          {/* Product Name with Icon */}
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <div className="bg-blue-100 p-1 rounded-lg mt-0.5 group-hover:bg-blue-200 transition-colors">
                              <Package className="w-3 h-3 text-blue-600" />
                            </div>
                            <h4 className="font-extrabold text-gray-900 text-xs leading-tight group-hover:text-blue-700 transition-colors">
                              {barang.namaBarang}
                            </h4>
                          </div>

                          {/* Product Details */}
                          <div className="ml-6 space-y-1">
                            <p className="text-[10px] text-gray-600 font-semibold flex items-center gap-1">
                              <span className="bg-gray-200 px-1.5 py-0.5 rounded-md">
                                {formatBeratKg(Number(barang.berat || 0))}
                              </span>
                              <span className="text-gray-400">•</span>
                              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md">
                                {barang.jumlahPerKemasan} pcs/
                                {barang.jenisKemasan}
                              </span>
                            </p>

                            {/* Price */}
                            <div className="flex items-center gap-1.5">
                              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-lg shadow-md group-hover:shadow-lg transition-shadow">
                                <p className="text-[11px] font-extrabold">
                                  {formatRupiah(barang.hargaJual)}
                                  <span className="text-[9px] font-medium opacity-90 ml-0.5">
                                    /{barang.jenisKemasan}
                                  </span>
                                </p>
                              </div>

                              {/* Stock Badge */}
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-lg font-bold shadow-sm flex items-center gap-1 ${
                                  isLowStock
                                    ? "bg-red-500 text-white animate-pulse"
                                    : isMediumStock
                                    ? "bg-yellow-400 text-yellow-900"
                                    : "bg-green-500 text-white"
                                }`}
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isLowStock
                                      ? "bg-white"
                                      : isMediumStock
                                      ? "bg-yellow-900"
                                      : "bg-white"
                                  }`}
                                ></div>
                                Stok: {stokDus}/{barang.jenisKemasan}
                                {stokPcs > 0 && ` ${stokPcs}/pcs`}
                              </span>
                            </div>

                            {/* Low Stock Warning */}
                            {isLowStock && (
                              <div className="flex items-center gap-1.5 text-red-600 animate-in slide-in-from-left duration-300">
                                <AlertCircle className="w-3 h-3" />
                                <span className="text-[10px] font-bold">
                                  {isOutOfStock
                                    ? "Stok Habis!"
                                    : "Stok Menipis!"}
                                </span>
                              </div>
                            )}

                            {/* Limit Penjualan Info */}
                            {hasLimit && (
                              <div
                                className={`flex items-center gap-1 mt-1 ${
                                  isLimitReached
                                    ? "text-red-600 animate-pulse"
                                    : isNearLimit
                                    ? "text-orange-600"
                                    : "text-blue-600"
                                }`}
                              >
                                <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded-lg border border-current/20 text-[10px] font-bold">
                                  <AlertCircle className="w-3 h-3" />
                                  <span className="flex flex-wrap items-center gap-1">
                                    Terjual: {totalUsed} item / {terjualDus} Dus • Sisa limit {sisaLimit} item / {sisaDus} Dus
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Limit Reached Warning */}
                            {isLimitReached && (
                              <div className="flex items-center gap-1.5 text-red-600 animate-in slide-in-from-left duration-300">
                                <AlertCircle className="w-3 h-3" />
                                <span className="text-[10px] font-bold">
                                  Limit harian tercapai!
                                </span>
                              </div>
                            )}

                            {/* Near Limit Warning */}
                            {isNearLimit && !isLimitReached && (
                              <div className="flex items-center gap-1.5 text-orange-600 animate-in slide-in-from-left duration-300">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span className="text-xs font-bold">
                                  Mendekati limit!
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Side - Action Button */}
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => handleAddManifestItem(barang)}
                            disabled={isDisabled}
                            className={`relative overflow-hidden p-2 rounded-xl transition-all duration-300 transform ${
                              isDisabled
                                ? "bg-gray-300 cursor-not-allowed opacity-50"
                                : "bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl active:scale-95 group-hover:scale-110"
                            }`}
                          >
                            {/* Button Shine Effect */}
                            {!isDisabled && (
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                            )}

                            <Plus
                              className={`w-6 h-6 relative z-10 ${
                                isDisabled ? "text-gray-500" : "text-white"
                              }`}
                              strokeWidth={3}
                            />

                            {/* Ripple Effect Container */}
                            <div className="absolute inset-0 rounded-xl overflow-hidden">
                              <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-500 rounded-full"></div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Bottom Border Accent */}
                      <div
                        className={`h-1 ${
                          isLowStock
                            ? "bg-gradient-to-r from-red-400 to-red-600"
                            : "bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        }`}
                      ></div>
                    </div>
                  );
                })}

                {filteredBarang.length === 0 && (
                  <div className="col-span-2 py-12 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                      Produk tidak ditemukan
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - Manifest (40%) */}
          <div className="w-[40%] flex flex-col gap-3 h-full min-h-0">
            {/* Manifest Summary - Full height */}
            <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
              {/* Header Manifest */}
              <div className="p-4 bg-gray-50 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    <h2 className="text-sm font-bold text-gray-700">
                      Manifest
                    </h2>
                  </div>
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-md font-bold">
                    {manifestItems.length} item
                  </span>
                </div>
              </div>

              {/* Manifest Items */}
              <div className="flex-1 overflow-y-auto p-3 min-h-0 bg-gray-50">
                {manifestItems.length > 0 ? (
                  <div className="space-y-2">
                    {manifestItems.map((item) => {
                      const barang = barangList.find(
                        (b) => b.id === item.barangId
                      );
                      if (!barang) return null;

                      // Hitung jumlah kemasan dan sisa item
                      const jumlahKemasan = Math.floor(
                        Number(item.totalItem) / Number(barang.jumlahPerKemasan)
                      );
                      const sisaItem =
                        Number(item.totalItem) %
                        Number(barang.jumlahPerKemasan);

                      return (
                        <div
                          key={item.barangId}
                          className="border border-gray-200 rounded-lg p-3 bg-white"
                        >
                          {/* Item Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-extrabold text-gray-900 text-sm truncate mb-1">
                                {barang.namaBarang}
                              </h4>
                              <p className="text-xs text-gray-600 font-semibold truncate bg-gray-100 px-2 py-0.5 rounded-md inline-block">
                                {formatRupiah(barang.hargaJual)}/
                                {barang.jenisKemasan}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                handleRemoveManifestItem(item.barangId)
                              }
                              className="text-red-500 hover:bg-red-100 p-1.5 rounded-lg transition-all flex-shrink-0 ml-2 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Quantity Controls */}
                          <div className="space-y-2">
                            {/* Jika jumlahPerKemasan > 1, tampilkan kontrol terpisah */}
                            {barang.jumlahPerKemasan > 1 ? (
                              <>
                                {/* Per Kemasan */}
                                <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100 p-2 rounded-xl">
                                  <span className="text-xs font-bold text-gray-700 uppercase">
                                    {barang.jenisKemasan}:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() =>
                                        handleUpdateManifestItem(
                                          item.barangId,
                                          Math.max(
                                            0,
                                            item.totalItem -
                                              barang.jumlahPerKemasan
                                          )
                                        )
                                      }
                                      className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                    >
                                      <Minus
                                        className="w-3.5 h-3.5"
                                        strokeWidth={3}
                                      />
                                    </button>
                                    <input
                                      type="number"
                                      value={jumlahKemasan}
                                      onChange={(e) => {
                                        const newJumlahKemasan =
                                          parseInt(e.target.value) || 0;
                                        const newTotalItem =
                                          newJumlahKemasan *
                                            barang.jumlahPerKemasan +
                                          sisaItem;
                                        handleUpdateManifestItem(
                                          item.barangId,
                                          newTotalItem
                                        );
                                      }}
                                      className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                      min="0"
                                    />
                                    <button
                                      onClick={() =>
                                        handleUpdateManifestItem(
                                          item.barangId,
                                          item.totalItem +
                                            barang.jumlahPerKemasan
                                        )
                                      }
                                      className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                    >
                                      <Plus
                                        className="w-3.5 h-3.5"
                                        strokeWidth={3}
                                      />
                                    </button>
                                  </div>
                                </div>

                                {/* Per Item */}
                                <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-orange-100 p-2 rounded-xl">
                                  <span className="text-xs font-bold text-gray-700 uppercase">
                                    Pcs:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() =>
                                        handleUpdateManifestItem(
                                          item.barangId,
                                          Math.max(0, item.totalItem - 1)
                                        )
                                      }
                                      className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                    >
                                      <Minus
                                        className="w-3.5 h-3.5"
                                        strokeWidth={3}
                                      />
                                    </button>
                                    <input
                                      type="number"
                                      value={sisaItem}
                                      onChange={(e) => {
                                        const newSisaItem =
                                          parseInt(e.target.value) || 0;
                                        // Pastikan sisaItem tidak melebihi jumlahPerKemasan - 1
                                        const validSisaItem = Math.min(
                                          newSisaItem,
                                          barang.jumlahPerKemasan - 1
                                        );
                                        const newTotalItem =
                                          jumlahKemasan *
                                            barang.jumlahPerKemasan +
                                          validSisaItem;
                                        handleUpdateManifestItem(
                                          item.barangId,
                                          newTotalItem
                                        );
                                      }}
                                      className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                      min="0"
                                      max={barang.jumlahPerKemasan - 1}
                                    />
                                    <button
                                      onClick={() =>
                                        handleUpdateManifestItem(
                                          item.barangId,
                                          item.totalItem + 1
                                        )
                                      }
                                      className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                    >
                                      <Plus
                                        className="w-3.5 h-3.5"
                                        strokeWidth={3}
                                      />
                                    </button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              /* Jika jumlahPerKemasan = 1, hanya tampilkan kontrol per item */
                              <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-orange-100 p-2 rounded-xl">
                                <span className="text-xs font-bold text-gray-700 uppercase">
                                  Item:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() =>
                                      handleUpdateManifestItem(
                                        item.barangId,
                                        Math.max(0, item.totalItem - 1)
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                  >
                                    <Minus
                                      className="w-3.5 h-3.5"
                                      strokeWidth={3}
                                    />
                                  </button>
                                  <input
                                    type="number"
                                    value={item.totalItem}
                                    onChange={(e) =>
                                      handleUpdateManifestItem(
                                        item.barangId,
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    min="0"
                                  />
                                  <button
                                    onClick={() =>
                                      handleUpdateManifestItem(
                                        item.barangId,
                                        item.totalItem + 1
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                  >
                                    <Plus
                                      className="w-3.5 h-3.5"
                                      strokeWidth={3}
                                    />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Total Item */}
                            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-2 rounded-xl border border-blue-200">
                              <span className="text-xs font-bold text-gray-700 uppercase">
                                Total:
                              </span>
                              <span className="text-sm font-bold text-blue-600">
                                {item.totalItem} item
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-medium text-sm">
                      Belum ada barang di manifest
                    </p>
                    <p className="text-gray-400 text-xs">
                      Klik barang di sebelah kiri untuk menambahkan
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-8 border-t bg-white flex gap-2">
                <button
                  onClick={handleOpenConfirmModal}
                  disabled={loading || manifestItems.length === 0}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 text-white px-6 py-5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg disabled:cursor-not-allowed text-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  Buat Perjalanan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-t-2xl">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                    <Truck className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold">Konfirmasi Perjalanan</h3>
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Form Informasi Perjalanan */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  Informasi Perjalanan
                </h4>
                <div className="space-y-3">
                  {/* Row 1 - Sales & Kota Tujuan */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-700 mb-1.5 block uppercase tracking-wide">
                        Sales <span className="text-red-500">*</span>
                      </label>
                      {!expandKaryawanSearch && !selectedKaryawan && (
                        <button
                          type="button"
                          onClick={() => setExpandKaryawanSearch(true)}
                          className="w-full px-3 py-2.5 border-2 border-blue-300 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Search className="w-4 h-4" />
                          Cari Sales
                        </button>
                      )}

                      {!expandKaryawanSearch && selectedKaryawan && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedKaryawan(null);
                            setExpandKaryawanSearch(true);
                          }}
                          className="w-full px-3 py-2.5 border-2 border-blue-400 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold text-sm transition-all duration-200 shadow-md hover:shadow-lg group text-left relative overflow-hidden"
                        >
                          <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4" />
                              <span>{selectedKaryawan.nama}</span>
                            </div>
                            <X className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                          </div>
                        </button>
                      )}

                      {expandKaryawanSearch && (
                        <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 z-10" />
                          <input
                            type="text"
                            placeholder="Ketik nama sales..."
                            value={searchKaryawan}
                            onChange={(e) => {
                              setSearchKaryawan(e.target.value);
                              setShowKaryawanDropdown(true);
                            }}
                            className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium shadow-sm transition-all duration-200"
                            autoFocus
                          />

                          {showKaryawanDropdown &&
                            searchKaryawan.length >= 2 && (
                              <div className="absolute z-50 mt-2 w-full bg-white border-2 border-blue-300 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                                {searchingKaryawan ? (
                                  <div className="p-6 text-center">
                                    <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                                    <p className="text-sm text-gray-600 font-medium">
                                      Mencari sales...
                                    </p>
                                  </div>
                                ) : karyawanList.length > 0 ? (
                                  karyawanList.map((k) => (
                                    <button
                                      key={k.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedKaryawan(k);
                                        setShowKaryawanDropdown(false);
                                        setSearchKaryawan("");
                                        setExpandKaryawanSearch(false);
                                      }}
                                      className="w-full p-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 border-b last:border-b-0 transition-all duration-200 text-left group"
                                    >
                                      <p className="font-bold text-sm text-gray-900 group-hover:text-blue-700 flex items-center gap-2">
                                        <Briefcase className="w-3.5 h-3.5" />
                                        {k.nama}
                                      </p>
                                      <p className="text-xs text-gray-600 ml-5 mt-0.5">
                                        NIK: {k.nik}
                                      </p>
                                    </button>
                                  ))
                                ) : (
                                  <div className="p-6 text-center">
                                    <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500 font-medium">
                                      Tidak ada hasil
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 mb-1.5 block uppercase tracking-wide">
                        Kota Tujuan <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={kotaTujuan}
                        onChange={(e) => setKotaTujuan(e.target.value)}
                        placeholder="Contoh: Bandung"
                        className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-semibold transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 2 - Tanggal Berangkat */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-2 uppercase tracking-wide">
                      <Calendar className="w-4 h-4 text-slate-600" />
                      Tanggal Berangkat <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={tanggalBerangkat}
                      onChange={(e) => setTanggalBerangkat(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-semibold transition-all"
                    />
                  </div>

                  {/* Row 3 - Keterangan */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 mb-1.5 block uppercase tracking-wide">
                      Keterangan
                    </label>
                    <textarea
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                      placeholder="Catatan perjalanan (opsional)"
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-semibold transition-all resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Manifest Barang */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      Manifest Barang
                    </h4>
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-md font-bold">
                      {manifestItems.length} item
                    </span>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto p-3 bg-gray-50">
                  <div className="space-y-2">
                    {manifestItems.map((item) => {
                      const barang = barangList.find(
                        (b) => b.id === item.barangId
                      );
                      if (!barang) return null;

                      const totalHarga =
                        (barang.hargaJual / barang.jumlahPerKemasan) *
                        item.totalItem;

                      // Hitung jumlah kemasan dan sisa item
                      const jumlahKemasan = Math.floor(
                        Number(item.totalItem) / Number(barang.jumlahPerKemasan)
                      );
                      const sisaItem =
                        Number(item.totalItem) %
                        Number(barang.jumlahPerKemasan);
                      const limitPenjualan = Number(barang.limitPenjualan || 0);
                      const hasLimit = limitPenjualan > 0;
                      const todaySold = getTodaySold(barang.id);
                      const perDus = Number(barang.jumlahPerKemasan) || 1;
                      const totalUsed = todaySold + item.totalItem;
                      const sisaLimit = hasLimit
                        ? Math.max(0, limitPenjualan - totalUsed)
                        : Infinity;
                      const terjualDus = Math.floor(totalUsed / perDus);
                      const sisaDus = Math.floor(sisaLimit / perDus);

                      return (
                        <div
                          key={item.barangId}
                          className="border border-gray-200 rounded-lg p-3 bg-white"
                        >
                          {/* Item Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-extrabold text-gray-900 text-sm truncate mb-1">
                                {barang.namaBarang}
                              </h4>
                              <p className="text-xs text-gray-600 font-semibold truncate bg-gray-100 px-2 py-0.5 rounded-md inline-block">
                                {formatRupiah(barang.hargaJual)}/
                                {barang.jenisKemasan}
                              </p>
                            </div>
                          </div>

                          {/* Quantity Display */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100 p-2 rounded-lg">
                              <span className="text-xs font-bold text-gray-700 uppercase">
                                {barang.jenisKemasan}:
                              </span>
                              <span className="text-sm font-bold text-purple-700">
                                {jumlahKemasan}
                              </span>
                            </div>
                            {sisaItem > 0 && (
                              <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-orange-100 p-2 rounded-lg">
                                <span className="text-xs font-bold text-gray-700 uppercase">
                                  Sisa pcs:
                                </span>
                                <span className="text-sm font-bold text-orange-700">
                                  {sisaItem}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-2 rounded-lg border border-blue-200">
                              <span className="text-xs font-bold text-gray-700 uppercase">
                                Total Item:
                              </span>
                              <span className="text-sm font-bold text-blue-600">
                                {item.totalItem} pcs
                              </span>
                            </div>
                            <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 p-2 rounded-lg border border-green-200">
                              <span className="text-xs font-bold text-gray-700 uppercase">
                                Nilai:
                              </span>
                              <span className="text-sm font-bold text-green-600">
                                {formatRupiah(totalHarga)}
                              </span>
                            </div>
                            {hasLimit && (
                              <div className="flex items-center justify-between bg-blue-50 p-2 rounded-lg border border-blue-200">
                                <span className="text-xs font-bold text-gray-700 uppercase">
                                  Limit Harian:
                                </span>
                                <span className="text-xs font-bold text-blue-700">
                                  Terjual: {totalUsed} item / {terjualDus} Dus •{" "}
                                  Sisa:{" "}
                                  {sisaLimit === Infinity ? "-" : sisaLimit}{" "}
                                  item / {sisaDus} Dus
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Total Nilai */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-700 text-base">
                    Total Nilai Barang
                  </span>
                  <span className="font-bold text-blue-600 text-xl">
                    {formatRupiah(
                      manifestItems.reduce((total, item) => {
                        const barang = barangList.find(
                          (b) => b.id === item.barangId
                        );
                        if (!barang) return total;
                        const totalHarga =
                          (barang.hargaJual / barang.jumlahPerKemasan) *
                          item.totalItem;
                        return total + totalHarga;
                      }, 0)
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold text-gray-600 text-sm">
                    Total Berat Barang
                  </span>
                  <span className="font-bold text-indigo-600 text-base">
                    {formatBeratKg(
                      manifestItems.reduce((total, item) => {
                        const barang = barangList.find(
                          (b) => b.id === item.barangId
                        );
                        if (!barang) return total;
                        const beratPerPcs = Number(barang.berat || 0);
                        return total + beratPerPcs * item.totalItem;
                      }, 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-lg">
                <div className="flex items-start gap-2.5 text-amber-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm mb-1">Perhatian!</p>
                    <p className="text-xs leading-relaxed">
                      Pastikan semua data sudah benar. Stok barang akan
                      dikurangi setelah perjalanan dibuat.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="flex-1 bg-white hover:bg-gray-100 text-gray-700 px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 border border-gray-300 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Batal
              </button>
              <button
                onClick={handleCreatePerjalanan}
                disabled={
                  loading ||
                  !selectedKaryawan ||
                  !kotaTujuan ||
                  !tanggalBerangkat
                }
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 text-white px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Buat Perjalanan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatePerjalananPage;
