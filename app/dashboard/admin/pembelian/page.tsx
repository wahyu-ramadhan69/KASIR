"use client";
import React, { useState, useEffect } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Check,
  Package,
  Truck,
  CreditCard,
  ChevronRight,
  Receipt,
  AlertCircle,
  Percent,
  DollarSign,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface Supplier {
  id: number;
  namaSupplier: string;
  alamat: string;
  noHp: string;
  limitHutang: number;
  limitPembelian: number;
  barang: Barang[];
}

interface Barang {
  id: number;
  namaBarang: string;
  hargaBeli: number;
  hargaJual: number;
  stok: number;
  jumlahPerkardus: number;
  ukuran: number;
  satuan: string;
  supplierId: number;
}

interface PembelianItem {
  id: number;
  barangId: number;
  jumlahDus: number;
  hargaPokok: number;
  diskonPerItem: number;
  barang: Barang;
  totalHarga?: number;
  totalDiskon?: number;
  subtotal?: number;
}

interface PembelianHeader {
  id: number;
  kodePembelian: string;
  supplierId: number;
  subtotal: number;
  diskonNota: number;
  totalHarga: number;
  jumlahDibayar: number;
  kembalian: number;
  statusPembayaran: "LUNAS" | "HUTANG";
  statusTransaksi: "KERANJANG" | "SELESAI" | "DIBATALKAN";
  supplier: Supplier;
  items: PembelianItem[];
  createdAt: string;
  updatedAt: string;
  calculation?: {
    items: any[];
    ringkasan: {
      totalSebelumDiskon: number;
      totalDiskonItem: number;
      subtotal: number;
      diskonNota: number;
      totalHarga: number;
      jumlahDibayar: number;
      kembalian: number;
      sisaHutang: number;
      statusPembayaran: string;
    };
  };
}

// Helper untuk format angka ke rupiah
const formatRupiahInput = (value: string): string => {
  const number = value.replace(/[^\d]/g, "");
  if (!number) return "";
  return parseInt(number).toLocaleString("id-ID");
};

// Helper untuk parse rupiah ke angka
const parseRupiahToNumber = (value: string): number => {
  return parseInt(value.replace(/[^\d]/g, "")) || 0;
};

