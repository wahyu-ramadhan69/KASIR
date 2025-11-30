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
  User,
  CreditCard,
  ChevronRight,
  Receipt,
  AlertCircle,
  Banknote,
  Building2,
  Calendar,
  Clock,
  UserPlus,
  Percent,
  DollarSign,
  AlertTriangle,
  Users,
  TrendingUp,
  Briefcase,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface Sales {
  id: number;
  namaSales: string;
  nik: string;
  alamat: string;
  noHp: string;
  limitHutang: number;
  hutang: number;
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

interface PenjualanItem {
  id: number;
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  hargaJual: number;
  diskonPerItem: number;
  barang: Barang;
}

interface PenjualanHeader {
  id: number;
  kodePenjualan: string;
  salesId: number | null;
  namaSales: string | null;
  subtotal: number;
  diskonNota: number;
  totalHarga: number;
  jumlahDibayar: number;
  kembalian: number;
  metodePembayaran: "CASH" | "TRANSFER";
  statusPembayaran: "LUNAS" | "HUTANG";
  statusTransaksi: "KERANJANG" | "SELESAI" | "DIBATALKAN";
  tanggalTransaksi: string;
  tanggalJatuhTempo: string;
  sales: Sales | null;
  items: PenjualanItem[];
  createdAt: string;
  updatedAt: string;
  calculation?: {
    items: any[];
    ringkasan: {
      subtotal: number;
      totalDiskonItem: number;
      diskonNota: number;
      totalHarga: number;
    };
  };
}

interface Props {
  isAdmin?: boolean;
  userId?: number;
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

const PenjualanSalesPage = ({ isAdmin = false, userId }: Props) => {
  // State management
  const [step, setStep] = useState<number>(1);
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [salesList, setSalesList] = useState<Sales[]>([]);
  const [currentPenjualan, setCurrentPenjualan] =
    useState<PenjualanHeader | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchBarang, setSearchBarang] = useState<string>("");
  const [searchSales, setSearchSales] = useState<string>("");

  const [selectedSales, setSelectedSales] = useState<Sales | null>(null);
  const [manualSalesName, setManualSalesName] = useState<string>("");
  const [useManualSales, setUseManualSales] = useState<boolean>(false);

  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [diskonNota, setDiskonNota] = useState<string>("0");
  const [diskonNotaType, setDiskonNotaType] = useState<"rupiah" | "persen">(
    "rupiah"
  );
  const [jumlahDibayar, setJumlahDibayar] = useState<string>("");
  const [metodePembayaran, setMetodePembayaran] = useState<"CASH" | "TRANSFER">(
    "CASH"
  );
  const [tanggalTransaksi, setTanggalTransaksi] = useState<string>("");
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
  const [penjualanList, setPenjualanList] = useState<PenjualanHeader[]>([]);
  const [showKeranjangModal, setShowKeranjangModal] = useState<boolean>(false);

  useEffect(() => {
    fetchBarang();
    fetchSales();
    fetchPenjualanHistory();
    const today = new Date().toISOString().split("T")[0];
    setTanggalTransaksi(today);
  }, []);

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

  const fetchSales = async () => {
    try {
      const res = await fetch("/api/sales");
      const data = await res.json();
      if (data.success) {
        setSalesList(data.data);
      }
    } catch (error) {
      console.error("Error fetching sales:", error);
      toast.error("Gagal mengambil data sales");
    }
  };

  const fetchPenjualanHistory = async () => {
    try {
      const res = await fetch(
        "/api/penjualan?tipePenjualan=sales&status=KERANJANG"
      );
      const data = await res.json();
      if (data.success) {
        setPenjualanList(data.data);
      }
    } catch (error) {
      console.error("Error fetching penjualan:", error);
    }
  };

  const fetchPenjualanDetail = async (
    id: number,
    preserveDiskonState: boolean = true
  ) => {
    try {
      const res = await fetch(`/api/penjualan/${id}`);
      const data = await res.json();
      if (data.success) {
        setCurrentPenjualan(data.data);

        if (preserveDiskonState) {
          const newTypes: { [key: number]: "rupiah" | "persen" } = {
            ...itemDiskonTypes,
          };
          const newValues: { [key: number]: string } = { ...itemDiskonValues };

          data.data.items?.forEach((item: PenjualanItem) => {
            if (newTypes[item.id] === undefined) {
              newTypes[item.id] = "rupiah";
              newValues[item.id] =
                item.diskonPerItem === 0
                  ? "0"
                  : item.diskonPerItem.toLocaleString("id-ID");
            } else {
              const currentType = newTypes[item.id];
              if (currentType === "persen") {
                const persen =
                  item.hargaJual > 0
                    ? Math.round((item.diskonPerItem / item.hargaJual) * 100)
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
          const types: { [key: number]: "rupiah" | "persen" } = {};
          const values: { [key: number]: string } = {};
          data.data.items?.forEach((item: PenjualanItem) => {
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
      console.error("Error fetching penjualan detail:", error);
    }
  };

  // Step 1: Buat Keranjang Baru dengan Sales
  const handleCreateKeranjang = async () => {
    // Validasi sales harus dipilih
    if (!selectedSales && !manualSalesName) {
      toast.error("Sales wajib dipilih untuk penjualan sales");
      return;
    }

    setLoading(true);
    try {
      const requestData: any = { userId };

      if (selectedSales) {
        requestData.salesId = selectedSales.id;
      }

      const res = await fetch("/api/penjualan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });
      const data = await res.json();

      if (data.success) {
        setCurrentPenjualan(data.data);
        setStep(2);
        toast.success("Keranjang penjualan sales berhasil dibuat");
      } else {
        toast.error(data.error || "Gagal membuat keranjang");
      }
    } catch (error) {
      console.error("Error creating penjualan:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  // Quick Add Item ke Keranjang
  const handleQuickAddItem = async (barang: Barang) => {
    if (!currentPenjualan) return;

    if (barang.stok < barang.jumlahPerkardus) {
      toast.error(`Stok ${barang.namaBarang} tidak cukup`);
      return;
    }

    const existingItem = currentPenjualan.items?.find(
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
      const res = await fetch(`/api/penjualan/${currentPenjualan.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barangId: barang.id,
          jumlahDus: 1,
          jumlahPcs: 0,
          hargaJual: barang.hargaJual,
          diskonPerItem: 0,
        }),
      });
      const data = await res.json();

      if (data.success) {
        await fetchPenjualanDetail(currentPenjualan.id);
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
    if (!currentPenjualan) return;

    const oldItems = [...currentPenjualan.items];

    setCurrentPenjualan((prev) => {
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
        `/api/penjualan/${currentPenjualan.id}/items/${itemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        }
      );
      const data = await res.json();

      if (data.success) {
        await fetchPenjualanDetail(currentPenjualan.id);
      } else {
        setCurrentPenjualan((prev) => {
          if (!prev) return prev;
          return { ...prev, items: oldItems };
        });
        toast.error(data.error || "Gagal mengupdate item");
      }
    } catch (error) {
      console.error("Error updating item:", error);
      setCurrentPenjualan((prev) => {
        if (!prev) return prev;
        return { ...prev, items: oldItems };
      });
      toast.error("Terjadi kesalahan");
    }
  };

  const handleItemDiskonChange = (
    item: PenjualanItem,
    value: string,
    type: "rupiah" | "persen"
  ) => {
    let diskonRupiah: number;
    let displayValue: string;

    if (type === "persen") {
      const cleanValue = value.replace(/[^\d]/g, "");
      const persen = parseInt(cleanValue) || 0;
      const clampedPersen = Math.min(100, Math.max(0, persen));
      diskonRupiah = Math.round((item.hargaJual * clampedPersen) / 100);
      displayValue = cleanValue === "" ? "" : clampedPersen.toString();
    } else {
      diskonRupiah = parseRupiahToNumber(value);
      displayValue = formatRupiahInput(value);
    }

    setItemDiskonValues((prev) => ({ ...prev, [item.id]: displayValue }));
    handleUpdateItem(item.id, "diskonPerItem", diskonRupiah);
  };

  const toggleItemDiskonType = (item: PenjualanItem) => {
    const currentType = itemDiskonTypes[item.id] || "rupiah";
    const newType = currentType === "rupiah" ? "persen" : "rupiah";

    setItemDiskonTypes((prev) => ({ ...prev, [item.id]: newType }));

    if (newType === "persen") {
      const persen =
        item.hargaJual > 0
          ? Math.round((item.diskonPerItem / item.hargaJual) * 100)
          : 0;
      setItemDiskonValues((prev) => ({
        ...prev,
        [item.id]: persen.toString(),
      }));
    } else {
      setItemDiskonValues((prev) => ({
        ...prev,
        [item.id]: item.diskonPerItem.toLocaleString("id-ID"),
      }));
    }
  };

  const getItemDiskonDisplayValue = (item: PenjualanItem): string => {
    const type = itemDiskonTypes[item.id] || "rupiah";
    const storedValue = itemDiskonValues[item.id];

    if (storedValue !== undefined && storedValue !== "") {
      return storedValue;
    }

    if (type === "persen") {
      const persen =
        item.hargaJual > 0
          ? Math.round((item.diskonPerItem / item.hargaJual) * 100)
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
    if (!currentPenjualan) return;
    if (!confirm("Apakah Anda yakin ingin menghapus item ini?")) return;

    try {
      const res = await fetch(
        `/api/penjualan/${currentPenjualan.id}/items/${itemId}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (data.success) {
        await fetchPenjualanDetail(currentPenjualan.id);
        toast.success("Item berhasil dihapus");
      } else {
        toast.error(data.error || "Gagal menghapus item");
      }
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const calculateDiskonNotaRupiah = (): number => {
    if (!currentPenjualan?.calculation) return 0;

    const subtotalAfterItemDiskon =
      currentPenjualan.calculation.ringkasan.subtotal -
      currentPenjualan.calculation.ringkasan.totalDiskonItem;

    if (diskonNotaType === "persen") {
      const persen = parseInt(diskonNota) || 0;
      return Math.round((subtotalAfterItemDiskon * persen) / 100);
    } else {
      return parseRupiahToNumber(diskonNota);
    }
  };

  const handleUpdateDiskonNota = async () => {
    if (!currentPenjualan) return;

    const diskonNotaRupiah = calculateDiskonNotaRupiah();

    try {
      const res = await fetch(`/api/penjualan/${currentPenjualan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diskonNota: diskonNotaRupiah }),
      });
      const data = await res.json();

      if (data.success) {
        setCurrentPenjualan(data.data);
      }
    } catch (error) {
      console.error("Error updating diskon nota:", error);
    }
  };

  const handleDiskonNotaChange = (value: string) => {
    if (diskonNotaType === "persen") {
      const persen = parseInt(value) || 0;
      setDiskonNota(Math.min(100, Math.max(0, persen)).toString());
    } else {
      setDiskonNota(formatRupiahInput(value));
    }
  };

  const toggleDiskonNotaType = () => {
    const newType = diskonNotaType === "rupiah" ? "persen" : "rupiah";
    setDiskonNotaType(newType);

    if (!currentPenjualan?.calculation) return;

    const subtotalAfterItemDiskon =
      currentPenjualan.calculation.ringkasan.subtotal -
      currentPenjualan.calculation.ringkasan.totalDiskonItem;

    if (newType === "persen") {
      const currentRupiah = parseRupiahToNumber(diskonNota);
      const persen = Math.round(
        (currentRupiah / subtotalAfterItemDiskon) * 100
      );
      setDiskonNota(persen.toString());
    } else {
      const currentPersen = parseInt(diskonNota) || 0;
      const rupiah = Math.round(
        (subtotalAfterItemDiskon * currentPersen) / 100
      );
      setDiskonNota(rupiah.toLocaleString("id-ID"));
    }
  };

  const getSisaLimitHutang = (sales: Sales): number => {
    return Math.max(0, sales.limitHutang - sales.hutang);
  };

  const handleCheckout = async () => {
    if (!currentPenjualan) return;

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
        metodePembayaran,
      };

      if (selectedSales) {
        checkoutData.salesId = selectedSales.id;
      } else {
        checkoutData.namaSales = manualSalesName;
      }

      if (isAdmin && tanggalTransaksi) {
        checkoutData.tanggalTransaksi = tanggalTransaksi;
      }

      if (tanggalJatuhTempo) {
        checkoutData.tanggalJatuhTempo = tanggalJatuhTempo;
      }

      const res = await fetch(
        `/api/penjualan/${currentPenjualan.id}/checkout`,
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
        toast.success(data.message);
        fetchPenjualanHistory();
        fetchBarang();
        fetchSales();
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

  const handleCancelPenjualan = async () => {
    if (!currentPenjualan) return;
    if (!confirm("Apakah Anda yakin ingin membatalkan penjualan ini?")) return;

    try {
      const res = await fetch(`/api/penjualan/${currentPenjualan.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Penjualan dibatalkan");
        resetAll();
      } else {
        toast.error(data.error || "Gagal membatalkan penjualan");
      }
    } catch (error) {
      console.error("Error canceling penjualan:", error);
    }
  };

  const handleContinueTransaction = async (penjualan: PenjualanHeader) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/penjualan/${penjualan.id}`);
      const data = await res.json();

      if (data.success) {
        setCurrentPenjualan(data.data);
        const diskonNotaValue = data.data.diskonNota || 0;
        setDiskonNota(
          diskonNotaValue === 0 ? "0" : diskonNotaValue.toLocaleString("id-ID")
        );
        setDiskonNotaType("rupiah");

        const types: { [key: number]: "rupiah" | "persen" } = {};
        const values: { [key: number]: string } = {};
        data.data.items?.forEach((item: PenjualanItem) => {
          types[item.id] = "rupiah";
          values[item.id] = item.diskonPerItem.toLocaleString("id-ID");
        });
        setItemDiskonTypes(types);
        setItemDiskonValues(values);

        if (data.data.sales) {
          setSelectedSales(data.data.sales);
          setUseManualSales(false);
        } else if (data.data.namaSales) {
          setManualSalesName(data.data.namaSales);
          setUseManualSales(true);
        }

        setStep(2);
        setShowKeranjangModal(false);
        toast.success("Melanjutkan transaksi " + penjualan.kodePenjualan);
      } else {
        toast.error(data.error || "Gagal mengambil data penjualan");
      }
    } catch (error) {
      console.error("Error continuing transaction:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelFromHistory = async (
    penjualanId: number,
    kodePenjualan: string
  ) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin membatalkan transaksi ${kodePenjualan}?`
      )
    )
      return;

    try {
      const res = await fetch(`/api/penjualan/${penjualanId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Transaksi ${kodePenjualan} berhasil dibatalkan`);
        fetchPenjualanHistory();
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
    setCurrentPenjualan(null);
    setSelectedSales(null);
    setManualSalesName("");
    setUseManualSales(false);
    setDiskonNota("0");
    setDiskonNotaType("rupiah");
    setJumlahDibayar("");
    setMetodePembayaran("CASH");
    setTanggalJatuhTempo("");
    setItemDiskonTypes({});
    setItemDiskonValues({});
    const today = new Date().toISOString().split("T")[0];
    setTanggalTransaksi(today);
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const filteredBarang = barangList.filter((b) =>
    b.namaBarang.toLowerCase().includes(searchBarang.toLowerCase())
  );

  const filteredSales = salesList.filter((s) =>
    s.namaSales?.toLowerCase().includes(searchSales.toLowerCase())
  );

  const calculation = currentPenjualan?.calculation?.ringkasan;

  const calculatedTotal = calculation
    ? calculation.subtotal -
      calculation.totalDiskonItem -
      calculateDiskonNotaRupiah()
    : 0;

  const keranjangCount = penjualanList.filter(
    (p) => p.statusTransaksi === "KERANJANG"
  ).length;

  const getPaymentStatus = () => {
    const bayar = parseRupiahToNumber(jumlahDibayar);
    const total = Math.max(0, calculatedTotal);

    if (bayar >= total) {
      return {
        status: "LUNAS",
        kembalian: bayar - total,
        sisaHutang: 0,
        canCheckout: true,
        message: null,
      };
    } else {
      const sisaHutang = total - bayar;

      if (useManualSales || !selectedSales) {
        return {
          status: "HUTANG",
          kembalian: 0,
          sisaHutang,
          canCheckout: false,
          message: "Sales tidak terdaftar tidak bisa mengambil hutang",
        };
      }

      const sisaLimit = getSisaLimitHutang(selectedSales);
      if (selectedSales.limitHutang > 0 && sisaHutang > sisaLimit) {
        return {
          status: "HUTANG",
          kembalian: 0,
          sisaHutang,
          canCheckout: false,
          message: `Hutang melebihi limit! Sisa limit: ${formatRupiah(
            sisaLimit
          )}`,
        };
      }

      return {
        status: "HUTANG",
        kembalian: 0,
        sisaHutang,
        canCheckout: true,
        message: null,
      };
    }
  };

  const paymentStatus = jumlahDibayar ? getPaymentStatus() : null;

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

      {/* Header dengan Gradient Indigo-Cyan */}
      <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-lg">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Penjualan Sales</h1>
            </div>
            <p className="text-cyan-100">
              {isAdmin
                ? "Mode Admin - Kelola transaksi penjualan melalui sales"
                : "Transaksi penjualan yang dilakukan oleh tim sales"}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowKeranjangModal(true)}
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              <ShoppingCart className="w-4 h-4" />
              Keranjang
              {keranjangCount > 0 && (
                <span className="bg-white text-cyan-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {keranjangCount}
                </span>
              )}
            </button>
            <Link
              href="/dashboard/admin/penjualan/sales/riwayat"
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
            >
              <Receipt className="w-4 h-4" />
              Riwayat
            </Link>
            {step === 2 && (
              <button
                onClick={resetAll}
                className="bg-white hover:bg-blue-50 text-indigo-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
              >
                <Plus className="w-4 h-4" />
                Transaksi Baru
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-md border border-gray-100">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: "Pilih Sales", icon: Users },
            { num: 2, label: "Pilih Barang", icon: Package },
            { num: 3, label: "Pembayaran", icon: CreditCard },
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step >= s.num
                      ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p
                    className={`font-medium ${
                      step >= s.num
                        ? "bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent"
                        : "text-gray-500"
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
                    step > s.num ? "text-indigo-600" : "text-gray-300"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 1: Pilih Sales */}
      {step === 1 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Pilih Sales
              </h2>
              <p className="text-gray-500">
                Pilih sales yang akan menangani transaksi ini
              </p>
            </div>

            {/* Toggle Manual/Select */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => {
                  setUseManualSales(false);
                  setManualSalesName("");
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  !useManualSales
                    ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Users className="w-5 h-5 inline mr-2" />
                Pilih dari Daftar
              </button>
              <button
                onClick={() => {
                  setUseManualSales(true);
                  setSelectedSales(null);
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  useManualSales
                    ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <UserPlus className="w-5 h-5 inline mr-2" />
                Input Manual
              </button>
            </div>

            {!useManualSales ? (
              <>
                {/* Search Sales */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Cari nama sales..."
                    value={searchSales}
                    onChange={(e) => setSearchSales(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                  />
                </div>

                {/* Sales List */}
                <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg mb-4">
                  {filteredSales.length > 0 ? (
                    filteredSales.map((sales) => (
                      <div
                        key={sales.id}
                        onClick={() => setSelectedSales(sales)}
                        className={`p-4 cursor-pointer border-b last:border-b-0 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-cyan-50 transition-all ${
                          selectedSales?.id === sales.id
                            ? "bg-gradient-to-r from-indigo-50 to-cyan-50 border-l-4 border-l-indigo-600"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-cyan-100 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {sales.namaSales}
                              </p>
                              <p className="text-sm text-gray-500">
                                {sales.noHp}
                              </p>
                            </div>
                          </div>
                          {selectedSales?.id === sales.id && (
                            <Check className="w-6 h-6 text-indigo-600" />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Tidak ada sales ditemukan</p>
                    </div>
                  )}
                </div>

                {/* Selected Sales Info */}
                {selectedSales && (
                  <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-lg p-4 mb-4 border border-indigo-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-indigo-900">
                          {selectedSales.namaSales}
                        </p>
                        <p className="text-sm text-indigo-700">
                          {selectedSales.noHp}
                        </p>
                        <p className="text-sm text-indigo-600">
                          {selectedSales.alamat}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Masukkan nama sales..."
                  value={manualSalesName}
                  onChange={(e) => setManualSalesName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Sales tidak terdaftar dalam sistem
                </p>
              </div>
            )}

            <button
              onClick={handleCreateKeranjang}
              disabled={loading || (!selectedSales && !manualSalesName)}
              className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
            >
              {loading ? (
                "Memproses..."
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  Lanjut ke Pemilihan Barang
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2 & Checkout sama seperti penjualan toko, tapi dengan warna indigo-cyan */}
      {/* Untuk menghemat space, saya akan membuat versi ringkas dengan perubahan warna utama */}
      {/* Implementasi lengkap akan sama dengan penjualan toko, hanya ganti warna dari blue ke indigo/cyan */}

      {step === 2 && currentPenjualan && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daftar Barang - sama seperti toko tapi dengan aksen warna indigo */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                Daftar Barang
              </h2>
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-indigo-100 to-cyan-100 text-indigo-700 px-3 py-1 rounded-lg text-sm font-medium">
                  {currentPenjualan.kodePenjualan}
                </span>
                {(selectedSales || manualSalesName) && (
                  <span className="bg-gradient-to-r from-indigo-100 to-cyan-100 text-indigo-700 px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {selectedSales?.namaSales || manualSalesName}
                  </span>
                )}
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari barang..."
                value={searchBarang}
                onChange={(e) => setSearchBarang(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
              />
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredBarang.length > 0 ? (
                filteredBarang.map((barang) => (
                  <div
                    key={barang.id}
                    className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gradient-to-r hover:from-indigo-50 hover:to-cyan-50 transition-all ${
                      barang.stok < barang.jumlahPerkardus
                        ? "border-red-200 bg-red-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {barang.namaBarang}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {barang.ukuran} {barang.satuan} •{" "}
                        {barang.jumlahPerkardus} pcs/dus
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-sm font-medium bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                          {formatRupiah(barang.hargaJual)}/dus
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            barang.stok < barang.jumlahPerkardus
                              ? "bg-red-100 text-red-700"
                              : barang.stok < barang.jumlahPerkardus * 5
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          Stok: {barang.stok} pcs
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleQuickAddItem(barang)}
                      disabled={loading || barang.stok < barang.jumlahPerkardus}
                      className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                      title={
                        barang.stok < barang.jumlahPerkardus
                          ? "Stok tidak cukup"
                          : "Tambah ke keranjang"
                      }
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Tidak ada barang ditemukan</p>
                </div>
              )}
            </div>
          </div>

          {/* Keranjang - implementasi sama dengan warna indigo-cyan */}
          <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                Keranjang
              </h2>
              <span className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white text-xs px-2 py-1 rounded-full">
                {currentPenjualan.items?.length || 0}
              </span>
            </div>

            {/* Cart Items - sama seperti toko */}
            <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
              {currentPenjualan.items?.length > 0 ? (
                currentPenjualan.items.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-3 bg-gradient-to-r from-indigo-50/30 to-cyan-50/30"
                  >
                    {/* Implementasi sama dengan penjualan toko */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {item.barang.namaBarang}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {item.barang.jumlahPerkardus} pcs/dus
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600">Jumlah Dus:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            handleUpdateItem(
                              item.id,
                              "jumlahDus",
                              Math.max(0, item.jumlahDus - 1)
                            )
                          }
                          className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          value={item.jumlahDus}
                          onChange={(e) =>
                            handleUpdateItem(
                              item.id,
                              "jumlahDus",
                              Math.max(0, parseInt(e.target.value) || 0)
                            )
                          }
                          className="w-12 text-center text-sm border border-gray-300 rounded px-1 py-0.5"
                          min="0"
                        />
                        <button
                          onClick={() =>
                            handleUpdateItem(
                              item.id,
                              "jumlahDus",
                              item.jumlahDus + 1
                            )
                          }
                          className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600">Jumlah Pcs:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            handleUpdateItem(
                              item.id,
                              "jumlahPcs",
                              Math.max(0, item.jumlahPcs - 1)
                            )
                          }
                          className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          value={item.jumlahPcs}
                          onChange={(e) =>
                            handleUpdateItem(
                              item.id,
                              "jumlahPcs",
                              Math.max(0, parseInt(e.target.value) || 0)
                            )
                          }
                          className="w-12 text-center text-sm border border-gray-300 rounded px-1 py-0.5"
                          min="0"
                        />
                        <button
                          onClick={() =>
                            handleUpdateItem(
                              item.id,
                              "jumlahPcs",
                              item.jumlahPcs + 1
                            )
                          }
                          className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600">Harga/dus:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatRupiah(item.hargaJual)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600">Diskon/dus:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleItemDiskonType(item)}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                            (itemDiskonTypes[item.id] || "rupiah") === "rupiah"
                              ? "bg-green-100 text-green-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
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

                    {(itemDiskonTypes[item.id] || "rupiah") === "persen" &&
                      item.diskonPerItem > 0 && (
                        <div className="flex justify-end mb-2">
                          <span className="text-xs text-gray-500">
                            = {formatRupiah(item.diskonPerItem)}/dus
                          </span>
                        </div>
                      )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="text-xs font-medium text-gray-700">
                        Subtotal:
                      </span>
                      <p className="font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent text-sm">
                        {formatRupiah(
                          item.hargaJual * item.jumlahDus +
                            Math.round(
                              (item.hargaJual / item.barang.jumlahPerkardus) *
                                item.jumlahPcs
                            ) -
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
                    Klik + pada barang untuk menambahkan
                  </p>
                </div>
              )}
            </div>

            {/* Summary dengan warna indigo-cyan */}
            {currentPenjualan.items?.length > 0 && calculation && (
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
                  <span className="bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                    {formatRupiah(Math.max(0, calculatedTotal))}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 space-y-2">
              <button
                onClick={() => {
                  if (currentPenjualan.items?.length > 0) {
                    setShowCheckoutModal(true);
                  } else {
                    toast.error("Keranjang masih kosong");
                  }
                }}
                disabled={!currentPenjualan.items?.length}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <CreditCard className="w-5 h-5" />
                Proses Pembayaran
              </button>
              <button
                onClick={handleCancelPenjualan}
                className="w-full bg-red-100 hover:bg-red-200 text-red-600 py-2 rounded-lg font-medium transition-all"
              >
                Batalkan Penjualan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Checkout */}
      {showCheckoutModal && currentPenjualan && calculation && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCheckoutModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-indigo-600 to-cyan-600 p-6 rounded-t-xl flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Pembayaran Sales</h2>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {/* Sales Info */}
              {(selectedSales || manualSalesName) && (
                <div className="mb-6 bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-lg p-4 border border-indigo-200">
                  <h3 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Sales yang Menangani
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-indigo-900">
                        {selectedSales?.namaSales || manualSalesName}
                      </p>
                      {selectedSales && (
                        <p className="text-sm text-indigo-700">
                          {selectedSales.noHp}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(selectedSales || manualSalesName) && (
                <div className="mb-6 bg-gradient-to-br from-indigo-50 to-cyan-50 rounded-lg p-4 border-2 border-indigo-200">
                  <h3 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Sales
                  </h3>
                  {selectedSales ? (
                    <div>
                      <p className="font-bold text-indigo-900">
                        {selectedSales.namaSales}
                      </p>
                      <p className="text-sm text-indigo-700">
                        {selectedSales.noHp}
                      </p>
                      <p className="text-sm text-indigo-600">
                        {selectedSales.alamat}
                      </p>
                      <div className="mt-2 pt-2 border-t border-indigo-200 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-indigo-600">
                            Hutang saat ini:
                          </span>
                          <p
                            className={`font-semibold ${
                              selectedSales.hutang > 0
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            {formatRupiah(selectedSales.hutang)}
                          </p>
                        </div>
                        <div>
                          <span className="text-indigo-600">Sisa limit:</span>
                          <p
                            className={`font-semibold ${
                              getSisaLimitHutang(selectedSales) > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatRupiah(getSisaLimitHutang(selectedSales))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="font-medium text-indigo-900">
                      {manualSalesName}
                    </p>
                  )}
                </div>
              )}

              {isAdmin && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    value={tanggalTransaksi}
                    onChange={(e) => setTanggalTransaksi(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                  />
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Kode Penjualan</span>
                    <span className="font-medium">
                      {currentPenjualan.kodePenjualan}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Item</span>
                    <span>{currentPenjualan.items?.length} barang</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span>{formatRupiah(calculation.subtotal)}</span>
                    </div>
                    {calculation.totalDiskonItem > 0 && (
                      <div className="flex justify-between text-sm text-red-500">
                        <span>Diskon Item</span>
                        <span>
                          -{formatRupiah(calculation.totalDiskonItem)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Diskon Nota</span>
                      <span>-{formatRupiah(calculateDiskonNotaRupiah())}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg mt-2">
                      <span>Total Bayar</span>
                      <span className="bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                        {formatRupiah(Math.max(0, calculatedTotal))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Metode Pembayaran
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMetodePembayaran("CASH")}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      metodePembayaran === "CASH"
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    Cash
                  </button>
                  <button
                    onClick={() => setMetodePembayaran("TRANSFER")}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      metodePembayaran === "TRANSFER"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    Transfer
                  </button>
                </div>
              </div>

              <div className="mb-4">
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
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none text-lg"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap mb-4">
                <button
                  onClick={() =>
                    setJumlahDibayar(
                      Math.max(0, calculatedTotal).toLocaleString("id-ID")
                    )
                  }
                  className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-sm hover:bg-indigo-200"
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

              {paymentStatus && (
                <div
                  className={`rounded-lg p-4 mb-4 ${
                    paymentStatus.status === "LUNAS"
                      ? "bg-green-50 border border-green-200"
                      : paymentStatus.canCheckout
                      ? "bg-yellow-50 border border-yellow-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  {paymentStatus.status === "LUNAS" ? (
                    <>
                      <div className="flex items-center gap-2 text-green-700 font-medium">
                        <Check className="w-5 h-5" />
                        Status: LUNAS
                      </div>
                      {paymentStatus.kembalian > 0 && (
                        <p className="text-green-600 mt-1">
                          Kembalian: {formatRupiah(paymentStatus.kembalian)}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        className={`flex items-center gap-2 font-medium ${
                          paymentStatus.canCheckout
                            ? "text-yellow-700"
                            : "text-red-700"
                        }`}
                      >
                        {paymentStatus.canCheckout ? (
                          <AlertCircle className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5" />
                        )}
                        Status: HUTANG
                      </div>
                      <p
                        className={`mt-1 ${
                          paymentStatus.canCheckout
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        Sisa Hutang: {formatRupiah(paymentStatus.sisaHutang)}
                      </p>
                      {paymentStatus.message && (
                        <p className="text-red-600 mt-2 text-sm font-medium">
                          ⚠️ {paymentStatus.message}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {paymentStatus?.status === "HUTANG" &&
                paymentStatus.canCheckout && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Tanggal Jatuh Tempo
                      <span className="text-gray-400 font-normal ml-1">
                        (Default 30 hari)
                      </span>
                    </label>
                    <input
                      type="date"
                      value={tanggalJatuhTempo}
                      onChange={(e) => setTanggalJatuhTempo(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                    />
                  </div>
                )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={
                    loading ||
                    !jumlahDibayar ||
                    (paymentStatus !== null && !paymentStatus.canCheckout)
                  }
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 flex items-center justify-center gap-2"
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
            <div className="bg-gradient-to-r from-indigo-600 to-cyan-600 p-6 rounded-t-xl text-center">
              <Check className="w-16 h-16 text-white mx-auto mb-2" />
              <h2 className="text-2xl font-bold text-white">
                Transaksi Sales Berhasil!
              </h2>
            </div>

            <div className="p-6">
              <div className="text-center mb-4">
                <p className="text-gray-500">Kode Penjualan</p>
                <p className="text-xl font-bold text-gray-900">
                  {receiptData.kodePenjualan}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(receiptData.tanggal).toLocaleString("id-ID")}
                </p>
              </div>

              <div className="border-t border-b border-dashed border-gray-300 py-4 space-y-2">
                {receiptData.sales && (
                  <div className="flex justify-between bg-gradient-to-r from-indigo-50 to-cyan-50 p-2 rounded">
                    <span className="text-indigo-700 font-medium flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      Sales
                    </span>
                    <span className="font-semibold text-indigo-900">
                      {receiptData.sales.namaSales || receiptData.sales.nama}
                    </span>
                  </div>
                )}

                {(receiptData.sales || receiptData.namaSales) && (
                  <div className="mb-4 bg-gradient-to-br from-indigo-50 to-cyan-50 rounded-lg p-3 border border-indigo-200">
                    <div className="flex items-center gap-2 text-indigo-700 mb-1">
                      <Briefcase className="w-4 h-4" />
                      <span className="text-xs font-medium">Sales</span>
                    </div>
                    <p className="font-bold text-indigo-900">
                      {receiptData.sales?.namaSales || receiptData.namaSales}
                    </p>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-500">Metode</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      receiptData.metodePembayaran === "CASH"
                        ? "bg-green-100 text-green-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {receiptData.metodePembayaran}
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
                className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white py-3 rounded-lg font-medium transition-all"
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
            <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">
                  Transaksi Sales Belum Selesai
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
              {penjualanList.filter((p) => p.statusTransaksi === "KERANJANG")
                .length > 0 ? (
                <div className="space-y-3">
                  {penjualanList
                    .filter((p) => p.statusTransaksi === "KERANJANG")
                    .map((pj) => (
                      <div
                        key={pj.id}
                        className="border border-cyan-300 bg-gradient-to-r from-cyan-50 to-indigo-50 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {pj.kodePenjualan}
                            </p>
                            {(pj.sales || pj.namaSales) && (
                              <div className="flex items-center gap-2 text-sm text-indigo-700 mt-1">
                                <Briefcase className="w-4 h-4" />
                                {pj.sales?.namaSales || pj.namaSales}
                              </div>
                            )}
                            <p className="text-xs text-gray-400">
                              {new Date(pj.createdAt).toLocaleString("id-ID")}
                            </p>
                            <p className="text-sm text-cyan-700 mt-1">
                              {pj.items?.length || 0} item di keranjang
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                              {formatRupiah(pj.totalHarga)}
                            </p>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleContinueTransaction(pj)}
                                className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white text-xs font-medium rounded-lg transition-all flex items-center gap-1"
                              >
                                <ChevronRight className="w-4 h-4" />
                                Lanjutkan
                              </button>
                              <button
                                onClick={() =>
                                  handleCancelFromHistory(
                                    pj.id,
                                    pj.kodePenjualan
                                  )
                                }
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
                  <p>Tidak ada transaksi sales yang belum selesai</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PenjualanSalesPage;
