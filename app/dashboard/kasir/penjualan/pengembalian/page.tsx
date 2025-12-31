"use client";
import { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Minus,
  ArrowLeft,
  Check,
  Trash2,
  AlertCircle,
  X,
  RefreshCw,
  Search,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Barang {
  id: number;
  namaBarang: string;
  jumlahPerKemasan: number;
  hargaJual: number;
  jenisKemasan: string;
  stok: number;
  berat: number;
}

interface PengembalianItem {
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  kondisiBarang: "BAIK" | "RUSAK" | "KADALUARSA";
  keterangan: string;
}

const InputPengembalianPage = () => {
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [barangById, setBarangById] = useState<Record<number, Barang>>({});
  const [loadingBarang, setLoadingBarang] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PengembalianItem[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadingEdit, setLoadingEdit] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("edit");
  const isEditMode = Boolean(editId);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    fetchBarang(debouncedSearch);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!editId) return;
    const fetchEditData = async () => {
      setLoadingEdit(true);
      try {
        const res = await fetch(`/api/penjualan/pengembalian/${editId}`);
        const data = await res.json();
        if (!data.success) {
          toast.error(data.error || "Gagal mengambil data pengembalian");
          return;
        }

        const pengembalian = data.data as {
          barangId: number;
          jumlahDus: number;
          jumlahPcs: number;
          kondisiBarang: PengembalianItem["kondisiBarang"];
          keterangan: string | null;
          barang: Barang;
        };

        setItems([
          {
            barangId: pengembalian.barangId,
            jumlahDus: Number(pengembalian.jumlahDus || 0),
            jumlahPcs: Number(pengembalian.jumlahPcs || 0),
            kondisiBarang: pengembalian.kondisiBarang,
            keterangan: pengembalian.keterangan || "",
          },
        ]);

        setBarangById((prev) => ({
          ...prev,
          [pengembalian.barangId]: pengembalian.barang,
        }));
      } catch (error) {
        console.error("Error fetching pengembalian:", error);
        toast.error("Gagal mengambil data pengembalian");
      } finally {
        setLoadingEdit(false);
      }
    };

    fetchEditData();
  }, [editId]);

  const fetchBarang = async (keyword: string = "") => {
    setLoadingBarang(true);
    try {
      const endpoint = keyword
        ? `/api/barang/search/${encodeURIComponent(keyword)}`
        : "/api/barang";
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success) {
        setBarangList(data.data);
        setBarangById((prev) => {
          const next = { ...prev };
          for (const barang of data.data as Barang[]) {
            next[barang.id] = barang;
          }
          return next;
        });
      } else {
        setBarangList([]);
      }
    } catch (error) {
      console.error("Error fetching barang:", error);
      toast.error("Gagal mengambil data barang");
    } finally {
      setLoadingBarang(false);
    }
  };

  const handleAddItem = (barang: Barang) => {
    if (isEditMode) {
      toast.error("Mode edit hanya untuk satu barang");
      return;
    }
    const existing = items.some((item) => item.barangId === barang.id);
    if (existing) {
      toast.error("Barang sudah ada dalam daftar pengembalian");
      return;
    }

    setItems([
      ...items,
      {
        barangId: barang.id,
        jumlahDus: 0,
        jumlahPcs: 0,
        kondisiBarang: "BAIK",
        keterangan: "",
      },
    ]);
    toast.success(`${barang.namaBarang} ditambahkan`);
  };

  const handleUpdateItem = (
    barangId: number,
    field: keyof PengembalianItem,
    value: PengembalianItem[keyof PengembalianItem]
  ) => {
    if (field !== "jumlahDus" && field !== "jumlahPcs") {
      setItems((prev) =>
        prev.map((item) =>
          item.barangId === barangId ? { ...item, [field]: value } : item
        )
      );
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.barangId !== barangId) return item;

        const nextItem = {
          ...item,
          [field]: Math.max(0, Number(value)),
        } as PengembalianItem;

        return nextItem;
      })
    );
  };

  const handleRemoveItem = (barangId: number) => {
    setItems(items.filter((item) => item.barangId !== barangId));
  };

  const handleOpenConfirmModal = () => {
    if (items.length === 0) {
      toast.error("Tambahkan minimal 1 barang");
      return;
    }

    for (const item of items) {
      if (item.jumlahDus === 0 && item.jumlahPcs === 0) {
        toast.error("Jumlah barang tidak boleh 0");
        return;
      }
    }

    if (isEditMode && items.length !== 1) {
      toast.error("Edit hanya bisa untuk 1 barang");
      return;
    }
    setShowConfirmModal(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (isEditMode) {
        if (items.length !== 1) {
          toast.error("Edit hanya bisa untuk 1 barang");
          return;
        }
        const updatePayload = {
          barangId: items[0].barangId,
          jumlahDus: items[0].jumlahDus,
          jumlahPcs: items[0].jumlahPcs,
          kondisiBarang: items[0].kondisiBarang,
          keterangan: items[0].keterangan,
        };

        const updateRes = await fetch(
          `/api/penjualan/pengembalian/${editId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatePayload),
          }
        );
        const updateData = await updateRes.json();
        if (!updateData.success) {
          toast.error(updateData.error || "Gagal memperbarui pengembalian");
          return;
        }

        toast.success("Pengembalian berhasil diperbarui");
        setShowConfirmModal(false);
        setItems([]);
        router.push("/dashboard/kasir/penjualan/pengembalian/riwayat");
      } else {
        const res = await fetch(`/api/penjualan/pengembalian`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pengembalianBarang: items,
          }),
        });

        const data = await res.json();
        if (data.success) {
          toast.success("Pengembalian berhasil disimpan");
          setShowConfirmModal(false);
          setItems([]);
        } else {
          toast.error(data.message || "Gagal menyimpan pengembalian");
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const getKondisiColor = (kondisi: string) => {
    switch (kondisi) {
      case "BAIK":
        return "bg-green-100 text-green-700 border-green-300";
      case "RUSAK":
        return "bg-red-100 text-red-700 border-red-300";
      case "KADALUARSA":
        return "bg-orange-100 text-orange-700 border-orange-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatGramsToKg = (grams: number): string => {
    if (!Number.isFinite(grams)) return "";
    const kg = grams / 1000;
    const formatted = kg.toFixed(3).replace(/\.?0+$/, "");
    return formatted.replace(".", ",");
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

      <div className="mx-3 mb-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-5 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-lg shadow-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {isEditMode
                    ? "Edit Pengembalian Barang"
                    : "Input Pengembalian Barang"}
                </h1>
                <p className="text-blue-100 text-sm">
                  {isEditMode
                    ? "Perbarui data pengembalian barang"
                    : "Catat barang yang dikembalikan"}
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/admin/penjualan`}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {isEditMode && (
          <div className="mb-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 text-sm font-semibold">
            Mode edit aktif. Anda hanya dapat mengubah 1 barang pengembalian.
          </div>
        )}
        <div className="flex gap-4 h-full min-h-0">
          <div className="w-[60%] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-lg shadow-md">
                  <Package className="w-5 h-5 text-white" />
                </div>
                Daftar Barang
                <span className="ml-auto text-xs bg-blue-600 text-white px-2.5 py-1 rounded-full font-bold">
                  {barangList.length} item
                </span>
              </h2>
              <div className="mt-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                <input
                  type="text"
                  placeholder="Cari barang..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 text-xs border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none font-semibold bg-white/90"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 p-1"
                    aria-label="Hapus pencarian"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
              {loadingBarang ? (
                <div className="flex items-center justify-center py-12 text-gray-500 font-medium">
                  Memuat data barang...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {barangList.map((barang) => {
                      const isAdded = items.some(
                        (i) => i.barangId === barang.id
                      );

                      return (
                        <div
                          key={barang.id}
                          className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                            isAdded
                              ? "border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-md shadow-blue-100/50"
                              : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-xl hover:shadow-blue-100/50"
                          }`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                          {isAdded && (
                            <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg z-10 animate-in fade-in zoom-in duration-300">
                              <Check className="w-2.5 h-2.5" />
                              Di List
                            </div>
                          )}

                          <div className="relative p-3">
                            <div className="flex items-start gap-1.5 mb-2">
                              <div className="bg-blue-100 p-1 rounded-lg mt-0.5 group-hover:bg-blue-200 transition-colors flex-shrink-0">
                                <Package className="w-3 h-3 text-blue-600" />
                              </div>
                              <h4 className="font-extrabold text-gray-900 text-xs leading-tight group-hover:text-blue-700 transition-colors line-clamp-2">
                                {barang.namaBarang}
                              </h4>
                            </div>

                            <div className="space-y-1.5 mb-3">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="bg-gray-200 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-gray-700">
                                  {formatGramsToKg(barang.berat)} KG
                                </span>
                                <span className="text-gray-400 text-[10px]">
                                  •
                                </span>
                                <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                                  {barang.jumlahPerKemasan} pcs/
                                  {barang.jenisKemasan}
                                </span>
                              </div>

                              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-1 rounded-lg shadow-md group-hover:shadow-lg transition-shadow inline-block">
                                <p className="text-[11px] font-extrabold">
                                  {formatRupiah(barang.hargaJual)}
                                  <span className="text-[9px] font-medium opacity-90 ml-0.5">
                                    /{barang.jenisKemasan}
                                  </span>
                                </p>
                              </div>

                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-2 py-1.5 rounded-lg border border-blue-200">
                                <p className="text-[10px] font-bold text-blue-700">
                                  Stok: {barang.stok} pcs
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleAddItem(barang)}
                              disabled={isAdded || isEditMode}
                              className={`relative overflow-hidden w-full py-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 font-bold text-xs ${
                                isAdded || isEditMode
                                  ? "bg-blue-200 text-blue-700 cursor-not-allowed"
                                  : "bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl active:scale-95"
                              }`}
                            >
                              {!isAdded && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                              )}

                              <Plus
                                className={`w-4 h-4 relative z-10 ${
                                  isAdded ? "text-blue-700" : "text-white"
                                }`}
                                strokeWidth={3}
                              />
                              <span className="relative z-10">
                                {isEditMode
                                  ? "Mode Edit"
                                  : isAdded
                                  ? "Ditambahkan"
                                  : "Tambah"}
                              </span>
                            </button>
                          </div>

                          <div
                            className={`h-1 ${
                              isAdded
                                ? "bg-gradient-to-r from-blue-400 to-indigo-600"
                                : "bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            }`}
                          ></div>
                        </div>
                      );
                    })}
                  </div>

                  {barangList.length === 0 && (
                    <div className="text-center py-12">
                      <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">
                        {debouncedSearch
                          ? "Barang tidak ditemukan"
                          : "Tidak ada data barang"}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="w-[40%] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-lg shadow-md">
                  <Package className="w-5 h-5 text-white" />
                </div>
                Barang yang Dikembalikan
                <span className="ml-auto text-xs bg-blue-600 text-white px-2.5 py-1 rounded-full font-bold">
                  {items.length} item
                </span>
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((item) => {
                    const barang = barangById[item.barangId];
                    if (!barang) return null;
                    const jumlahPerDus = Number(barang.jumlahPerKemasan) || 0;
                    const currentTotalPcs =
                      item.jumlahDus * jumlahPerDus + item.jumlahPcs;

                    return (
                      <div
                        key={item.barangId}
                        className="border-2 border-gray-200 rounded-xl p-3 bg-white shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0 pr-2">
                            <h4 className="font-extrabold text-gray-900 text-xs line-clamp-2 mb-1 leading-tight">
                              {barang.namaBarang}
                            </h4>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.barangId)}
                            className="text-red-500 hover:bg-red-100 p-1 rounded-lg transition-all flex-shrink-0 ml-1 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
                          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-2 rounded-xl">
                            <span className="text-xs font-bold text-gray-700 block mb-1.5 uppercase">
                              {barang.jenisKemasan}:
                            </span>
                            <div className="flex items-center gap-1.5 w-full">
                              <button
                                onClick={() =>
                                  handleUpdateItem(
                                    item.barangId,
                                    "jumlahDus",
                                    item.jumlahDus - 1
                                  )
                                }
                                className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95 flex-shrink-0"
                              >
                                <Minus
                                  className="w-3.5 h-3.5"
                                  strokeWidth={3}
                                />
                              </button>
                              <input
                                type="number"
                                value={item.jumlahDus}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.barangId,
                                    "jumlahDus",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="flex-1 min-w-0 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                min="0"
                              />
                              <button
                                onClick={() =>
                                  handleUpdateItem(
                                    item.barangId,
                                    "jumlahDus",
                                    item.jumlahDus + 1
                                  )
                                }
                                className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95 flex-shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                              </button>
                            </div>
                          </div>

                          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-2 rounded-xl">
                            <span className="text-xs font-bold text-gray-700 block mb-1.5 uppercase">
                              Item:
                            </span>
                            <div className="flex items-center gap-1.5 w-full">
                              <button
                                onClick={() =>
                                  handleUpdateItem(
                                    item.barangId,
                                    "jumlahPcs",
                                    item.jumlahPcs - 1
                                  )
                                }
                                className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95 flex-shrink-0"
                              >
                                <Minus
                                  className="w-3.5 h-3.5"
                                  strokeWidth={3}
                                />
                              </button>
                              <input
                                type="number"
                                value={item.jumlahPcs}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.barangId,
                                    "jumlahPcs",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="flex-1 min-w-0 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                min="0"
                              />
                              <button
                                onClick={() =>
                                  handleUpdateItem(
                                    item.barangId,
                                    "jumlahPcs",
                                    item.jumlahPcs + 1
                                  )
                                }
                                className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95 flex-shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="text-xs font-bold text-gray-700 block mb-1.5 uppercase">
                            Kondisi Barang:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {(["BAIK", "RUSAK", "KADALUARSA"] as const).map(
                              (kondisi) => (
                                <button
                                  key={kondisi}
                                  onClick={() =>
                                    handleUpdateItem(
                                      item.barangId,
                                      "kondisiBarang",
                                      kondisi
                                    )
                                  }
                                  className={`px-3 py-2 rounded-lg font-bold text-xs transition-all border-2 shadow-sm hover:shadow-md active:scale-95 ${
                                    item.kondisiBarang === kondisi
                                      ? getKondisiColor(kondisi) + " shadow-md"
                                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                                  }`}
                                >
                                  {kondisi}
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1.5 uppercase">
                            Keterangan:
                          </label>
                          <input
                            type="text"
                            value={item.keterangan}
                            onChange={(e) =>
                              handleUpdateItem(
                                item.barangId,
                                "keterangan",
                                e.target.value
                              )
                            }
                            placeholder="Opsional..."
                            className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all"
                          />
                        </div>

                        <div className="mt-3 pt-3 border-t-2 border-gray-200">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-200">
                            <p className="text-xs text-gray-700 font-semibold">
                              Total Dikembalikan:{" "}
                              <span className="font-extrabold text-blue-600">
                                {currentTotalPcs} Item
                              </span>
                            </p>
                          </div>
                          {item.kondisiBarang !== "BAIK" && (
                            <div className="mt-2 bg-red-50 border border-red-200 px-3 py-2 rounded-lg flex items-start gap-2">
                              <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-red-700 font-bold">
                                Barang {item.kondisiBarang} tidak ditambahkan ke
                                stok
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="bg-gradient-to-br from-blue-100 to-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Package className="w-10 h-10 text-blue-600" />
                  </div>
                  <p className="text-gray-700 font-bold text-base mb-1">
                    Belum ada barang dikembalikan
                  </p>
                  <p className="text-gray-500 text-sm">
                    Pilih barang dari daftar di sebelah kiri
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-white">
              <button
                onClick={handleOpenConfirmModal}
                disabled={loading || loadingEdit || items.length === 0}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 text-white px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed active:scale-95"
              >
                <Check className="w-5 h-5" strokeWidth={2.5} />
                {isEditMode ? "Update Pengembalian" : "Simpan Pengembalian"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-t-2xl">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                    <Package className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold">
                    {isEditMode ? "Konfirmasi Update" : "Konfirmasi Pengembalian"}
                  </h3>
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      Barang yang Dikembalikan
                    </h4>
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-md font-bold">
                      {items.length} item
                    </span>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto p-3 bg-gray-50">
                  <div className="space-y-2">
                    {items.map((item) => {
                      const barang = barangById[item.barangId];
                      if (!barang) return null;

                      const totalPcs =
                        item.jumlahDus * Number(barang.jumlahPerKemasan) +
                        item.jumlahPcs;

                      return (
                        <div
                          key={item.barangId}
                          className="border border-gray-200 rounded-lg p-3 bg-white"
                        >
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

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-2 rounded-lg">
                              <span className="text-xs font-bold text-gray-700 uppercase">
                                {barang.jenisKemasan}:
                              </span>
                              <span className="text-sm font-bold text-gray-900">
                                {item.jumlahDus}
                              </span>
                            </div>
                            <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-2 rounded-lg">
                              <span className="text-xs font-bold text-gray-700 uppercase">
                                Pcs:
                              </span>
                              <span className="text-sm font-bold text-gray-900">
                                {item.jumlahPcs}
                              </span>
                            </div>
                            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-2 rounded-lg border border-blue-200">
                              <span className="text-xs font-bold text-gray-700 uppercase">
                                Total:
                              </span>
                              <span className="text-sm font-bold text-blue-600">
                                {totalPcs} pcs
                              </span>
                            </div>
                            <div
                              className={`flex items-center justify-between p-2 rounded-lg border-2 ${getKondisiColor(
                                item.kondisiBarang
                              )}`}
                            >
                              <span className="text-xs font-bold uppercase">
                                Kondisi:
                              </span>
                              <span className="text-sm font-bold">
                                {item.kondisiBarang}
                              </span>
                            </div>
                            {item.keterangan && (
                              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-2 rounded-lg border border-gray-200">
                                <span className="text-xs font-bold text-gray-700 uppercase block mb-1">
                                  Keterangan:
                                </span>
                                <span className="text-xs text-gray-900">
                                  {item.keterangan}
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

              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-lg">
                <div className="flex items-start gap-2.5 text-amber-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm mb-1">Perhatian!</p>
                    <p className="text-xs leading-relaxed">
                      Pastikan semua data sudah benar. Barang dengan kondisi
                      BAIK akan ditambahkan kembali ke stok.
                    </p>
                  </div>
                </div>
              </div>
            </div>

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
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 text-white px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {isEditMode ? "Ya, Update Pengembalian" : "Ya, Simpan Pengembalian"}
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

export default InputPengembalianPage;