const PembelianPage = () => {
  // State management
  const [step, setStep] = useState<number>(1);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null
  );
  const [currentPembelian, setCurrentPembelian] =
    useState<PembelianHeader | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchBarang, setSearchBarang] = useState<string>("");
  const [searchSupplier, setSearchSupplier] = useState<string>("");

  // Checkout state
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [diskonNota, setDiskonNota] = useState<string>("0");
  const [diskonNotaType, setDiskonNotaType] = useState<"rupiah" | "persen">(
    "rupiah"
  );
  const [jumlahDibayar, setJumlahDibayar] = useState<string>("");
  const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState<string>("");

  // Diskon per item state
  const [itemDiskonTypes, setItemDiskonTypes] = useState<{
    [key: number]: "rupiah" | "persen";
  }>({});
  const [itemDiskonValues, setItemDiskonValues] = useState<{
    [key: number]: string;
  }>({});

  // Receipt state
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // History state
  const [pembelianList, setPembelianList] = useState<PembelianHeader[]>([]);
  const [showKeranjangModal, setShowKeranjangModal] = useState<boolean>(false);

  useEffect(() => {
    fetchSuppliers();
    fetchPembelianHistory();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/supplier");
      const data = await res.json();
      if (data.success) {
        setSuppliersList(data.data);
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast.error("Gagal mengambil data supplier");
    }
  };

  const fetchPembelianHistory = async () => {
    try {
      const res = await fetch("/api/pembelian");
      const data = await res.json();
      if (data.success) {
        setPembelianList(data.data);
      }
    } catch (error) {
      console.error("Error fetching pembelian:", error);
    }
  };

  const fetchPembelianDetail = async (
    id: number,
    preserveDiskonState: boolean = true
  ) => {
    try {
      const res = await fetch(`/api/pembelian/${id}`);
      const data = await res.json();
      if (data.success) {
        setCurrentPembelian(data.data);

        // Hanya set diskon state untuk item BARU (yang belum ada di state)
        if (preserveDiskonState) {
          const newTypes: { [key: number]: "rupiah" | "persen" } = {
            ...itemDiskonTypes,
          };
          const newValues: { [key: number]: string } = { ...itemDiskonValues };

          data.data.items?.forEach((item: PembelianItem) => {
            if (newTypes[item.id] === undefined) {
              newTypes[item.id] = "rupiah";
              newValues[item.id] =
                item.diskonPerItem === 0
                  ? "0"
                  : item.diskonPerItem.toLocaleString("id-ID");
            } else {
              // Item sudah ada, update nilai sesuai tipe yang dipilih
              const currentType = newTypes[item.id];
              if (currentType === "persen") {
                const persen =
                  item.hargaPokok > 0
                    ? Math.round((item.diskonPerItem / item.hargaPokok) * 100)
                    : 0;
                newValues[item.id] = persen.toString();
              } else {
                newValues[item.id] =
                  item.diskonPerItem === 0
                    ? "0"
                    : item.diskonPerItem.toLocaleString("id-ID");
              }
            }
          });

          setItemDiskonTypes(newTypes);
          setItemDiskonValues(newValues);
        } else {
          // Reset semua ke rupiah (untuk load awal)
          const types: { [key: number]: "rupiah" | "persen" } = {};
          const values: { [key: number]: string } = {};
          data.data.items?.forEach((item: PembelianItem) => {
            types[item.id] = "rupiah";
            values[item.id] =
              item.diskonPerItem === 0
                ? "0"
                : item.diskonPerItem.toLocaleString("id-ID");
          });
          setItemDiskonTypes(types);
          setItemDiskonValues(values);
        }
      }
    } catch (error) {
      console.error("Error fetching pembelian detail:", error);
    }
  };

  // Step 1: Pilih Supplier dan Buat Keranjang
  const handleSelectSupplier = async (supplier: Supplier) => {
    setLoading(true);
    try {
      const res = await fetch("/api/pembelian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: supplier.id }),
      });
      const data = await res.json();

      if (data.success) {
        setSelectedSupplier(supplier);
        setCurrentPembelian(data.data);
        setStep(2);
        toast.success("Keranjang pembelian berhasil dibuat");
      } else {
        toast.error(data.error || "Gagal membuat keranjang");
      }
    } catch (error) {
      console.error("Error creating pembelian:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Tambah Item ke Keranjang (Quick Add)
  const handleQuickAddItem = async (barang: Barang) => {
    if (!currentPembelian) return;

    // Cek apakah barang sudah ada di keranjang
    const existingItem = currentPembelian.items?.find(
      (item) => item.barangId === barang.id
    );
    if (existingItem) {
      handleUpdateItem(
        existingItem.id,
        "jumlahDus",
        existingItem.jumlahDus + 1
      );
      toast.success(`${barang.namaBarang} +1 dus`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/pembelian/${currentPembelian.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barangId: barang.id,
          jumlahDus: 1,
          hargaPokok: barang.hargaBeli,
          diskonPerItem: 0,
        }),
      });
      const data = await res.json();

      if (data.success) {
        await fetchPembelianDetail(currentPembelian.id);
        toast.success(`${barang.namaBarang} ditambahkan ke keranjang`);
      } else {
        toast.error(data.error || "Gagal menambahkan barang");
      }
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async (
    itemId: number,
    field: string,
    value: number
  ) => {
    if (!currentPembelian) return;

    const oldItems = [...currentPembelian.items];

    // Optimistic update
    setCurrentPembelian((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === itemId ? { ...item, [field]: value } : item
        ),
      };
    });

    try {
      const res = await fetch(
        `/api/pembelian/${currentPembelian.id}/items/${itemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        }
      );
      const data = await res.json();

      if (data.success) {
        await fetchPembelianDetail(currentPembelian.id);
      } else {
        setCurrentPembelian((prev) => {
          if (!prev) return prev;
          return { ...prev, items: oldItems };
        });
        toast.error(data.error || "Gagal mengupdate item");
      }
    } catch (error) {
      console.error("Error updating item:", error);
      setCurrentPembelian((prev) => {
        if (!prev) return prev;
        return { ...prev, items: oldItems };
      });
      toast.error("Terjadi kesalahan saat mengupdate item");
    }
  };

  // Handle perubahan diskon item dengan tipe
  const handleItemDiskonChange = (
    item: PembelianItem,
    value: string,
    type: "rupiah" | "persen"
  ) => {
    let diskonRupiah: number;
    let displayValue: string;

    if (type === "persen") {
      const cleanValue = value.replace(/[^\d]/g, "");
      const persen = parseInt(cleanValue) || 0;
      const clampedPersen = Math.min(100, Math.max(0, persen));
      diskonRupiah = Math.round((item.hargaPokok * clampedPersen) / 100);
      displayValue = cleanValue === "" ? "" : clampedPersen.toString();
    } else {
      diskonRupiah = parseRupiahToNumber(value);
      displayValue = formatRupiahInput(value);
    }

    setItemDiskonValues((prev) => ({ ...prev, [item.id]: displayValue }));
    handleUpdateItem(item.id, "diskonPerItem", diskonRupiah);
  };

  // Toggle tipe diskon item
  const toggleItemDiskonType = (item: PembelianItem) => {
    const currentType = itemDiskonTypes[item.id] || "rupiah";
    const newType = currentType === "rupiah" ? "persen" : "rupiah";

    setItemDiskonTypes((prev) => ({ ...prev, [item.id]: newType }));

    if (newType === "persen") {
      const persen =
        item.hargaPokok > 0
          ? Math.round((item.diskonPerItem / item.hargaPokok) * 100)
          : 0;
      setItemDiskonValues((prev) => ({
        ...prev,
        [item.id]: persen.toString(),
      }));
    } else {
      setItemDiskonValues((prev) => ({
        ...prev,
        [item.id]:
          item.diskonPerItem === 0
            ? "0"
            : item.diskonPerItem.toLocaleString("id-ID"),
      }));
    }
  };

  // Fungsi untuk mendapatkan display value diskon item
  const getItemDiskonDisplayValue = (item: PembelianItem): string => {
    const type = itemDiskonTypes[item.id] || "rupiah";
    const storedValue = itemDiskonValues[item.id];

    if (storedValue !== undefined && storedValue !== "") {
      return storedValue;
    }

    if (type === "persen") {
      const persen =
        item.hargaPokok > 0
          ? Math.round((item.diskonPerItem / item.hargaPokok) * 100)
          : 0;
      return persen.toString();
    } else {
      if (item.diskonPerItem === 0) {
        return "0";
      }
      return item.diskonPerItem.toLocaleString("id-ID");
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!currentPembelian) return;
    if (!confirm("Apakah Anda yakin ingin menghapus item ini?")) return;

    try {
      const res = await fetch(
        `/api/pembelian/${currentPembelian.id}/items/${itemId}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (data.success) {
        await fetchPembelianDetail(currentPembelian.id);
        toast.success("Item berhasil dihapus");
      } else {
        toast.error(data.error || "Gagal menghapus item");
      }
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  // Hitung diskon nota dalam rupiah
  const calculateDiskonNotaRupiah = (): number => {
    if (!currentPembelian?.calculation) return 0;

    const subtotal = currentPembelian.calculation.ringkasan.subtotal;

    if (diskonNotaType === "persen") {
      const persen = parseInt(diskonNota) || 0;
      return Math.round((subtotal * persen) / 100);
    } else {
      return parseRupiahToNumber(diskonNota);
    }
  };

  // Update Diskon Nota
  const handleUpdateDiskonNota = async () => {
    if (!currentPembelian) return;

    const diskonNotaRupiah = calculateDiskonNotaRupiah();

    try {
      const res = await fetch(`/api/pembelian/${currentPembelian.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diskonNota: diskonNotaRupiah }),
      });
      const data = await res.json();

      if (data.success) {
        setCurrentPembelian(data.data);
      }
    } catch (error) {
      console.error("Error updating diskon nota:", error);
    }
  };

  // Handle diskon nota change
  const handleDiskonNotaChange = (value: string) => {
    if (diskonNotaType === "persen") {
      const persen = parseInt(value) || 0;
      setDiskonNota(Math.min(100, Math.max(0, persen)).toString());
    } else {
      setDiskonNota(formatRupiahInput(value));
    }
  };

  // Toggle tipe diskon nota
  const toggleDiskonNotaType = () => {
    const newType = diskonNotaType === "rupiah" ? "persen" : "rupiah";
    setDiskonNotaType(newType);

    if (!currentPembelian?.calculation) return;

    const subtotal = currentPembelian.calculation.ringkasan.subtotal;

    if (newType === "persen") {
      const currentRupiah = parseRupiahToNumber(diskonNota);
      const persen =
        subtotal > 0 ? Math.round((currentRupiah / subtotal) * 100) : 0;
      setDiskonNota(persen.toString());
    } else {
      const currentPersen = parseInt(diskonNota) || 0;
      const rupiah = Math.round((subtotal * currentPersen) / 100);
      setDiskonNota(rupiah === 0 ? "0" : rupiah.toLocaleString("id-ID"));
    }
  };

  // Hitung total dengan diskon nota yang baru
  const calculatedTotal = currentPembelian?.calculation?.ringkasan
    ? currentPembelian.calculation.ringkasan.subtotal -
      calculateDiskonNotaRupiah()
    : 0;

  // Step 3: Checkout
  const handleCheckout = async () => {
    if (!currentPembelian) return;

    if (!jumlahDibayar) {
      toast.error("Jumlah pembayaran wajib diisi");
      return;
    }

    const diskonNotaRupiah = calculateDiskonNotaRupiah();

    setLoading(true);
    try {
      const checkoutData: any = {
        diskonNota: diskonNotaRupiah,
        jumlahDibayar: parseRupiahToNumber(jumlahDibayar),
      };

      if (tanggalJatuhTempo) {
        checkoutData.tanggalJatuhTempo = tanggalJatuhTempo;
      }

      const res = await fetch(
        `/api/pembelian/${currentPembelian.id}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(checkoutData),
        }
      );
      const data = await res.json();

      if (data.success) {
        setReceiptData(data.data.receipt);
        setShowCheckoutModal(false);
        setShowReceiptModal(true);
        setTanggalJatuhTempo("");
        toast.success(data.message);
        fetchPembelianHistory();
      } else {
        toast.error(data.error || "Gagal checkout");
      }
    } catch (error) {
      console.error("Error checkout:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  // Cancel Pembelian
  const handleCancelPembelian = async () => {
    if (!currentPembelian) return;
    if (!confirm("Apakah Anda yakin ingin membatalkan pembelian ini?")) return;

    try {
      const res = await fetch(`/api/pembelian/${currentPembelian.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Pembelian dibatalkan");
        resetAll();
      } else {
        toast.error(data.error || "Gagal membatalkan pembelian");
      }
    } catch (error) {
      console.error("Error canceling pembelian:", error);
    }
  };

  // Lanjutkan transaksi yang masih KERANJANG
  const handleContinueTransaction = async (pembelian: PembelianHeader) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pembelian/${pembelian.id}`);
      const data = await res.json();

      if (data.success) {
        const supplier = suppliersList.find(
          (s) => s.id === pembelian.supplierId
        );
        if (supplier) {
          setSelectedSupplier(supplier);
        } else {
          setSelectedSupplier(pembelian.supplier as Supplier);
        }

        setCurrentPembelian(data.data);

        // Format diskonNota
        const diskonNotaValue = data.data.diskonNota || 0;
        setDiskonNota(
          diskonNotaValue === 0 ? "0" : diskonNotaValue.toLocaleString("id-ID")
        );
        setDiskonNotaType("rupiah");

        // Reset diskon types untuk items
        const types: { [key: number]: "rupiah" | "persen" } = {};
        const values: { [key: number]: string } = {};
        data.data.items?.forEach((item: PembelianItem) => {
          types[item.id] = "rupiah";
          values[item.id] =
            item.diskonPerItem === 0
              ? "0"
              : item.diskonPerItem.toLocaleString("id-ID");
        });
        setItemDiskonTypes(types);
        setItemDiskonValues(values);

        setStep(2);
        setShowKeranjangModal(false);
        toast.success("Melanjutkan transaksi " + pembelian.kodePembelian);
      } else {
        toast.error(data.error || "Gagal mengambil data pembelian");
      }
    } catch (error) {
      console.error("Error continuing transaction:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  // Batalkan transaksi dari history
  const handleCancelFromHistory = async (
    pembelianId: number,
    kodePembelian: string
  ) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin membatalkan transaksi ${kodePembelian}?`
      )
    )
      return;

    try {
      const res = await fetch(`/api/pembelian/${pembelianId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Transaksi ${kodePembelian} berhasil dibatalkan`);
        fetchPembelianHistory();
      } else {
        toast.error(data.error || "Gagal membatalkan transaksi");
      }
    } catch (error) {
      console.error("Error canceling transaction:", error);
      toast.error("Terjadi kesalahan");
    }
  };

  const resetAll = () => {
    setStep(1);
    setSelectedSupplier(null);
    setCurrentPembelian(null);
    setDiskonNota("0");
    setDiskonNotaType("rupiah");
    setJumlahDibayar("");
    setItemDiskonTypes({});
    setItemDiskonValues({});
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const filteredSuppliers = suppliersList.filter((s) =>
    s.namaSupplier.toLowerCase().includes(searchSupplier.toLowerCase())
  );

  const filteredBarang =
    selectedSupplier?.barang?.filter((b) =>
      b.namaBarang.toLowerCase().includes(searchBarang.toLowerCase())
    ) || [];

  const calculation = currentPembelian?.calculation?.ringkasan;

  return (
    <div className="w-full max-w-7xl mx-auto">
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
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Pembelian Barang
            </h1>
            <p className="text-emerald-100">
              Kelola transaksi pembelian dari supplier
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowKeranjangModal(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium"
            >
              <ShoppingCart className="w-4 h-4" />
              Keranjang
              {pembelianList.filter((p) => p.statusTransaksi === "KERANJANG")
                .length > 0 && (
                <span className="bg-white text-yellow-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {
                    pembelianList.filter(
                      (p) => p.statusTransaksi === "KERANJANG"
                    ).length
                  }
                </span>
              )}
            </button>
            <Link
              href="/dashboard/admin/pembelian/riwayat"
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
            >
              <Receipt className="w-4 h-4" />
              Riwayat
            </Link>
            <button
              onClick={resetAll}
              className="bg-white hover:bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              <Plus className="w-4 h-4" />
              Transaksi Baru
            </button>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-md border border-gray-100">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: "Pilih Supplier", icon: Truck },
            { num: 2, label: "Tambah Barang", icon: Package },
            { num: 3, label: "Pembayaran", icon: CreditCard },
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step >= s.num
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p
                    className={`font-medium ${
                      step >= s.num ? "text-emerald-600" : "text-gray-500"
                    }`}
                  >
                    Step {s.num}
                  </p>
                  <p className="text-sm text-gray-500">{s.label}</p>
                </div>
              </div>
              {idx < 2 && (
                <ChevronRight
                  className={`w-6 h-6 ${
                    step > s.num ? "text-emerald-600" : "text-gray-300"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 1: Pilih Supplier */}
      {step === 1 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Pilih Supplier
          </h2>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari supplier..."
              value={searchSupplier}
              onChange={(e) => setSearchSupplier(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
            />
          </div>

          {/* Supplier List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                onClick={() => handleSelectSupplier(supplier)}
                className="border border-gray-200 rounded-lg p-4 hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer transition-all"
              >
                <h3 className="font-semibold text-gray-900">
                  {supplier.namaSupplier}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{supplier.alamat}</p>
                <p className="text-sm text-gray-500">{supplier.noHp}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                    {supplier.barang?.length || 0} Barang
                  </span>
                  <span className="text-xs text-gray-500">
                    Limit: {formatRupiah(supplier.limitHutang)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filteredSuppliers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Tidak ada supplier ditemukan
            </div>
          )}
        </div>
      )}

      {/* Step 2: Keranjang Pembelian */}
      {step === 2 && currentPembelian && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daftar Barang Supplier */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Daftar Barang
                </h2>
                <p className="text-sm text-gray-500">
                  Supplier: {selectedSupplier?.namaSupplier}
                </p>
              </div>
              <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-sm font-medium">
                {currentPembelian.kodePembelian}
              </span>
            </div>

            {/* Search Barang */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari barang..."
                value={searchBarang}
                onChange={(e) => setSearchBarang(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
              />
            </div>

            {/* Barang List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredBarang.length > 0 ? (
                filteredBarang.map((barang) => (
                  <div
                    key={barang.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {barang.namaBarang}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {barang.ukuran} {barang.satuan} •{" "}
                        {barang.jumlahPerkardus} pcs/dus
                      </p>
                      <p className="text-sm text-emerald-600 font-medium">
                        {formatRupiah(barang.hargaBeli)}/dus
                      </p>
                    </div>
                    <button
                      onClick={() => handleQuickAddItem(barang)}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg transition-all disabled:opacity-50"
                      title="Tambah ke keranjang"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Tidak ada barang dari supplier ini</p>
                </div>
              )}
            </div>
          </div>

          {/* Keranjang */}
          <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              <h2 className="text-xl font-bold text-gray-900">Keranjang</h2>
              <span className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full">
                {currentPembelian.items?.length || 0}
              </span>
            </div>

            {/* Cart Items */}
            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
              {currentPembelian.items?.length > 0 ? (
                currentPembelian.items.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                  >
                    {/* Header: Nama Barang & Delete */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {item.barang.namaBarang}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {item.barang.ukuran} {item.barang.satuan} •{" "}
                          {item.barang.jumlahPerkardus} pcs/dus
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Hapus item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Row 1: Quantity */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Jumlah:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleUpdateItem(
                              item.id,
                              "jumlahDus",
                              Math.max(1, item.jumlahDus - 1)
                            )
                          }
                          className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          value={item.jumlahDus}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            handleUpdateItem(
                              item.id,
                              "jumlahDus",
                              Math.max(1, val)
                            );
                          }}
                          className="w-14 text-center font-medium border border-gray-300 rounded px-1 py-1 text-sm"
                          min="1"
                        />
                        <button
                          onClick={() =>
                            handleUpdateItem(
                              item.id,
                              "jumlahDus",
                              item.jumlahDus + 1
                            )
                          }
                          className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-gray-500">dus</span>
                      </div>
                    </div>

                    {/* Row 2: Harga Pokok - Display only, tidak bisa diubah */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Harga/dus:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatRupiah(item.hargaPokok)}
                      </span>
                    </div>

                    {/* Row 3: Diskon per Item dengan toggle Rupiah/Persen */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Diskon/dus:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleItemDiskonType(item)}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                            (itemDiskonTypes[item.id] || "rupiah") === "rupiah"
                              ? "bg-green-100 text-green-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                          title="Klik untuk toggle Rupiah/Persen"
                        >
                          {(itemDiskonTypes[item.id] || "rupiah") ===
                          "rupiah" ? (
                            <DollarSign className="w-3 h-3" />
                          ) : (
                            <Percent className="w-3 h-3" />
                          )}
                        </button>
                        <input
                          type="text"
                          value={getItemDiskonDisplayValue(item)}
                          onChange={(e) =>
                            handleItemDiskonChange(
                              item,
                              e.target.value,
                              itemDiskonTypes[item.id] || "rupiah"
                            )
                          }
                          className="w-20 text-right text-sm border border-gray-300 rounded px-1 py-0.5"
                          placeholder="0"
                        />
                        <span className="text-xs text-gray-400 w-4">
                          {(itemDiskonTypes[item.id] || "rupiah") === "persen"
                            ? "%"
                            : ""}
                        </span>
                      </div>
                    </div>

                    {/* Tampilkan nilai rupiah jika mode persen */}
                    {(itemDiskonTypes[item.id] || "rupiah") === "persen" &&
                      item.diskonPerItem > 0 && (
                        <div className="flex justify-end mb-2">
                          <span className="text-xs text-gray-500">
                            = {formatRupiah(item.diskonPerItem)}/dus
                          </span>
                        </div>
                      )}

                    {/* Subtotal */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm font-medium text-gray-700">
                        Subtotal:
                      </span>
                      <p className="font-bold text-emerald-600">
                        {formatRupiah(
                          item.hargaPokok * item.jumlahDus -
                            item.diskonPerItem * item.jumlahDus
                        )}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Keranjang kosong</p>
                  <p className="text-xs mt-1">
                    Klik tombol + pada barang untuk menambahkan
                  </p>
                </div>
              )}
            </div>

            {/* Summary */}
            {currentPembelian.items?.length > 0 && calculation && (
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatRupiah(calculation.subtotal)}</span>
                </div>
                {calculation.totalDiskonItem > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Diskon Item</span>
                    <span>-{formatRupiah(calculation.totalDiskonItem)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-500">Diskon Nota</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={toggleDiskonNotaType}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                        diskonNotaType === "rupiah"
                          ? "bg-green-100 text-green-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                      title="Klik untuk toggle Rupiah/Persen"
                    >
                      {diskonNotaType === "rupiah" ? (
                        <DollarSign className="w-3 h-3" />
                      ) : (
                        <Percent className="w-3 h-3" />
                      )}
                    </button>
                    <input
                      type="text"
                      value={diskonNota}
                      onChange={(e) => handleDiskonNotaChange(e.target.value)}
                      onBlur={handleUpdateDiskonNota}
                      className="w-20 text-right border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="0"
                    />
                    {diskonNotaType === "persen" && (
                      <span className="text-xs text-gray-400">%</span>
                    )}
                  </div>
                </div>
                {diskonNotaType === "persen" &&
                  calculateDiskonNotaRupiah() > 0 && (
                    <div className="flex justify-end text-xs text-gray-500">
                      = {formatRupiah(calculateDiskonNotaRupiah())}
                    </div>
                  )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span className="text-emerald-600">
                    {formatRupiah(Math.max(0, calculatedTotal))}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 space-y-2">
              <button
                onClick={() => {
                  if (currentPembelian.items?.length > 0) {
                    setShowCheckoutModal(true);
                  } else {
                    toast.error("Keranjang masih kosong");
                  }
                }}
                disabled={!currentPembelian.items?.length}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Proses Pembayaran
              </button>
              <button
                onClick={handleCancelPembelian}
                className="w-full bg-red-100 hover:bg-red-200 text-red-600 py-2 rounded-lg font-medium transition-all"
              >
                Batalkan Pembelian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Checkout */}
      {showCheckoutModal && currentPembelian && calculation && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCheckoutModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 rounded-t-xl flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Pembayaran</h2>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Kode Pembelian</span>
                  <span className="font-medium">
                    {currentPembelian.kodePembelian}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Supplier</span>
                  <span>{selectedSupplier?.namaSupplier}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Item</span>
                  <span>{currentPembelian.items?.length} barang</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatRupiah(calculation.subtotal)}</span>
                  </div>
                  {calculation.totalDiskonItem > 0 && (
                    <div className="flex justify-between text-sm text-red-500">
                      <span>Diskon Item</span>
                      <span>-{formatRupiah(calculation.totalDiskonItem)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Diskon Nota</span>
                    <span>-{formatRupiah(calculateDiskonNotaRupiah())}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg mt-2">
                    <span>Total Bayar</span>
                    <span className="text-emerald-600">
                      {formatRupiah(Math.max(0, calculatedTotal))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Input */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Jumlah Dibayar <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      Rp
                    </span>
                    <input
                      type="text"
                      value={jumlahDibayar}
                      onChange={(e) =>
                        setJumlahDibayar(formatRupiahInput(e.target.value))
                      }
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-lg"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Quick Amount Buttons */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() =>
                      setJumlahDibayar(
                        Math.max(0, calculatedTotal).toLocaleString("id-ID")
                      )
                    }
                    className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded text-sm hover:bg-emerald-200"
                  >
                    Pas
                  </button>
                  {[50000, 100000, 200000, 500000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() =>
                        setJumlahDibayar(amount.toLocaleString("id-ID"))
                      }
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                    >
                      {formatRupiah(amount)}
                    </button>
                  ))}
                </div>

                {/* Payment Status Preview */}
                {jumlahDibayar && (
                  <div
                    className={`rounded-lg p-4 ${
                      parseRupiahToNumber(jumlahDibayar) >= calculatedTotal
                        ? "bg-green-50 border border-green-200"
                        : "bg-yellow-50 border border-yellow-200"
                    }`}
                  >
                    {parseRupiahToNumber(jumlahDibayar) >= calculatedTotal ? (
                      <>
                        <div className="flex items-center gap-2 text-green-700 font-medium">
                          <Check className="w-5 h-5" />
                          Status: LUNAS
                        </div>
                        {parseRupiahToNumber(jumlahDibayar) >
                          calculatedTotal && (
                          <p className="text-green-600 mt-1">
                            Kembalian:{" "}
                            {formatRupiah(
                              parseRupiahToNumber(jumlahDibayar) -
                                calculatedTotal
                            )}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-yellow-700 font-medium">
                          <AlertCircle className="w-5 h-5" />
                          Status: HUTANG
                        </div>
                        <p className="text-yellow-600 mt-1">
                          Sisa Hutang:{" "}
                          {formatRupiah(
                            calculatedTotal - parseRupiahToNumber(jumlahDibayar)
                          )}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Tanggal Jatuh Tempo - Hanya tampil jika status HUTANG */}
                {jumlahDibayar &&
                  parseRupiahToNumber(jumlahDibayar) < calculatedTotal && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tanggal Jatuh Tempo
                        <span className="text-gray-400 font-normal ml-1">
                          (Opsional, default 30 hari)
                        </span>
                      </label>
                      <input
                        type="date"
                        value={tanggalJatuhTempo}
                        onChange={(e) => setTanggalJatuhTempo(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Jika tidak diisi, jatuh tempo akan ditetapkan 30 hari
                        dari sekarang
                      </p>
                    </div>
                  )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={loading || !jumlahDibayar}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    "Memproses..."
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Selesaikan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Receipt */}
      {showReceiptModal && receiptData && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowReceiptModal(false);
            resetAll();
          }}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 rounded-t-xl text-center">
              <Check className="w-16 h-16 text-white mx-auto mb-2" />
              <h2 className="text-2xl font-bold text-white">
                Transaksi Berhasil!
              </h2>
            </div>

            <div className="p-6">
              <div className="text-center mb-4">
                <p className="text-gray-500">Kode Pembelian</p>
                <p className="text-xl font-bold text-gray-900">
                  {receiptData.kodePembelian}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(receiptData.tanggal).toLocaleString("id-ID")}
                </p>
              </div>

              <div className="border-t border-b border-dashed border-gray-300 py-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Supplier</span>
                  <span className="font-medium">
                    {receiptData.supplier.nama}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Item</span>
                  <span>{receiptData.items?.length} barang</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatRupiah(receiptData.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Diskon Nota</span>
                  <span>-{formatRupiah(receiptData.diskonNota)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatRupiah(receiptData.totalHarga)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dibayar</span>
                  <span>{formatRupiah(receiptData.jumlahDibayar)}</span>
                </div>
                {receiptData.kembalian > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Kembalian</span>
                    <span>{formatRupiah(receiptData.kembalian)}</span>
                  </div>
                )}
                {receiptData.sisaHutang > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Sisa Hutang</span>
                    <span>{formatRupiah(receiptData.sisaHutang)}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 text-center">
                <span
                  className={`inline-block px-4 py-2 rounded-full font-medium ${
                    receiptData.statusPembayaran === "LUNAS"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {receiptData.statusPembayaran}
                </span>
              </div>

              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  resetAll();
                }}
                className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-all"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Keranjang */}
      {showKeranjangModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowKeranjangModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">
                  Transaksi Belum Selesai
                </h2>
              </div>
              <button
                onClick={() => setShowKeranjangModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {pembelianList.filter((p) => p.statusTransaksi === "KERANJANG")
                .length > 0 ? (
                <div className="space-y-3">
                  {pembelianList
                    .filter((p) => p.statusTransaksi === "KERANJANG")
                    .map((pb) => (
                      <div
                        key={pb.id}
                        className="border border-yellow-300 bg-yellow-50 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {pb.kodePembelian}
                            </p>
                            <p className="text-sm text-gray-500">
                              {pb.supplier?.namaSupplier}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(pb.createdAt).toLocaleString("id-ID")}
                            </p>
                            <p className="text-sm text-yellow-700 mt-1">
                              {pb.items?.length || 0} item di keranjang
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">
                              {formatRupiah(pb.totalHarga)}
                            </p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">
                                KERANJANG
                              </span>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleContinueTransaction(pb);
                                  setShowKeranjangModal(false);
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-all flex items-center gap-1"
                              >
                                <ChevronRight className="w-4 h-4" />
                                Lanjutkan
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelFromHistory(
                                    pb.id,
                                    pb.kodePembelian
                                  );
                                }}
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-all flex items-center gap-1"
                              >
                                <Trash2 className="w-4 h-4" />
                                Batalkan
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Tidak ada transaksi yang belum selesai</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PembelianPage;
