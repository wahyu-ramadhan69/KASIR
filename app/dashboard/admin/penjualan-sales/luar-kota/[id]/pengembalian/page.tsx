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
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Barang {
  id: number;
  namaBarang: string;
  satuan: string;
  jumlahPerKemasan: number;
  hargaJual: number;
  jenisKemasan: string;
  ukuran: number;
}

interface ManifestBarang {
  id: number;
  barangId: number;
  totalItem: string;
  barang: Barang;
}

interface PengembalianItem {
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  kondisiBarang: "BAIK" | "RUSAK" | "KADALUARSA";
  keterangan: string;
}

const InputPengembalianPage = () => {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [manifestBarang, setManifestBarang] = useState<ManifestBarang[]>([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PengembalianItem[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchManifest();
    }
  }, [id]);

  const fetchManifest = async () => {
    try {
      const res = await fetch(`/api/penjualan-luar-kota/${id}`);
      const data = await res.json();
      if (data.success) {
        setManifestBarang(data.data.manifestBarang);
      }
    } catch (error) {
      console.error("Error fetching manifest:", error);
      toast.error("Gagal mengambil data manifest");
    }
  };

  const handleAddItem = (manifest: ManifestBarang) => {
    const existing = items.some((item) => item.barangId === manifest.barangId);
    if (existing) {
      toast.error("Barang sudah ada dalam daftar pengembalian");
      return;
    }

    setItems([
      ...items,
      {
        barangId: manifest.barangId,
        jumlahDus: 0,
        jumlahPcs: 0,
        kondisiBarang: "BAIK",
        keterangan: "",
      },
    ]);
    toast.success(`${manifest.barang.namaBarang} ditambahkan`);
  };

  const handleUpdateItem = (
    barangId: number,
    field: keyof PengembalianItem,
    value: PengembalianItem[keyof PengembalianItem]
  ) => {
    // Jika bukan field jumlah, langsung update
    if (field !== "jumlahDus" && field !== "jumlahPcs") {
      setItems((prev) =>
        prev.map((item) =>
          item.barangId === barangId ? { ...item, [field]: value } : item
        )
      );
      return;
    }

    // Untuk jumlah, validasi berdasarkan stok manifest (totalItem dalam pcs)
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.barangId !== barangId) return item;

        const manifest = manifestBarang.find((m) => m.barangId === barangId);
        if (!manifest) return item;

        const jumlahPerDus = Number(manifest.barang.jumlahPerKemasan) || 0;
        const maxTotalPcs = Number(manifest.totalItem) || 0;

        const nextItem = {
          ...item,
          [field]: Math.max(0, Number(value)),
        } as PengembalianItem;

        const totalPcs =
          nextItem.jumlahDus * jumlahPerDus + nextItem.jumlahPcs;

        if (totalPcs > maxTotalPcs) {
          const maxDus =
            jumlahPerDus > 0 ? Math.floor(maxTotalPcs / jumlahPerDus) : 0;
          const remainingPcs = maxTotalPcs - maxDus * jumlahPerDus;

          return {
            ...nextItem,
            jumlahDus: maxDus,
            jumlahPcs: remainingPcs,
          };
        }

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

    setShowConfirmModal(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/penjualan-luar-kota/${id}/pengembalian`, {
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
        router.push(`/dashboard/admin/penjualan-sales/kanvas`);
      } else {
        toast.error(data.message || "Gagal menyimpan pengembalian");
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
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Input Pengembalian Barang
                </h1>
                <p className="text-blue-100 text-sm">
                  Catat barang yang dikembalikan sales
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/admin/penjualan-sales/kanvas`}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        <div className="flex gap-3 h-full min-h-0">
          {/* Left - Manifest Barang (50%) - Enhanced Interactive Design */}
          <div className="w-1/2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-lg shadow-md">
                  <Package className="w-5 h-5 text-white" />
                </div>
                Manifest Barang
                <span className="ml-auto text-xs bg-blue-600 text-white px-2.5 py-1 rounded-full font-bold">
                  {manifestBarang.length} item
                </span>
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
              <div className="grid grid-cols-2 gap-3">
                {manifestBarang.map((manifest) => {
                  const isAdded = items.some(
                    (i) => i.barangId === manifest.barangId
                  );
                  const totalItemPcs = Number(manifest.totalItem);
                  const jumlahPerDus = Number(manifest.barang.jumlahPerKemasan);
                  const displayDus =
                    jumlahPerDus > 0
                      ? Math.floor(totalItemPcs / jumlahPerDus)
                      : 0;
                  const displayPcs =
                    jumlahPerDus > 0
                      ? totalItemPcs % jumlahPerDus
                      : totalItemPcs;

                  return (
                    <div
                      key={manifest.id}
                      className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                        isAdded
                          ? "border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-md shadow-blue-100/50"
                          : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-xl hover:shadow-blue-100/50"
                      }`}
                    >
                      {/* Gradient Overlay on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                      {/* In List Indicator */}
                      {isAdded && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg z-10 animate-in fade-in zoom-in duration-300">
                          <Check className="w-2.5 h-2.5" />
                          Di List
                        </div>
                      )}

                      <div className="relative p-3">
                        {/* Product Name with Icon */}
                        <div className="flex items-start gap-1.5 mb-2">
                          <div className="bg-blue-100 p-1 rounded-lg mt-0.5 group-hover:bg-blue-200 transition-colors flex-shrink-0">
                            <Package className="w-3 h-3 text-blue-600" />
                          </div>
                          <h4 className="font-extrabold text-gray-900 text-xs leading-tight group-hover:text-blue-700 transition-colors line-clamp-2">
                            {manifest.barang.namaBarang}
                          </h4>
                        </div>

                        {/* Product Details */}
                        <div className="space-y-1.5 mb-3">
                          {/* Ukuran & Kemasan */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="bg-gray-200 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-gray-700">
                              {manifest.barang.ukuran} {manifest.barang.satuan}
                            </span>
                            <span className="text-gray-400 text-[10px]">•</span>
                            <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                              {manifest.barang.jumlahPerKemasan} pcs/
                              {manifest.barang.jenisKemasan}
                            </span>
                          </div>

                          {/* Price */}
                          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-1 rounded-lg shadow-md group-hover:shadow-lg transition-shadow inline-block">
                            <p className="text-[11px] font-extrabold">
                              {formatRupiah(manifest.barang.hargaJual)}
                              <span className="text-[9px] font-medium opacity-90 ml-0.5">
                                /{manifest.barang.jenisKemasan}
                              </span>
                            </p>
                          </div>

                          {/* Dibawa Info */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-2 py-1.5 rounded-lg border border-blue-200">
                            <p className="text-[10px] font-bold text-blue-700">
                              Sisa Manifest: {displayDus}{" "}
                              {manifest.barang.jenisKemasan}
                              {displayPcs > 0
                                ? ` & ${displayPcs} ${manifest.barang.satuan}`
                                : ""}
                            </p>
                            <p className="text-[10px] font-bold text-blue-600 mt-0.5">
                              Total: {totalItemPcs} pcs
                            </p>
                          </div>
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={() => handleAddItem(manifest)}
                          disabled={isAdded}
                          className={`relative overflow-hidden w-full py-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 font-bold text-xs ${
                            isAdded
                              ? "bg-blue-200 text-blue-700 cursor-not-allowed"
                              : "bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl active:scale-95"
                          }`}
                        >
                          {/* Button Shine Effect */}
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
                            {isAdded ? "Ditambahkan" : "Tambah"}
                          </span>
                        </button>
                      </div>

                      {/* Bottom Border Accent */}
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

              {manifestBarang.length === 0 && (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">
                    Tidak ada data manifest
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right - Form Pengembalian (50%) */}
          <div className="w-1/2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
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
                  const manifest = manifestBarang.find(
                    (m) => m.barangId === item.barangId
                  );
                  if (!manifest) return null;
                  const jumlahPerDus =
                    Number(manifest.barang.jumlahPerKemasan) || 0;
                  const manifestTotalPcs = Number(manifest.totalItem) || 0;
                  const currentTotalPcs =
                    item.jumlahDus * jumlahPerDus + item.jumlahPcs;
                  const canAddDus =
                    jumlahPerDus > 0 &&
                    currentTotalPcs + jumlahPerDus <= manifestTotalPcs;
                  const canAddPcs = currentTotalPcs + 1 <= manifestTotalPcs;

                  return (
                    <div
                        key={item.barangId}
                        className="border-2 border-gray-200 rounded-xl p-3 bg-white shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0 pr-2">
                            <h4 className="font-extrabold text-gray-900 text-xs line-clamp-2 mb-1 leading-tight">
                              {manifest.barang.namaBarang}
                            </h4>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.barangId)}
                            className="text-red-500 hover:bg-red-100 p-1 rounded-lg transition-all flex-shrink-0 ml-1 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Jumlah */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-2 rounded-xl">
                            <span className="text-xs font-bold text-gray-700 block mb-1.5 uppercase">
                              Dus:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() =>
                                  handleUpdateItem(
                                    item.barangId,
                                    "jumlahDus",
                                    item.jumlahDus - 1
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
                                value={item.jumlahDus}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.barangId,
                                    "jumlahDus",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="flex-1 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                                disabled={!canAddDus}
                                className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                              </button>
                            </div>
                          </div>

                          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-2 rounded-xl">
                            <span className="text-xs font-bold text-gray-700 block mb-1.5 uppercase">
                              Pcs:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() =>
                                  handleUpdateItem(
                                    item.barangId,
                                    "jumlahPcs",
                                    item.jumlahPcs - 1
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
                                value={item.jumlahPcs}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.barangId,
                                    "jumlahPcs",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="flex-1 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                                disabled={!canAddPcs}
                                className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Kondisi */}
                        <div className="mb-3">
                          <label className="text-xs font-bold text-gray-700 block mb-1.5 uppercase">
                            Kondisi Barang:
                          </label>
                          <div className="grid grid-cols-3 gap-2">
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

                        {/* Keterangan */}
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

                        {/* Info */}
                        <div className="mt-3 pt-3 border-t-2 border-gray-200">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-200">
                            <p className="text-xs text-gray-700 font-semibold">
                              Total Dikembalikan:{" "}
                              <span className="font-extrabold text-blue-600">
                                {item.jumlahDus *
                                  Number(manifest.barang.jumlahPerKemasan) +
                                  item.jumlahPcs}{" "}
                                pcs
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
                    Pilih barang dari manifest di sebelah kiri
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="p-4 border-t bg-white">
              <button
                onClick={handleOpenConfirmModal}
                disabled={loading || items.length === 0}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 text-white px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed active:scale-95"
              >
                <Check className="w-5 h-5" strokeWidth={2.5} />
                Simpan Pengembalian
              </button>
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
                    <Package className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold">Konfirmasi Pengembalian</h3>
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
              {/* Barang yang Dikembalikan */}
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
                      const manifest = manifestBarang.find(
                        (m) => m.barangId === item.barangId
                      );
                      if (!manifest) return null;

                      const totalPcs =
                        item.jumlahDus *
                          Number(manifest.barang.jumlahPerKemasan) +
                        item.jumlahPcs;

                      return (
                        <div
                          key={item.barangId}
                          className="border border-gray-200 rounded-lg p-3 bg-white"
                        >
                          {/* Item Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-extrabold text-gray-900 text-sm truncate mb-1">
                                {manifest.barang.namaBarang}
                              </h4>
                              <p className="text-xs text-gray-600 font-semibold truncate bg-gray-100 px-2 py-0.5 rounded-md inline-block">
                                {formatRupiah(manifest.barang.hargaJual)}/
                                {manifest.barang.jenisKemasan}
                              </p>
                            </div>
                          </div>

                          {/* Quantity Display */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-2 rounded-lg">
                              <span className="text-xs font-bold text-gray-700 uppercase">
                                {manifest.barang.jenisKemasan}:
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

              {/* Warning */}
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
                    Ya, Simpan Pengembalian
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
