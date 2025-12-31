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
  Receipt,
  AlertCircle,
  Percent,
  DollarSign,
  Store,
  RefreshCw,
  Phone,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Supplier {
  id: number;
  namaSupplier: string;
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
  jumlahPerKemasan: number;
  supplierId: number;
  jenisKemasan: string;
  berat: number;
  supplier: Supplier;
}

// Local cart item (tidak perlu id karena belum di database)
interface CartItem {
  tempId: string; // temporary ID untuk tracking di UI
  itemId?: number;
  barangId: number;
  jumlahDus: number;
  hargaPokok: number;
  diskonPerItem: number;
  barang: Barang;
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

const formatGramsToKg = (grams: number): string => {
  if (!Number.isFinite(grams)) return "";
  const kg = grams / 1000;
  const formatted = kg.toFixed(3).replace(/\.?0+$/, "");
  return formatted.replace(".", ",");
};

const PembelianPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  // State management
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null
  );

  // Ubah dari currentPembelian menjadi cartItems (lokal state)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchBarang, setSearchBarang] = useState<string>("");
  const [searchSupplier, setSearchSupplier] = useState<string>("");
  const [expandSupplierSearch, setExpandSupplierSearch] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [searchingSupplier, setSearchingSupplier] = useState(false);

  // Checkout state
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [diskonNota, setDiskonNota] = useState<string>("0");
  const [diskonNotaType, setDiskonNotaType] = useState<"rupiah" | "persen">(
    "rupiah"
  );
  const [jumlahDibayar, setJumlahDibayar] = useState<string>("");
  const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState<string>("");
  const [tanggalPembelian, setTanggalPembelian] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [keterangan, setKeterangan] = useState<string>("");

  // Diskon per item state
  const [itemDiskonTypes, setItemDiskonTypes] = useState<{
    [key: string]: "rupiah" | "persen";
  }>({});
  const [itemDiskonValues, setItemDiskonValues] = useState<{
    [key: string]: string;
  }>({});

  // Receipt state
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [editPembelianId, setEditPembelianId] = useState<number | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<boolean>(false);

  useEffect(() => {
    // Tidak fetch suppliers di awal, hanya saat user search
  }, []);

  useEffect(() => {
    const editIdParam = searchParams.get("editId");
    if (!editIdParam) {
      setEditPembelianId(null);
      return;
    }

    const parsedId = parseInt(editIdParam);
    if (Number.isNaN(parsedId)) {
      toast.error("ID pembelian tidak valid untuk edit");
      setEditPembelianId(null);
      return;
    }

    setEditPembelianId(parsedId);
  }, [searchParams]);

  useEffect(() => {
    if (editPembelianId) {
      loadPembelianForEdit(editPembelianId);
    }
  }, [editPembelianId]);

  // Debounce untuk search supplier
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchSupplier.trim().length >= 2) {
        searchSuppliersByName(searchSupplier);
      } else if (searchSupplier.trim().length === 0) {
        setSuppliersList([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchSupplier]);

  const searchSuppliersByName = async (keyword: string) => {
    setSearchingSupplier(true);
    try {
      const res = await fetch(
        `/api/supplier/search/${encodeURIComponent(keyword)}`
      );
      const data = await res.json();
      if (data.success) {
        setSuppliersList(data.data);
      }
    } catch (error) {
      console.error("Error searching suppliers:", error);
      toast.error("Gagal mencari supplier");
    } finally {
      setSearchingSupplier(false);
    }
  };

  const fetchBarangBySupplier = async (supplierId: number) => {
    try {
      const res = await fetch("/api/barang");
      const data = await res.json();
      if (data.success) {
        let filtered = data.data.filter(
          (b: Barang) => b.supplierId === supplierId
        );
        setBarangList(filtered);
      }
    } catch (error) {
      console.error("Error fetching barang:", error);
      toast.error("Gagal mengambil data barang");
    }
  };

  const loadPembelianForEdit = async (pembelianId: number) => {
    setLoadingEdit(true);
    try {
      const res = await fetch(`/api/pembelian/${pembelianId}`);
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || "Gagal mengambil data pembelian");
        return;
      }

      const pembelian = data.data;
      if (pembelian.statusTransaksi !== "SELESAI") {
        toast.error("Hanya pembelian selesai yang bisa diedit");
        setEditPembelianId(null);
        router.replace("/dashboard/admin/pembelian");
        return;
      }

      if (pembelian.supplier) {
        setSelectedSupplier(pembelian.supplier);
        setSearchSupplier("");
        setExpandSupplierSearch(false);
        await fetchBarangBySupplier(pembelian.supplier.id);
      }

      const newCartItems: CartItem[] = pembelian.items.map((item: any) => {
        const jumlahPerKemasan = Number(item.barang?.jumlahPerKemasan) || 0;
        const derivedJumlahDus =
          jumlahPerKemasan > 0
            ? Math.floor(Number(item.totalItem || 0) / jumlahPerKemasan)
            : 0;

        return {
        tempId: `item-${item.id}`,
        itemId: item.id,
        barangId: item.barangId,
        jumlahDus:
          item.jumlahDus !== undefined ? Number(item.jumlahDus) : derivedJumlahDus,
        hargaPokok: Number(item.hargaPokok),
        diskonPerItem: Number(item.diskonPerItem),
        barang: item.barang,
        };
      });

      const diskonTypes: { [key: string]: "rupiah" | "persen" } = {};
      const diskonValues: { [key: string]: string } = {};

      newCartItems.forEach((item) => {
        diskonTypes[item.tempId] = "rupiah";
        diskonValues[item.tempId] = Number(
          item.diskonPerItem
        ).toLocaleString("id-ID");
      });

      setCartItems(newCartItems);
      setItemDiskonTypes(diskonTypes);
      setItemDiskonValues(diskonValues);
      setDiskonNotaType("rupiah");
      setDiskonNota(Number(pembelian.diskonNota).toLocaleString("id-ID"));
      setJumlahDibayar(
        Number(pembelian.jumlahDibayar).toLocaleString("id-ID")
      );
      setTanggalJatuhTempo(
        pembelian.tanggalJatuhTempo
          ? new Date(pembelian.tanggalJatuhTempo).toISOString().split("T")[0]
          : ""
      );
      setTanggalPembelian(
        pembelian.createdAt
          ? new Date(pembelian.createdAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setKeterangan(pembelian.keterangan || "");
    } catch (error) {
      console.error("Error loading pembelian:", error);
      toast.error("Gagal memuat data pembelian");
    } finally {
      setLoadingEdit(false);
    }
  };

  // Pilih Supplier
  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierDropdown(false);
    setSearchSupplier("");
    setExpandSupplierSearch(false);
    fetchBarangBySupplier(supplier.id);
    toast.success(`Supplier dipilih: ${supplier.namaSupplier}`);
  };

  // Fungsi untuk menambahkan item ke keranjang lokal
  const handleQuickAddItem = (barang: Barang) => {
    const existingItem = cartItems.find((item) => item.barangId === barang.id);

    if (existingItem) {
      // Update jumlah dus jika item sudah ada
      setCartItems((prevItems) =>
        prevItems.map((item) =>
          item.tempId === existingItem.tempId
            ? { ...item, jumlahDus: item.jumlahDus + 1 }
            : item
        )
      );
      toast.success(`${barang.namaBarang} +1 dus`);
      return;
    }

    // Tambah item baru ke keranjang
    const newItem: CartItem = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      barangId: barang.id,
      jumlahDus: 1,
      hargaPokok: barang.hargaBeli,
      diskonPerItem: 0,
      barang: barang,
    };

    setCartItems((prev) => [...prev, newItem]);

    // Initialize diskon state untuk item baru
    setItemDiskonTypes((prev) => ({ ...prev, [newItem.tempId]: "rupiah" }));
    setItemDiskonValues((prev) => ({ ...prev, [newItem.tempId]: "0" }));

    toast.success(`${barang.namaBarang} ditambahkan ke keranjang`);
  };

  // Update item di keranjang lokal
  const handleUpdateItem = (tempId: string, field: string, value: number) => {
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.tempId === tempId ? { ...item, [field]: value } : item
      )
    );
  };

  // Handle perubahan diskon item dengan tipe
  const handleItemDiskonChange = (
    item: CartItem,
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

    setItemDiskonValues((prev) => ({ ...prev, [item.tempId]: displayValue }));

    // Update diskonPerItem di cart
    setCartItems((prevItems) =>
      prevItems.map((cartItem) =>
        cartItem.tempId === item.tempId
          ? { ...cartItem, diskonPerItem: diskonRupiah }
          : cartItem
      )
    );
  };

  // Toggle tipe diskon item
  const toggleItemDiskonType = (item: CartItem) => {
    const currentType = itemDiskonTypes[item.tempId] || "rupiah";
    const newType = currentType === "rupiah" ? "persen" : "rupiah";

    setItemDiskonTypes((prev) => ({ ...prev, [item.tempId]: newType }));

    if (newType === "persen") {
      const persen =
        item.hargaPokok > 0
          ? Math.round((item.diskonPerItem / item.hargaPokok) * 100)
          : 0;
      setItemDiskonValues((prev) => ({
        ...prev,
        [item.tempId]: persen.toString(),
      }));
    } else {
      setItemDiskonValues((prev) => ({
        ...prev,
        [item.tempId]:
          item.diskonPerItem === 0
            ? "0"
            : item.diskonPerItem.toLocaleString("id-ID"),
      }));
    }
  };

  // Fungsi untuk mendapatkan display value diskon item
  const getItemDiskonDisplayValue = (item: CartItem): string => {
    const type = itemDiskonTypes[item.tempId] || "rupiah";
    const storedValue = itemDiskonValues[item.tempId];

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

  const handleDeleteItem = (tempId: string) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.tempId !== tempId)
    );

    // Hapus juga diskon state
    setItemDiskonTypes((prev) => {
      const newTypes = { ...prev };
      delete newTypes[tempId];
      return newTypes;
    });
    setItemDiskonValues((prev) => {
      const newValues = { ...prev };
      delete newValues[tempId];
      return newValues;
    });

    toast.success("Item berhasil dihapus");
  };

  // Kalkulasi lokal untuk cart
  const calculateCartSummary = () => {
    let subtotal = 0;
    let totalDiskonItem = 0;

    cartItems.forEach((item) => {
      const hargaTotal = item.hargaPokok * item.jumlahDus;
      const diskon = item.diskonPerItem * item.jumlahDus;

      subtotal += hargaTotal;
      totalDiskonItem += diskon;
    });

    return {
      subtotal,
      totalDiskonItem,
    };
  };

  // Hitung diskon nota dalam rupiah
  const calculateDiskonNotaRupiah = (): number => {
    const { subtotal, totalDiskonItem } = calculateCartSummary();
    const subtotalAfterItemDiskon = subtotal - totalDiskonItem;

    if (diskonNotaType === "persen") {
      const persen = parseInt(diskonNota) || 0;
      return Math.round((subtotalAfterItemDiskon * persen) / 100);
    } else {
      return parseRupiahToNumber(diskonNota);
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

    const { subtotal, totalDiskonItem } = calculateCartSummary();
    const subtotalAfterItemDiskon = subtotal - totalDiskonItem;

    if (newType === "persen") {
      const currentRupiah = parseRupiahToNumber(diskonNota);
      const persen =
        subtotalAfterItemDiskon > 0
          ? Math.round((currentRupiah / subtotalAfterItemDiskon) * 100)
          : 0;
      setDiskonNota(persen.toString());
    } else {
      const currentPersen = parseInt(diskonNota) || 0;
      const rupiah = Math.round(
        (subtotalAfterItemDiskon * currentPersen) / 100
      );
      setDiskonNota(rupiah === 0 ? "0" : rupiah.toLocaleString("id-ID"));
    }
  };

  // Hitung total dengan diskon nota yang baru
  const cartSummary = calculateCartSummary();
  const calculatedTotal =
    cartSummary.subtotal -
    cartSummary.totalDiskonItem -
    calculateDiskonNotaRupiah();

  const handleOpenCheckoutModal = async () => {
    if (cartItems.length === 0) {
      toast.error("Item dibeli masih kosong");
      return;
    }

    if (!selectedSupplier) {
      toast.error("Supplier wajib dipilih");
      return;
    }

    // Set default tanggal jatuh tempo 30 hari dari sekarang
    const today = new Date();
    const defaultDueDate = new Date(today);
    defaultDueDate.setDate(today.getDate() + 30);
    setTanggalJatuhTempo(defaultDueDate.toISOString().split("T")[0]);

    setShowCheckoutModal(true);
  };

  // Checkout
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      toast.error("Item dibeli masih kosong");
      return;
    }

    if (!jumlahDibayar) {
      toast.error("Jumlah pembayaran wajib diisi");
      return;
    }

    if (!selectedSupplier) {
      toast.error("Supplier wajib dipilih");
      return;
    }

    const diskonNotaRupiah = calculateDiskonNotaRupiah();

    setLoading(true);
    try {
      if (editPembelianId) {
        const updatePayload: any = {
          items: cartItems.map((item) => ({
            id: item.itemId,
            barangId: item.barangId,
            jumlahDus: item.jumlahDus,
            totalItem: item.jumlahDus * item.barang.jumlahPerKemasan,
            hargaPokok: item.hargaPokok,
            diskonPerItem: item.diskonPerItem,
          })),
          supplierId: selectedSupplier?.id,
          diskonNota: diskonNotaRupiah,
          jumlahDibayar: parseRupiahToNumber(jumlahDibayar),
          tanggalJatuhTempo: tanggalJatuhTempo || undefined,
          keterangan: keterangan || undefined,
        };

        const updateRes = await fetch(
          `/api/pembelian/${editPembelianId}/edit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatePayload),
          }
        );
        const updateResult = await updateRes.json();

        if (updateResult.success) {
          setReceiptData({
            ...updateResult.data.receipt,
            id: editPembelianId,
          });
          setShowCheckoutModal(false);
          setShowReceiptModal(true);
          toast.success(updateResult.message || "Pembelian berhasil diupdate");
        } else {
          toast.error(updateResult.error || "Gagal update pembelian");
        }

        return;
      }

      // Step 1: Create pembelian header
      const createData: any = {
        supplierId: selectedSupplier.id,
      };

      const createRes = await fetch("/api/pembelian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createData),
      });
      const createResult = await createRes.json();

      if (!createResult.success) {
        toast.error(createResult.error || "Gagal membuat pembelian");
        return;
      }

      const pembelianId = createResult.data.id;

      // Step 2: Add items to pembelian
      for (const item of cartItems) {
        const itemData = {
          barangId: item.barangId,
          jumlahDus: item.jumlahDus,
          totalItem: item.jumlahDus * item.barang.jumlahPerKemasan,
          hargaPokok: item.hargaPokok,
          diskonPerItem: item.diskonPerItem,
        };

        const itemRes = await fetch(`/api/pembelian/${pembelianId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemData),
        });
        const itemResult = await itemRes.json();

        if (!itemResult.success) {
          toast.error(`Gagal menambah ${item.barang.namaBarang}`);
          return;
        }
      }

      // Step 3: Checkout
      const checkoutData: any = {
        diskonNota: diskonNotaRupiah,
        jumlahDibayar: parseRupiahToNumber(jumlahDibayar),
        tanggalPembelian: tanggalPembelian,
      };

      if (keterangan.trim()) {
        checkoutData.keterangan = keterangan;
      }

      if (tanggalJatuhTempo) {
        checkoutData.tanggalJatuhTempo = tanggalJatuhTempo;
      }

      const res = await fetch(`/api/pembelian/${pembelianId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutData),
      });
      const data = await res.json();

      if (data.success) {
        setReceiptData(data.data.receipt);
        setShowCheckoutModal(false);
        setShowReceiptModal(true);
        toast.success(data.message);
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

  const handleReset = () => {
    setSelectedSupplier(null);
    setCartItems([]);
    setBarangList([]);
    setDiskonNota("0");
    setDiskonNotaType("rupiah");
    setJumlahDibayar("");
    setTanggalJatuhTempo("");
    setTanggalPembelian(new Date().toISOString().split("T")[0]);
    setKeterangan("");
    setItemDiskonTypes({});
    setItemDiskonValues({});
    setSearchBarang("");
    setSearchSupplier("");
    setExpandSupplierSearch(false);
    toast.success("Transaksi direset");
    if (editPembelianId) {
      setEditPembelianId(null);
      router.replace("/dashboard/admin/pembelian");
    }
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

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

      if (!selectedSupplier) {
        return {
          status: "HUTANG",
          kembalian: 0,
          sisaHutang,
          canCheckout: false,
          message: "Supplier belum dipilih",
        };
      }

      const sisaLimit = Math.max(
        0,
        selectedSupplier.limitHutang - selectedSupplier.hutang
      );
      if (selectedSupplier.limitHutang > 0 && sisaHutang > sisaLimit) {
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

  const filteredBarang = barangList.filter((b) =>
    b.namaBarang.toLowerCase().includes(searchBarang.toLowerCase())
  );

  return (
    <div className="w-full min-h-[calc(100vh-6rem)] max-h-[calc(100vh-6rem)] overflow-x-hidden overflow-y-auto flex flex-col bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100">
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
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 rounded-xl p-5 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-lg shadow-lg">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Pembelian Barang
                </h1>
                <p className="text-emerald-100 text-sm">
                  Kelola transaksi pembelian dari supplier
                </p>
                {editPembelianId && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-2 bg-yellow-400/90 text-slate-900 text-xs font-bold px-2.5 py-1 rounded-full">
                      Mode Edit • #{editPembelianId}
                      {loadingEdit && (
                        <span className="inline-block h-2 w-2 rounded-full bg-slate-900 animate-pulse" />
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard/admin/pembelian/riwayat"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
              >
                <Receipt className="w-4 h-4" />
                Riwayat
              </Link>
              <button
                onClick={handleReset}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Transaksi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        <div className="h-full min-h-0 flex gap-3">
          {/* Left Side - 68% */}
          <div className="w-[68%] flex flex-col gap-3 h-full min-h-0">
            {/* Supplier Selection */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-2">
              <label className="text-xs font-extrabold text-gray-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                <div className="bg-emerald-100 p-1.5 rounded-lg">
                  <Store className="w-4 h-4 text-emerald-600" />
                </div>
                <span>
                  Supplier <span className="text-red-500">*</span>
                </span>
              </label>

              {selectedSupplier ? (
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-3 rounded-lg shadow-md text-white border border-emerald-400 relative overflow-hidden group hover:shadow-lg transition-all">
                  <div className="relative flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate mb-1">
                        {selectedSupplier.namaSupplier}
                      </p>
                      <div className="flex items-center gap-2.5 text-xs text-emerald-50">
                        <span className="truncate flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          {selectedSupplier.alamat.length > 25
                            ? selectedSupplier.alamat.substring(0, 25) + "..."
                            : selectedSupplier.alamat}
                        </span>
                        <span className="text-emerald-300">•</span>
                        <span className="truncate flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          {selectedSupplier.noHp}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedSupplier(null);
                        setBarangList([]);
                        setCartItems([]);
                        setSearchSupplier("");
                        setExpandSupplierSearch(false);
                      }}
                      className="text-white hover:bg-white/20 p-1.5 rounded transition-all shrink-0 hover:scale-110 active:scale-95"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Tampilkan placeholder jika belum expand search */}
                  {!expandSupplierSearch && (
                    <button
                      onClick={() => setExpandSupplierSearch(true)}
                      className="w-full text-center py-3 px-4 bg-gray-50 hover:bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 hover:border-emerald-100 transition-all duration-200 group"
                    >
                      <p className="text-sm text-gray-600 group-hover:text-emerald-100 font-semibold flex items-center justify-center gap-2 transition-colors">
                        <Search className="w-4 h-4" />
                        Cari supplier untuk memulai
                      </p>
                    </button>
                  )}

                  {expandSupplierSearch && (
                    <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 z-10" />
                      <input
                        type="text"
                        placeholder="Ketik nama supplier..."
                        value={searchSupplier}
                        onChange={(e) => {
                          setSearchSupplier(e.target.value);
                          setShowSupplierDropdown(true);
                        }}
                        className="w-full pl-10 pr-4 py-2.5 border-2 border-emerald-300 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-medium shadow-sm transition-all duration-200"
                        autoFocus
                      />

                      {showSupplierDropdown && searchSupplier.length >= 2 && (
                        <div className="absolute z-50 mt-2 w-full bg-white border-2 border-emerald-300 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                          {searchingSupplier ? (
                            <div className="p-6 text-center">
                              <div className="animate-spin w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3" />
                              <p className="text-sm text-gray-600 font-medium">
                                Mencari supplier...
                              </p>
                            </div>
                          ) : suppliersList.length > 0 ? (
                            suppliersList.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => handleSelectSupplier(s)}
                                className="w-full p-3 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-emerald-100 border-b last:border-b-0 transition-all duration-200 text-left group"
                              >
                                <p className="font-bold text-sm text-gray-900 group-hover:text-emerald-700 flex items-center gap-2">
                                  <Store className="w-3.5 h-3.5" />
                                  {s.namaSupplier}
                                </p>
                                <p className="text-xs text-gray-600 ml-5 mt-0.5">
                                  {s.alamat} • {s.noHp}
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

                  <button
                    onClick={() =>
                      setExpandSupplierSearch(!expandSupplierSearch)
                    }
                    className="w-full bg-white hover:bg-gray-50 text-emerald-700 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border-2 border-emerald-400 hover:border-emerald-500 hover:shadow-md active:scale-98"
                  >
                    <Search className="w-4 h-4" />
                    {expandSupplierSearch ? "Tutup" : "Cari Supplier"}
                  </button>
                </div>
              )}
            </div>

            {/* Daftar Barang */}
            <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
              <div className="p-4 border-b bg-white flex-shrink-0">
                <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="bg-emerald-600 p-1.5 rounded-lg shadow-md">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  Daftar Produk
                  <span className="ml-auto text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-full font-bold">
                    {filteredBarang.length} produk
                  </span>
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 z-10" />
                  <input
                    type="text"
                    placeholder="Cari produk..."
                    value={searchBarang}
                    onChange={(e) => setSearchBarang(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-medium shadow-sm transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-white">
                {!selectedSupplier ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="bg-gray-100 p-6 rounded-full mb-4 mx-auto w-fit">
                        <Store className="w-16 h-16 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-bold text-lg mb-1">
                        Pilih Supplier Terlebih Dahulu
                      </p>
                      <p className="text-gray-500 text-sm">
                        Cari dan pilih supplier untuk melihat produk
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredBarang.map((barang) => {
                      const isInCart = cartItems.some(
                        (item) => item.barangId === barang.id
                      );

                      return (
                        <div
                          key={barang.id}
                          className="group relative overflow-hidden rounded-2xl border-2 border-gray-200 bg-white hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-100/50 transition-all duration-300 transform hover:scale-[1.02]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                          {isInCart && (
                            <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg z-10 animate-in fade-in zoom-in duration-300">
                              <ShoppingCart className="w-2.5 h-2.5" />
                              Di Item Dibeli
                            </div>
                          )}

                          <div className="relative flex items-center justify-between p-3">
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-start gap-1.5 mb-1.5">
                                <div className="bg-emerald-100 p-1 rounded-lg mt-0.5 group-hover:bg-emerald-200 transition-colors">
                                  <Package className="w-3 h-3 text-emerald-600" />
                                </div>
                                <h4 className="font-extrabold text-gray-900 text-xs leading-tight group-hover:text-emerald-700 transition-colors">
                                  {barang.namaBarang}
                                </h4>
                              </div>

                              <div className="ml-6 space-y-1">
                                <p className="text-[10px] text-gray-600 font-semibold flex items-center gap-1">
                                  <span className="bg-gray-200 px-1.5 py-0.5 rounded-md">
                                    {formatGramsToKg(barang.berat)} KG
                                  </span>
                                  <span className="text-gray-400">•</span>
                                  <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md">
                                    {barang.jumlahPerKemasan}/
                                    {barang.jenisKemasan}
                                  </span>
                                </p>

                                <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-2 py-0.5 rounded-lg shadow-md group-hover:shadow-lg transition-shadow inline-block">
                                  <p className="text-[11px] font-extrabold">
                                    {formatRupiah(barang.hargaBeli)}
                                    <span className="text-[9px] font-medium opacity-90 ml-0.5">
                                      /{barang.jenisKemasan}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex-shrink-0">
                              <button
                                onClick={() => handleQuickAddItem(barang)}
                                disabled={loading}
                                className="relative overflow-hidden p-2 rounded-xl transition-all duration-300 transform bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg hover:shadow-xl active:scale-95 group-hover:scale-110"
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

                                <Plus
                                  className="w-6 h-6 relative z-10 text-white"
                                  strokeWidth={3}
                                />

                                <div className="absolute inset-0 rounded-xl overflow-hidden">
                                  <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-500 rounded-full"></div>
                                </div>
                              </button>
                            </div>
                          </div>

                          <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        </div>
                      );
                    })}

                    {filteredBarang.length === 0 && selectedSupplier && (
                      <div className="col-span-2 py-12 text-center">
                        <div className="bg-gray-100 p-6 rounded-full mb-4 mx-auto w-fit">
                          <Package className="w-16 h-16 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-bold text-lg mb-1">
                          Produk Tidak Ditemukan
                        </p>
                        <p className="text-gray-500 text-sm">
                          Coba gunakan kata kunci lain
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - 32% Item Dibeli */}
          <div className="w-[32%] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
            <div className="p-4 bg-gray-50 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-sm font-bold text-gray-700">
                    Item Dibeli
                  </h2>
                </div>
                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-md font-bold">
                  {cartItems.length} item
                </span>
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-3 min-h-0 bg-gray-50">
              {cartItems.length > 0 ? (
                <div className="space-y-2">
                  {cartItems.map((item) => (
                    <div
                      key={item.tempId}
                      className="border border-gray-200 rounded-lg p-3 bg-white"
                    >
                      {/* Item Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-extrabold text-gray-900 text-sm truncate mb-1">
                            {item.barang.namaBarang}
                          </h4>
                          <p className="text-xs text-gray-600 font-semibold truncate bg-gray-100 px-2 py-0.5 rounded-md inline-block">
                            {formatRupiah(item.hargaPokok)}/dus
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.tempId)}
                          className="text-red-500 hover:bg-red-100 p-1.5 rounded-lg transition-all flex-shrink-0 ml-2 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quantity Controls */}
                      <div className="space-y-2">
                        {/* Dus */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-2 rounded-xl">
                          <span className="text-xs font-bold text-gray-700 uppercase">
                            Dus:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() =>
                                handleUpdateItem(
                                  item.tempId,
                                  "jumlahDus",
                                  Math.max(1, item.jumlahDus - 1)
                                )
                              }
                              className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                            >
                              <Minus className="w-3.5 h-3.5" strokeWidth={3} />
                            </button>
                            <input
                              type="number"
                              value={item.jumlahDus}
                              onChange={(e) =>
                                handleUpdateItem(
                                  item.tempId,
                                  "jumlahDus",
                                  Math.max(1, parseInt(e.target.value) || 1)
                                )
                              }
                              onWheel={(e) =>
                                (e.target as HTMLInputElement).blur()
                              }
                              className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                              min="1"
                            />
                            <button
                              onClick={() =>
                                handleUpdateItem(
                                  item.tempId,
                                  "jumlahDus",
                                  item.jumlahDus + 1
                                )
                              }
                              className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                            </button>
                          </div>
                        </div>

                        {/* Diskon */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-yellow-50 to-amber-50 p-2.5 rounded-xl border-2 border-yellow-200">
                          <span className="text-xs font-bold text-gray-700 uppercase">
                            Diskon:
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleItemDiskonType(item)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-md transition-all hover:scale-105 active:scale-95 ${
                                (itemDiskonTypes[item.tempId] || "rupiah") ===
                                "rupiah"
                                  ? "bg-green-500 text-white"
                                  : "bg-purple-500 text-white"
                              }`}
                            >
                              {(itemDiskonTypes[item.tempId] || "rupiah") ===
                              "rupiah"
                                ? "Rp"
                                : "%"}
                            </button>
                            <input
                              type="text"
                              value={getItemDiskonDisplayValue(item)}
                              onChange={(e) =>
                                handleItemDiskonChange(
                                  item,
                                  e.target.value,
                                  itemDiskonTypes[item.tempId] || "rupiah"
                                )
                              }
                              className="w-20 text-right text-xs border-2 border-yellow-300 rounded-lg px-2 py-1 font-bold bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div className="flex items-center justify-between pt-2.5 border-t-2 border-emerald-300 mt-2.5 bg-emerald-50 -mx-3 -mb-3 px-3 py-2.5 rounded-b-lg">
                        <span className="text-sm font-extrabold text-gray-800 uppercase">
                          Total:
                        </span>
                        <p className="font-extrabold text-emerald-600 text-base">
                          {formatRupiah(
                            item.hargaPokok * item.jumlahDus -
                              item.diskonPerItem * item.jumlahDus
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="bg-gray-100 p-4 rounded-full mb-3 mx-auto w-fit">
                      <ShoppingCart className="w-12 h-12 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">
                      Item dibeli masih kosong
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      Tambahkan produk untuk memulai
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Summary & Checkout */}
            {cartItems.length > 0 && (
              <div className="border-t border-gray-200 bg-white p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-bold text-gray-900">
                      {formatRupiah(cartSummary.subtotal)}
                    </span>
                  </div>

                  {cartSummary.totalDiskonItem > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Diskon Item</span>
                      <span className="font-bold">
                        -{formatRupiah(cartSummary.totalDiskonItem)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2">
                    <span className="text-gray-700 font-medium">
                      Diskon Nota
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleDiskonNotaType}
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          diskonNotaType === "rupiah"
                            ? "bg-green-500 text-white"
                            : "bg-purple-500 text-white"
                        }`}
                      >
                        {diskonNotaType === "rupiah" ? "Rp" : "%"}
                      </button>
                      <input
                        type="text"
                        value={diskonNota}
                        onChange={(e) => handleDiskonNotaChange(e.target.value)}
                        className="w-16 text-right border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center font-bold text-base border-t-2 border-gray-200 pt-2 mt-2">
                    <span className="text-gray-900">TOTAL</span>
                    <span className="text-emerald-600 text-lg">
                      {formatRupiah(Math.max(0, calculatedTotal))}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleOpenCheckoutModal}
                  disabled={
                    loading || cartItems.length === 0 || !selectedSupplier
                  }
                  className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-98"
                >
                  <CreditCard className="w-5 h-5" />
                  {loading
                    ? "Memproses..."
                    : editPembelianId
                    ? "Simpan Perubahan"
                    : "Proses Pembayaran"}
                </button>

                {/* Peringatan jika supplier belum dipilih */}
                {cartItems.length > 0 && !selectedSupplier && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-700">
                      Pilih supplier terlebih dahulu untuk melanjutkan
                      pembayaran
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Checkout */}
      {showCheckoutModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCheckoutModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 p-5 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-lg">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  Konfirmasi Pembayaran
                </h2>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-white hover:bg-white/10 p-2 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {/* Info Supplier */}
              <div className="bg-white rounded-xl p-4 mb-4 border-2 border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
                      <Store className="w-3.5 h-3.5" />
                      Supplier
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedSupplier?.namaSupplier || "-"}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
                      <Phone className="w-3.5 h-3.5" />
                      Telepon
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedSupplier?.noHp || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ringkasan Transaksi */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="w-4 h-4 text-gray-700" />
                  <h3 className="font-bold text-gray-900 uppercase text-xs tracking-wider">
                    Ringkasan Transaksi
                  </h3>
                </div>
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">
                      {formatRupiah(cartSummary.subtotal)}
                    </span>
                  </div>
                  {cartSummary.totalDiskonItem > 0 && (
                    <div className="flex justify-between text-sm mb-2 text-red-600">
                      <span>Diskon Item</span>
                      <span className="font-semibold">
                        -{formatRupiah(cartSummary.totalDiskonItem)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-gray-600">Diskon Nota</span>
                    <span className="font-semibold">
                      -{formatRupiah(calculateDiskonNotaRupiah())}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-3 border-t-2 border-gray-200">
                    <span className="text-gray-900">Total Bayar</span>
                    <span className="text-emerald-600">
                      {formatRupiah(Math.max(0, calculatedTotal))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tanggal Pembelian */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-700" />
                  <label className="font-bold text-gray-900 uppercase text-xs tracking-wider">
                    Tanggal Pembelian <span className="text-red-500">*</span>
                  </label>
                </div>
                <input
                  type="date"
                  value={tanggalPembelian}
                  onChange={(e) => setTanggalPembelian(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-sm"
                />
              </div>

              {/* Keterangan */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-gray-700" />
                  <label className="font-bold text-gray-900 uppercase text-xs tracking-wider">
                    Keterangan
                    <span className="text-gray-500 font-normal ml-1 normal-case">
                      (Opsional)
                    </span>
                  </label>
                </div>
                <textarea
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-sm resize-none"
                  placeholder="Catatan tambahan untuk pembelian ini..."
                  rows={2}
                />
              </div>

              {/* Payment Input */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-gray-700" />
                  <label className="font-bold text-gray-900 uppercase text-xs tracking-wider">
                    Jumlah Dibayar <span className="text-red-500">*</span>
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-emerald-600 font-semibold">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={jumlahDibayar}
                    onChange={(e) =>
                      setJumlahDibayar(formatRupiahInput(e.target.value))
                    }
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-base font-semibold"
                    placeholder="0"
                  />
                </div>
                {/* Quick Amount Buttons */}
                <div className="flex gap-2 flex-wrap mt-2">
                  <button
                    onClick={() =>
                      setJumlahDibayar(
                        Math.max(0, calculatedTotal).toLocaleString("id-ID")
                      )
                    }
                    className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-md text-xs font-semibold hover:bg-emerald-200 transition-colors"
                  >
                    Pas
                  </button>
                  {[50000, 100000, 500000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() =>
                        setJumlahDibayar(amount.toLocaleString("id-ID"))
                      }
                      className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-md text-xs font-semibold hover:bg-emerald-200 transition-colors"
                    >
                      {formatRupiah(amount)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Preview */}
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

              {/* Tanggal Jatuh Tempo - untuk Hutang */}
              {paymentStatus?.status === "HUTANG" &&
                paymentStatus.canCheckout && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-700" />
                      <label className="font-bold text-gray-900 uppercase text-xs tracking-wider">
                        Tanggal Jatuh Tempo
                        <span className="text-gray-500 font-normal ml-1 normal-case">
                          (Default 30 hari)
                        </span>
                      </label>
                    </div>
                    <input
                      type="date"
                      value={tanggalJatuhTempo}
                      onChange={(e) => setTanggalJatuhTempo(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-sm"
                    />
                  </div>
                )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 bg-white hover:bg-gray-100 text-gray-700 px-4 py-3 rounded-lg transition-all font-semibold border-2 border-gray-300"
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
                  className="flex-1 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white px-4 py-3 rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    "Memproses..."
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      {editPembelianId ? "Simpan Perubahan" : "Selesaikan Pembayaran"}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
                  handleReset();
                }}
                className="w-full mt-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-98"
              >
                <Plus className="w-5 h-5" strokeWidth={3} />
                Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PembelianPage;
