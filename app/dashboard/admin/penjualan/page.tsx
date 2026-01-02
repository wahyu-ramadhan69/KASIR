"use client";
import { useState, useEffect } from "react";
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
  Receipt,
  AlertCircle,
  Banknote,
  Building2,
  Calendar,
  Clock,
  UserPlus,
  AlertTriangle,
  RefreshCw,
  Phone,
  Users,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Customer {
  id: number;
  nik: string;
  nama: string;
  alamat: string;
  namaToko: string;
  noHp: string;
  limit_piutang: number;
  piutang: number;
}

interface CustomerHutangInfo {
  customerId: number;
  nama: string;
  namaToko: string;
  limit_piutang: number;
  piutang: number;
  sisaLimitHutang: number;
  jumlahTransaksiHutang: number;
}

interface Barang {
  id: number;
  namaBarang: string;
  hargaBeli: number;
  hargaJual: number;
  stok: number;
  jumlahPerKemasan: number;
  jenisKemasan: string;
  limitPenjualan: number;
  supplierId: number;
  berat: number;
}

// Local cart item (tidak perlu id karena belum di database)
interface CartItem {
  tempId: string; // temporary ID untuk tracking di UI
  itemId?: number;
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  hargaJual: number;
  diskonPerItem: number;
  barang: Barang;
}

interface PenjualanItem {
  id: number;
  barangId: number;
  jumlahDus?: number;
  jumlahPcs?: number;
  totalItem?: number;
  hargaJual: number;
  diskonPerItem: number;
  berat?: number;
  barang: Barang;
}

interface PembayaranPenjualan {
  nominal?: number;
  totalCash?: number;
  totalTransfer?: number;
  metode?: "CASH" | "TRANSFER" | "CASH_TRANSFER";
}

interface PenjualanHeader {
  id: number;
  kodePenjualan: string;
  customerId: number | null;
  namaCustomer: string | null;
  subtotal: number;
  diskonNota: number;
  totalHarga: number;
  jumlahDibayar: number;
  kembalian: number;
  metodePembayaran: "CASH" | "TRANSFER" | "CASH_TRANSFER";
  statusPembayaran: "LUNAS" | "HUTANG";
  statusTransaksi: "KERANJANG" | "SELESAI" | "DIBATALKAN";
  tanggalTransaksi: string;
  tanggalJatuhTempo: string;
  customer: Customer | null;
  items: PenjualanItem[];
  pembayaran?: PembayaranPenjualan[];
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

const formatRupiahInput = (value: string): string => {
  const number = value.replace(/[^\d]/g, "");
  if (!number) return "";
  return parseInt(number).toLocaleString("id-ID");
};

const parseRupiahToNumber = (value: string): number => {
  return parseInt(value.replace(/[^\d]/g, "")) || 0;
};

const formatGramsToKg = (grams: number): string => {
  if (!Number.isFinite(grams)) return "";
  const kg = grams / 1000;
  const formatted = kg.toFixed(3).replace(/\.?0+$/, "");
  return formatted.replace(".", ",");
};

const getTotalItemPcs = (item: CartItem): number => {
  return item.jumlahDus * item.barang.jumlahPerKemasan + item.jumlahPcs;
};

const deriveDusPcsFromTotal = (totalItem: number, jumlahPerKemasan: number) => {
  const safePerKemasan = Math.max(1, jumlahPerKemasan);
  const jumlahDus = Math.floor(totalItem / safePerKemasan);
  const jumlahPcs = totalItem % safePerKemasan;
  return { jumlahDus, jumlahPcs };
};

const calculateBeratGramsFromBarang = (
  barang: Barang,
  totalPcs: number
): number => {
  const beratPerItem = Number(barang.berat || 0);
  if (beratPerItem <= 0 || totalPcs <= 0) return 0;
  return beratPerItem * totalPcs;
};

const formatMetodePembayaranLabel = (
  metode: "CASH" | "TRANSFER" | "CASH_TRANSFER"
) => {
  return metode === "CASH_TRANSFER" ? "CASH + TRANSFER" : metode;
};

const PenjualanPage = ({ isAdmin = false, userId }: Props) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);

  // Ubah dari currentPenjualan menjadi cartItems (lokal state)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchBarang, setSearchBarang] = useState<string>("");
  const [searchCustomer, setSearchCustomer] = useState<string>("");

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [customerHutangInfo, setCustomerHutangInfo] =
    useState<CustomerHutangInfo | null>(null);
  const [loadingHutangInfo, setLoadingHutangInfo] = useState<boolean>(false);
  const [manualCustomerName, setManualCustomerName] = useState<string>("");
  const [useManualCustomer, setUseManualCustomer] = useState<boolean>(false);
  const [expandCustomerSearch, setExpandCustomerSearch] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [todaySales, setTodaySales] = useState<{ [barangId: number]: number }>(
    {}
  );

  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [diskonNota, setDiskonNota] = useState<string>("0");
  const [diskonNotaType, setDiskonNotaType] = useState<"rupiah" | "persen">(
    "rupiah"
  );
  const [jumlahDibayar, setJumlahDibayar] = useState<string>("");
  const [jumlahCash, setJumlahCash] = useState<string>("");
  const [jumlahTransfer, setJumlahTransfer] = useState<string>("");
  const [metodePembayaran, setMetodePembayaran] = useState<
    "CASH" | "TRANSFER" | "CASH_TRANSFER"
  >("CASH");
  const [tanggalTransaksi, setTanggalTransaksi] = useState<string>("");
  const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState<string>("");

  const [itemDiskonTypes, setItemDiskonTypes] = useState<{
    [key: string]: "rupiah" | "persen";
  }>({});
  const [itemDiskonValues, setItemDiskonValues] = useState<{
    [key: string]: string;
  }>({});
  const [itemHargaValues, setItemHargaValues] = useState<{
    [key: string]: string;
  }>({});

  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [editPenjualanId, setEditPenjualanId] = useState<number | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<boolean>(false);
  const [originalQtyByBarangId, setOriginalQtyByBarangId] = useState<{
    [key: number]: number;
  }>({});

  useEffect(() => {
    fetchBarang();
    fetchTodaySales();
    // Tidak fetch top customers secara otomatis
    const today = new Date().toISOString().split("T")[0];
    setTanggalTransaksi(today);
  }, []);

  useEffect(() => {
    const editIdParam = searchParams.get("editId");
    if (!editIdParam) {
      setEditPenjualanId(null);
      return;
    }

    const parsedId = parseInt(editIdParam);
    if (Number.isNaN(parsedId)) {
      toast.error("ID penjualan tidak valid untuk edit");
      setEditPenjualanId(null);
      return;
    }

    setEditPenjualanId(parsedId);
  }, [searchParams]);

  useEffect(() => {
    if (editPenjualanId) {
      loadPenjualanForEdit(editPenjualanId);
    } else {
      setOriginalQtyByBarangId({});
    }
  }, [editPenjualanId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchCustomer.trim().length >= 2) {
        searchCustomerByKeyword(searchCustomer);
      } else if (searchCustomer.trim().length === 0) {
        setCustomerList([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchCustomer]);

  const loadPenjualanForEdit = async (penjualanId: number) => {
    setLoadingEdit(true);
    try {
      const res = await fetch(`/api/penjualan/${penjualanId}`);
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || "Gagal mengambil data penjualan");
        return;
      }

      const penjualan: PenjualanHeader = data.data;
      if (penjualan.statusTransaksi !== "SELESAI") {
        toast.error("Hanya penjualan selesai yang bisa diedit");
        setEditPenjualanId(null);
        router.replace("/dashboard/admin/penjualan");
        return;
      }

      const originalQtyMap: { [key: number]: number } = {};
      const newCartItems: CartItem[] = penjualan.items.map((item) => {
        const jumlahPerKemasan = Number(item.barang?.jumlahPerKemasan || 1);
        const fallbackTotalItem =
          item.totalItem !== undefined && item.totalItem !== null
            ? Number(item.totalItem || 0)
            : Number(item.jumlahDus || 0) * jumlahPerKemasan +
              Number(item.jumlahPcs || 0);
        const derived = deriveDusPcsFromTotal(
          fallbackTotalItem,
          jumlahPerKemasan
        );
        const useSingleItemMode = jumlahPerKemasan <= 1;
        const jumlahDus = useSingleItemMode
          ? 0
          : item.jumlahDus !== undefined
          ? Number(item.jumlahDus)
          : derived.jumlahDus;
        const jumlahPcs = useSingleItemMode
          ? fallbackTotalItem
          : item.jumlahPcs !== undefined
          ? Number(item.jumlahPcs)
          : derived.jumlahPcs;

        originalQtyMap[item.barangId] =
          (originalQtyMap[item.barangId] || 0) + fallbackTotalItem;

        return {
          tempId: `item-${item.id}`,
          itemId: item.id,
          barangId: item.barangId,
          jumlahDus,
          jumlahPcs,
          hargaJual: Number(item.hargaJual),
          diskonPerItem: Number(item.diskonPerItem),
          barang: item.barang,
        };
      });

      const diskonTypes: { [key: string]: "rupiah" | "persen" } = {};
      const diskonValues: { [key: string]: string } = {};
      const hargaValues: { [key: string]: string } = {};
      newCartItems.forEach((item) => {
        diskonTypes[item.tempId] = "rupiah";
        diskonValues[item.tempId] = Number(item.diskonPerItem).toLocaleString(
          "id-ID"
        );
        hargaValues[item.tempId] = Number(item.hargaJual).toLocaleString(
          "id-ID"
        );
      });

      setCartItems(newCartItems);
      setItemDiskonTypes(diskonTypes);
      setItemDiskonValues(diskonValues);
      setItemHargaValues(hargaValues);
      setOriginalQtyByBarangId(originalQtyMap);

      if (penjualan.customer) {
        setSelectedCustomer(penjualan.customer);
        setManualCustomerName("");
        setUseManualCustomer(false);
        fetchCustomerHutangInfo(penjualan.customer.id);
      } else {
        setSelectedCustomer(null);
        setManualCustomerName(penjualan.namaCustomer || "");
        setUseManualCustomer(true);
      }

      setDiskonNotaType("rupiah");
      const penjualanMetode = penjualan.metodePembayaran;
      const latestPembayaran = penjualan.pembayaran?.[0];
      const latestCash = Number(latestPembayaran?.totalCash || 0);
      const latestTransfer = Number(latestPembayaran?.totalTransfer || 0);
      const penjualanDibayar = Number(penjualan.jumlahDibayar).toLocaleString(
        "id-ID"
      );
      setDiskonNota(Number(penjualan.diskonNota).toLocaleString("id-ID"));
      setJumlahDibayar(penjualanDibayar);
      setMetodePembayaran(penjualanMetode);
      if (penjualanMetode === "CASH_TRANSFER") {
        if (latestCash > 0 || latestTransfer > 0) {
          setJumlahCash(latestCash.toLocaleString("id-ID"));
          setJumlahTransfer(latestTransfer.toLocaleString("id-ID"));
        } else {
          setJumlahCash(penjualanDibayar);
          setJumlahTransfer("");
        }
      } else {
        setJumlahCash("");
        setJumlahTransfer("");
      }

      const transaksiDate = penjualan.tanggalTransaksi
        ? new Date(penjualan.tanggalTransaksi).toISOString().split("T")[0]
        : "";
      setTanggalTransaksi(transaksiDate);

      const jatuhTempoDate = penjualan.tanggalJatuhTempo
        ? new Date(penjualan.tanggalJatuhTempo).toISOString().split("T")[0]
        : "";
      setTanggalJatuhTempo(jatuhTempoDate);
    } catch (error) {
      console.error("Error loading penjualan:", error);
      toast.error("Gagal memuat data penjualan");
    } finally {
      setLoadingEdit(false);
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
      if (data.success && Array.isArray(data.data)) {
        const summary: { [barangId: number]: number } = {};
        data.data.forEach((item: any) => {
          summary[item.barangId] = Number(item.totalTerjual) || 0;
        });
        setTodaySales(summary);
      }
    } catch (error) {
      console.error("Error fetching penjualan harian:", error);
    }
  };

  const searchCustomerByKeyword = async (keyword: string) => {
    setSearchingCustomer(true);
    try {
      const res = await fetch(
        `/api/customer/search/${encodeURIComponent(keyword)}?limit=5`
      );
      const data = await res.json();
      if (data.success) {
        setCustomerList(data.data);
      }
    } catch (error) {
      console.error("Error searching customer:", error);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const fetchCustomerHutangInfo = async (customerId: number) => {
    setLoadingHutangInfo(true);
    try {
      const res = await fetch(`/api/customer/${customerId}/hutang-info`);
      const data = await res.json();
      if (data.success) {
        setCustomerHutangInfo(data.data);
      } else {
        setCustomerHutangInfo(null);
      }
    } catch (error) {
      console.error("Error fetching customer hutang info:", error);
      setCustomerHutangInfo(null);
    } finally {
      setLoadingHutangInfo(false);
    }
  };

  const getTodaySold = (barangId: number): number => {
    return todaySales[barangId] || 0;
  };

  const getCartPcsForBarang = (barangId: number): number => {
    const cartItem = cartItems.find((item) => item.barangId === barangId);
    if (!cartItem) return 0;
    return getTotalItemPcs(cartItem);
  };

  // Fungsi untuk menambahkan item ke keranjang lokal
  const handleQuickAddItem = (barang: Barang) => {
    const jumlahPerKemasan = Number(barang.jumlahPerKemasan);
    const existingItem = cartItems.find((item) => item.barangId === barang.id);
    const inCartPcs = getCartPcsForBarang(barang.id);

    const originalQty = editPenjualanId
      ? originalQtyByBarangId[barang.id] || 0
      : 0;
    const stokTersedia = barang.stok + originalQty;
    // Validasi stok: cek sisa stok setelah dikurangi yang di keranjang
    const sisaStok = stokTersedia - inCartPcs;
    const addPcs = jumlahPerKemasan > 1 ? jumlahPerKemasan : 1;
    if (sisaStok < addPcs) {
      toast.error(
        `Stok tidak mencukupi! Stok tersedia: ${stokTersedia} pcs, sudah di item dijual: ${inCartPcs} pcs, sisa: ${sisaStok} pcs`
      );
      return;
    }

    const limitPenjualan = Number(barang.limitPenjualan || 0);
    const todaySold = getTodaySold(barang.id);
    const effectiveSold = Math.max(0, todaySold - originalQty);

    // Validasi limit penjualan (jika ada)
    if (limitPenjualan > 0) {
      const remainingLimit = limitPenjualan - effectiveSold - inCartPcs;
      if (remainingLimit <= 0) {
        toast.error(
          `Limit harian untuk ${barang.namaBarang} sudah tercapai (${limitPenjualan} pcs)`
        );
        return;
      }

      if (addPcs > remainingLimit) {
        toast.error(`Limit penjualan harian telah tercapai !`);
        return;
      }
    }

    if (existingItem) {
      // Update jumlah pcs/dus jika item sudah ada
      setCartItems((prevItems) =>
        prevItems.map((item) =>
          item.tempId === existingItem.tempId
            ? jumlahPerKemasan > 1
              ? { ...item, jumlahDus: item.jumlahDus + 1 }
              : { ...item, jumlahPcs: item.jumlahPcs + 1 }
            : item
        )
      );
      toast.success(
        `${barang.namaBarang} +1 ${jumlahPerKemasan > 1 ? "dus" : "pcs"}`
      );
      return;
    }

    // Tambah item baru ke keranjang
    const newItem: CartItem = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      barangId: barang.id,
      jumlahDus: jumlahPerKemasan > 1 ? 1 : 0,
      jumlahPcs: jumlahPerKemasan > 1 ? 0 : 1,
      hargaJual: barang.hargaJual,
      diskonPerItem: 0,
      barang: barang,
    };

    setCartItems((prev) => [...prev, newItem]);

    // Initialize diskon state untuk item baru
    setItemDiskonTypes((prev) => ({ ...prev, [newItem.tempId]: "rupiah" }));
    setItemDiskonValues((prev) => ({ ...prev, [newItem.tempId]: "0" }));
    setItemHargaValues((prev) => ({
      ...prev,
      [newItem.tempId]: formatRupiahInput(String(newItem.hargaJual)),
    }));
    toast.success(`${barang.namaBarang} ditambahkan ke item dijual`);
  };

  // Update item di keranjang lokal
  const handleUpdateItem = (tempId: string, field: string, value: number) => {
    let warningMessage: string | null = null;

    setCartItems((prevItems) => {
      const nextItems = prevItems.map((item) => {
        if (item.tempId !== tempId) return item;

        const updatedItem = { ...item, [field]: Math.max(0, value) };
        const limitPenjualan = Number(item.barang.limitPenjualan || 0);
        const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan);
        const totalPcs =
          updatedItem.jumlahDus * jumlahPerKemasan + updatedItem.jumlahPcs;
        const originalQty = editPenjualanId
          ? originalQtyByBarangId[item.barangId] || 0
          : 0;
        const stokTersedia = Math.max(
          0,
          Number(item.barang.stok || 0) + originalQty
        );
        const todaySold = getTodaySold(item.barangId);

        const allowedByLimit =
          limitPenjualan > 0
            ? Math.max(0, limitPenjualan - Math.max(0, todaySold - originalQty))
            : Number.POSITIVE_INFINITY;
        const maxAllowed = Math.min(stokTersedia, allowedByLimit);

        if (totalPcs > maxAllowed) {
          let clampedDus = updatedItem.jumlahDus;
          let clampedPcs = updatedItem.jumlahPcs;

          if (field === "jumlahDus") {
            const maxDus = Math.max(
              0,
              Math.floor((maxAllowed - clampedPcs) / jumlahPerKemasan)
            );
            clampedDus = Math.min(clampedDus, maxDus);
          } else if (field === "jumlahPcs") {
            const maxPcs = Math.max(
              0,
              maxAllowed - clampedDus * jumlahPerKemasan
            );
            clampedPcs = Math.min(clampedPcs, maxPcs);
          } else {
            clampedDus = Math.floor(maxAllowed / jumlahPerKemasan);
            clampedPcs = Math.floor(maxAllowed % jumlahPerKemasan);
          }
          const reasons = [];

          if (limitPenjualan > 0 && allowedByLimit <= stokTersedia) {
            reasons.push(
              `Sisa limit harian: ${allowedByLimit} pcs (limit ${limitPenjualan} pcs, terjual hari ini ${todaySold} pcs)`
            );
          }

          if (stokTersedia <= allowedByLimit) {
            reasons.push(`Sisa stok: ${stokTersedia} pcs`);
          }

          warningMessage =
            reasons.length > 0
              ? `Jumlah melebihi batas. ${reasons.join(" | ")}`
              : "Jumlah melebihi batas.";

          const clampedItem = {
            ...updatedItem,
            jumlahDus: clampedDus,
            jumlahPcs: clampedPcs,
          };
          return clampedItem;
        }

        return updatedItem;
      });

      return nextItems;
    });

    if (warningMessage) {
      toast.error(warningMessage);
    }
  };

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
      diskonRupiah = Math.round((item.hargaJual * clampedPersen) / 100);
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

  const toggleItemDiskonType = (item: CartItem) => {
    const currentType = itemDiskonTypes[item.tempId] || "rupiah";
    const newType = currentType === "rupiah" ? "persen" : "rupiah";

    setItemDiskonTypes((prev) => ({ ...prev, [item.tempId]: newType }));

    if (newType === "persen") {
      const persen =
        item.hargaJual > 0
          ? Math.round((item.diskonPerItem / item.hargaJual) * 100)
          : 0;
      setItemDiskonValues((prev) => ({
        ...prev,
        [item.tempId]: persen.toString(),
      }));
    } else {
      setItemDiskonValues((prev) => ({
        ...prev,
        [item.tempId]: item.diskonPerItem.toLocaleString("id-ID"),
      }));
    }
  };

  const getItemDiskonDisplayValue = (item: CartItem): string => {
    const type = itemDiskonTypes[item.tempId] || "rupiah";
    const storedValue = itemDiskonValues[item.tempId];

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

  const handleItemHargaChange = (item: CartItem, value: string) => {
    const displayValue = value === "" ? "" : formatRupiahInput(value);
    const hargaJual = parseRupiahToNumber(value);

    setItemHargaValues((prev) => ({
      ...prev,
      [item.tempId]: displayValue,
    }));

    setCartItems((prevItems) =>
      prevItems.map((cartItem) =>
        cartItem.tempId === item.tempId ? { ...cartItem, hargaJual } : cartItem
      )
    );
  };

  const getItemHargaDisplayValue = (item: CartItem): string => {
    const storedValue = itemHargaValues[item.tempId];

    if (storedValue !== undefined) {
      return storedValue;
    }

    return item.hargaJual.toLocaleString("id-ID");
  };

  const getItemBeratGrams = (item: CartItem): number => {
    const totalPcs = getTotalItemPcs(item);
    return calculateBeratGramsFromBarang(item.barang, totalPcs);
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
    setItemHargaValues((prev) => {
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
      const hargaTotal = item.hargaJual * item.jumlahDus;
      const hargaPcs =
        item.jumlahPcs > 0
          ? Math.round(
              (item.hargaJual / item.barang.jumlahPerKemasan) * item.jumlahPcs
            )
          : 0;
      const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
      const diskon = item.diskonPerItem * item.jumlahDus;

      subtotal += totalHargaSebelumDiskon;
      totalDiskonItem += diskon;
    });

    return {
      subtotal,
      totalDiskonItem,
    };
  };

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
      setDiskonNota(rupiah.toLocaleString("id-ID"));
    }
  };

  const getSisaLimitPiutang = (customer: Customer): number => {
    return Math.max(0, customer.limit_piutang - customer.piutang);
  };

  const getEffectiveJumlahDibayar = (): number => {
    if (metodePembayaran === "CASH_TRANSFER") {
      return (
        parseRupiahToNumber(jumlahCash) +
        parseRupiahToNumber(jumlahTransfer)
      );
    }
    return parseRupiahToNumber(jumlahDibayar);
  };

  const getPembayaranBreakdown = (): { cash: number; transfer: number } => {
    if (metodePembayaran === "CASH_TRANSFER") {
      return {
        cash: parseRupiahToNumber(jumlahCash),
        transfer: parseRupiahToNumber(jumlahTransfer),
      };
    }

    if (metodePembayaran === "TRANSFER") {
      return { cash: 0, transfer: parseRupiahToNumber(jumlahDibayar) };
    }

    return { cash: parseRupiahToNumber(jumlahDibayar), transfer: 0 };
  };

  const handleMetodePembayaranChange = (
    metode: "CASH" | "TRANSFER" | "CASH_TRANSFER"
  ) => {
    if (metode === "CASH_TRANSFER") {
      if (jumlahDibayar) {
        setJumlahCash(jumlahDibayar);
      }
      if (!jumlahTransfer) {
        setJumlahTransfer("");
      }
    } else if (metodePembayaran === "CASH_TRANSFER") {
      const total =
        parseRupiahToNumber(jumlahCash) +
        parseRupiahToNumber(jumlahTransfer);
      setJumlahDibayar(total ? total.toLocaleString("id-ID") : "");
      setJumlahCash("");
      setJumlahTransfer("");
    }

    setMetodePembayaran(metode);
  };

  const setJumlahByNumber = (
    setter: (value: string) => void,
    value: number
  ) => {
    setter(value ? value.toLocaleString("id-ID") : "");
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      toast.error("Item dijual masih kosong");
      return;
    }

    const jumlahDibayarFinal = getEffectiveJumlahDibayar();

    if (!selectedCustomer && !manualCustomerName) {
      toast.error("Customer atau nama customer wajib diisi");
      return;
    }

    const diskonNotaRupiah = calculateDiskonNotaRupiah();

    setLoading(true);
    try {
      if (editPenjualanId) {
        const updatePayload: any = {
          items: cartItems.map((item) => ({
            id: item.itemId,
            barangId: item.barangId,
            jumlahDus: item.jumlahDus,
            jumlahPcs: item.jumlahPcs,
            totalItem: getTotalItemPcs(item),
            hargaJual: item.hargaJual,
            diskonPerItem: item.diskonPerItem,
            berat: getItemBeratGrams(item),
          })),
          jumlahDibayar: jumlahDibayarFinal,
          diskonNota: diskonNotaRupiah,
          metodePembayaran,
          tanggalTransaksi,
          tanggalJatuhTempo,
        };
        const { cash, transfer } = getPembayaranBreakdown();
        updatePayload.totalCash = cash;
        updatePayload.totalTransfer = transfer;

        if (selectedCustomer) {
          updatePayload.customerId = selectedCustomer.id;
        } else {
          updatePayload.namaCustomer = manualCustomerName;
        }

        const updateRes = await fetch(
          `/api/penjualan/${editPenjualanId}/edit`,
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
            id: editPenjualanId,
          });
          setShowCheckoutModal(false);
          setShowReceiptModal(true);
          toast.success(updateResult.message || "Penjualan berhasil diupdate");
          fetchBarang();
          fetchTodaySales();
        } else {
          toast.error(updateResult.error || "Gagal update penjualan");
        }

        return;
      }

      // Checkout langsung tanpa membuat keranjang di DB
      const checkoutData: any = {
        items: cartItems.map((item) => ({
          barangId: item.barangId,
          jumlahDus: item.jumlahDus,
          jumlahPcs: item.jumlahPcs,
          totalItem: getTotalItemPcs(item),
          hargaJual: item.hargaJual,
          diskonPerItem: item.diskonPerItem,
          berat: getItemBeratGrams(item),
        })),
        jumlahDibayar: jumlahDibayarFinal,
        diskonNota: diskonNotaRupiah,
        metodePembayaran,
      };
      const { cash, transfer } = getPembayaranBreakdown();
      checkoutData.totalCash = cash;
      checkoutData.totalTransfer = transfer;

      if (selectedCustomer) {
        checkoutData.customerId = selectedCustomer.id;
      } else if (manualCustomerName) {
        checkoutData.namaCustomer = manualCustomerName;
      }

      if (isAdmin && tanggalTransaksi) {
        checkoutData.tanggalTransaksi = tanggalTransaksi;
      }

      if (tanggalJatuhTempo) {
        checkoutData.tanggalJatuhTempo = tanggalJatuhTempo;
      }

      const checkoutRes = await fetch("/api/penjualan/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutData),
      });
      const checkoutResult = await checkoutRes.json();

      if (checkoutResult.success) {
        // Tambahkan id ke receiptData untuk keperluan print
        setReceiptData({
          ...checkoutResult.data.receipt,
          id: checkoutResult.data.penjualan.id,
        });
        setShowCheckoutModal(false);
        setShowReceiptModal(true);
        toast.success(checkoutResult.message);
        fetchBarang();
        fetchTodaySales();
      } else {
        toast.error(checkoutResult.error || "Gagal checkout");
      }
    } catch (error) {
      console.error("Error checkout:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCheckoutModal = async () => {
    if (cartItems.length === 0) {
      toast.error("Item dijual masih kosong");
      return;
    }

    if (hasZeroQtyItem) {
      toast.error("Ada item dengan jumlah 0. Periksa kembali item dijual.");
      return;
    }

    if (!selectedCustomer && !manualCustomerName) {
      toast.error("Customer atau nama customer wajib diisi");
      return;
    }

    // Langsung buka modal checkout tanpa membuat penjualan draft
    setShowCheckoutModal(true);
  };

  const handleReset = () => {
    // Reset semua state tanpa konfirmasi
    setCartItems([]);
    setSelectedCustomer(null);
    setManualCustomerName("");
    setUseManualCustomer(false);
    setDiskonNota("0");
    setDiskonNotaType("rupiah");
    setJumlahDibayar("");
    setJumlahCash("");
    setJumlahTransfer("");
    setMetodePembayaran("CASH");
    setTanggalJatuhTempo("");
    setItemDiskonTypes({});
    setItemDiskonValues({});
    setItemHargaValues({});
    setSearchCustomer("");
    if (editPenjualanId) {
      setEditPenjualanId(null);
      router.replace("/dashboard/admin/penjualan");
    }
    setExpandCustomerSearch(false);
    const today = new Date().toISOString().split("T")[0];
    setTanggalTransaksi(today);

    toast.success("Transaksi direset");
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

  // Kalkulasi dari cart lokal
  const cartSummary = calculateCartSummary();
  const calculatedTotal =
    cartSummary.subtotal -
    cartSummary.totalDiskonItem -
    calculateDiskonNotaRupiah();

  const hasZeroQtyItem = cartItems.some(
    (item) => item.jumlahDus === 0 && item.jumlahPcs === 0
  );

  const getPaymentStatus = () => {
    const bayar = getEffectiveJumlahDibayar();
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

      if (useManualCustomer || !selectedCustomer) {
        return {
          status: "HUTANG",
          kembalian: 0,
          sisaHutang,
          canCheckout: false,
          message: "Customer tidak terdaftar tidak bisa mengambil hutang",
        };
      }

      const sisaLimit = getSisaLimitPiutang(selectedCustomer);
      if (selectedCustomer.limit_piutang > 0 && sisaHutang > sisaLimit) {
        return {
          status: "HUTANG",
          kembalian: 0,
          sisaHutang,
          canCheckout: true,
          message: `Piutang melebihi limit! Sisa limit: ${formatRupiah(
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

  const hasPaymentInput =
    metodePembayaran === "CASH_TRANSFER"
      ? jumlahCash.trim() !== "" || jumlahTransfer.trim() !== ""
      : jumlahDibayar.trim() !== "";
  const paymentStatus = hasPaymentInput ? getPaymentStatus() : null;

  return (
    <div className="w-full min-h-[calc(100vh-6rem)] max-h-[calc(100vh-6rem)] overflow-x-hidden overflow-y-auto flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
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
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Penjualan Barang
                </h1>
                <p className="text-blue-100 text-sm">
                  {isAdmin
                    ? "Mode Admin - Dapat mengatur tanggal transaksi"
                    : "Kelola transaksi penjualan ke customer"}
                </p>
                {editPenjualanId && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-2 bg-yellow-400/90 text-slate-900 text-xs font-bold px-2.5 py-1 rounded-full">
                      Mode Edit • #{editPenjualanId}
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
                href="/dashboard/admin/penjualan/riwayat"
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
            {/* Customer Selection */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-2">
              <label className="text-xs font-extrabold text-gray-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                <div className="bg-blue-100 p-1.5 rounded-lg">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <span>
                  Customer <span className="text-red-500">*</span>
                </span>
              </label>

              {selectedCustomer ? (
                <div className="space-y-2">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-lg shadow-md text-white border border-blue-400 relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="relative flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate mb-1">
                          {selectedCustomer.nama}
                        </p>
                        <div className="flex items-center gap-2.5 text-xs text-blue-50">
                          <span className="truncate flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 shrink-0" />
                            {selectedCustomer.namaToko}
                          </span>
                          <span className="text-blue-300">•</span>
                          <span className="truncate flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {selectedCustomer.noHp}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerHutangInfo(null);
                          setSearchCustomer("");
                          setExpandCustomerSearch(false);
                          setUseManualCustomer(false);
                        }}
                        className="text-white hover:bg-white/20 p-1.5 rounded transition-all shrink-0 hover:scale-110 active:scale-95"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Info Hutang Customer */}
                  {loadingHutangInfo ? (
                    <div className="bg-white border-2 border-blue-200 rounded-lg p-3 text-center">
                      <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                      <p className="text-xs text-gray-600 mt-1">
                        Memuat info hutang...
                      </p>
                    </div>
                  ) : customerHutangInfo ? (
                    <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-blue-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">
                          Transaksi Hutang:
                        </span>
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                          {customerHutangInfo.jumlahTransaksiHutang} transaksi
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">
                          Total Hutang:
                        </span>
                        <span className="text-xs font-bold text-orange-600">
                          {formatRupiah(customerHutangInfo.piutang)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <span className="text-xs font-semibold text-gray-700">
                          Sisa Limit:
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            customerHutangInfo.sisaLimitHutang > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatRupiah(customerHutangInfo.sisaLimitHutang)}
                        </span>
                      </div>
                      {customerHutangInfo.sisaLimitHutang <= 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-md">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-medium">
                            Limit hutang sudah penuh!
                          </span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : useManualCustomer ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Masukkan nama customer..."
                    value={manualCustomerName}
                    onChange={(e) => setManualCustomerName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-yellow-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Customer tidak terdaftar tidak bisa mengambil hutang
                  </p>
                  <button
                    onClick={() => {
                      setUseManualCustomer(false);
                      setManualCustomerName("");
                    }}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-sm font-bold transition-all"
                  >
                    Kembali ke Daftar Customer
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Tampilkan placeholder jika belum expand search */}
                  {!expandCustomerSearch && (
                    <button
                      onClick={() => setExpandCustomerSearch(true)}
                      className="w-full text-center py-3 px-4 bg-gray-50 hover:bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 transition-all duration-200 group"
                    >
                      <p className="text-sm text-gray-600 group-hover:text-blue-600 font-semibold flex items-center justify-center gap-2 transition-colors">
                        <Search className="w-4 h-4" />
                        Cari customer untuk memulai
                      </p>
                    </button>
                  )}

                  {expandCustomerSearch && (
                    <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 z-10" />
                      <input
                        type="text"
                        placeholder="Ketik nama atau nama toko..."
                        value={searchCustomer}
                        onChange={(e) => {
                          setSearchCustomer(e.target.value);
                          setShowCustomerDropdown(true);
                        }}
                        className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium shadow-sm transition-all duration-200"
                        autoFocus
                      />

                      {showCustomerDropdown && searchCustomer.length >= 2 && (
                        <div className="absolute z-50 mt-2 w-full bg-white border-2 border-blue-300 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                          {searchingCustomer ? (
                            <div className="p-6 text-center">
                              <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                              <p className="text-sm text-gray-600 font-medium">
                                Mencari customer...
                              </p>
                            </div>
                          ) : customerList.length > 0 ? (
                            customerList.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  fetchCustomerHutangInfo(c.id);
                                  setShowCustomerDropdown(false);
                                  setSearchCustomer("");
                                  setExpandCustomerSearch(false);
                                }}
                                className="w-full p-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 border-b last:border-b-0 transition-all duration-200 text-left group"
                              >
                                <p className="font-bold text-sm text-gray-900 group-hover:text-blue-700 flex items-center gap-2">
                                  <User className="w-3.5 h-3.5" />
                                  {c.nama}
                                </p>
                                <p className="text-xs text-gray-600 ml-5 mt-0.5">
                                  {c.namaToko} • {c.noHp}
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

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        setExpandCustomerSearch(!expandCustomerSearch)
                      }
                      className="bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border-2 border-blue-200 hover:border-blue-300 hover:shadow-md active:scale-98"
                    >
                      <Search className="w-4 h-4" />
                      {expandCustomerSearch ? "Tutup" : "Cari Customer"}
                    </button>
                    <button
                      onClick={() => {
                        setUseManualCustomer(true);
                        setExpandCustomerSearch(false);
                      }}
                      className="bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md active:scale-98"
                    >
                      <UserPlus className="w-4 h-4" />
                      Input Manual
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Daftar Barang */}
            <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
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
                    const isInCart = cartItems.some(
                      (item) => item.barangId === barang.id
                    );
                    const limitHariIni = Number(barang.limitPenjualan || 0);
                    const soldToday = getTodaySold(barang.id);
                    const inCartPcs = getCartPcsForBarang(barang.id);
                    const sisaLimit =
                      limitHariIni > 0
                        ? Math.max(0, limitHariIni - soldToday - inCartPcs)
                        : null;
                    const isLimitReached =
                      limitHariIni > 0 && sisaLimit !== null && sisaLimit <= 0;
                    const perDus = Number(barang.jumlahPerKemasan) || 1;
                    const totalDipakai = soldToday + inCartPcs;
                    const totalDusDipakai = Math.floor(totalDipakai / perDus);
                    const sisa =
                      limitHariIni > 0
                        ? Math.max(0, limitHariIni - totalDipakai)
                        : 0;
                    const sisaDus = Math.floor(sisa / perDus);
                    const isNearLimit =
                      limitHariIni > 0 && !isLimitReached && sisa <= perDus;

                    // Hitung stok dalam kardus dan pcs
                    const stokDus = Math.floor(
                      Number(barang.stok) / Number(barang.jumlahPerKemasan)
                    );
                    const stokPcs =
                      Number(barang.stok) % Number(barang.jumlahPerKemasan);

                    return (
                      <div
                        key={barang.id}
                        className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                          isLimitReached
                            ? "border-red-300 bg-gradient-to-br from-red-50 to-red-100/60 shadow-md"
                            : isNearLimit
                            ? "border-orange-300 bg-gradient-to-br from-orange-50 to-orange-100/60 shadow-md"
                            : isLowStock
                            ? "border-red-300 bg-gradient-to-br from-red-50 to-red-100/50 shadow-md"
                            : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-xl hover:shadow-blue-100/50"
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                        {isInCart && (
                          <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg z-10 animate-in fade-in zoom-in duration-300">
                            <ShoppingCart className="w-2.5 h-2.5" />
                            Di Item Dijual
                          </div>
                        )}

                        {isLimitReached && (
                          <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg z-10 animate-in fade-in zoom-in duration-300">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Limit Tercapai
                          </div>
                        )}

                        <div className="relative flex items-center justify-between p-3">
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-start gap-1.5 mb-1.5">
                              <div className="bg-blue-100 p-1 rounded-lg mt-0.5 group-hover:bg-blue-200 transition-colors">
                                <Package className="w-3 h-3 text-blue-600" />
                              </div>
                              <h4 className="font-extrabold text-gray-900 text-xs leading-tight group-hover:text-blue-700 transition-colors">
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

                              <div className="flex items-center gap-1.5">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-lg shadow-md group-hover:shadow-lg transition-shadow">
                                  <p className="text-[11px] font-extrabold">
                                    {formatRupiah(barang.hargaJual)}
                                    <span className="text-[9px] font-medium opacity-90 ml-0.5">
                                      /{barang.jenisKemasan}
                                    </span>
                                  </p>
                                </div>

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
                                  {stokPcs > 0 &&
                                    ` ${stokPcs}/pcs`}
                                </span>
                              </div>

                              {limitHariIni > 0 && (
                                <div
                                  className={`flex items-center gap-1 mt-1 ${
                                    isLimitReached
                                      ? "text-red-600 animate-pulse"
                                      : isNearLimit
                                      ? "text-orange-600"
                                      : "text-blue-600"
                                  }`}
                                >
                                  <div
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[10px] font-bold backdrop-blur-sm ${
                                      isLimitReached
                                        ? "bg-red-50 border-red-200"
                                        : isNearLimit
                                        ? "bg-orange-50 border-orange-200"
                                        : "bg-blue-50 border-blue-200"
                                    }`}
                                  >
                                    <AlertCircle className="w-3 h-3" />
                                    <span className="flex flex-wrap items-center gap-1">
                                      Terjual: {totalDipakai} item /{" "}
                                      {totalDusDipakai} {barang.jenisKemasan} •
                                      Sisa limit {sisa} item / {sisaDus}{" "}
                                      {barang.jenisKemasan}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {isLimitReached && (
                                <div className="flex items-center gap-1.5 text-red-600 animate-in slide-in-from-left duration-300">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span className="text-xs font-bold">
                                    Limit harian tercapai!
                                  </span>
                                </div>
                              )}

                              {isNearLimit && !isLimitReached && (
                                <div className="flex items-center gap-1.5 text-orange-600 animate-in slide-in-from-left duration-300">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span className="text-xs font-bold">
                                    Mendekati limit!
                                  </span>
                                </div>
                              )}

                              {isLowStock && (
                                <div className="flex items-center gap-1.5 text-red-600 animate-in slide-in-from-left duration-300">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span className="text-xs font-bold">
                                    {isOutOfStock
                                      ? "Stok Habis!"
                                      : "Stok Menipis!"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            <button
                              onClick={() => handleQuickAddItem(barang)}
                              disabled={loading || isLowStock || isLimitReached}
                              className={`relative overflow-hidden p-2 rounded-xl transition-all duration-300 transform ${
                                isLowStock || isLimitReached
                                  ? "bg-gray-300 cursor-not-allowed opacity-50"
                                  : "bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl active:scale-95 group-hover:scale-110"
                              }`}
                            >
                              {!isLowStock && !isLimitReached && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                              )}

                              <Plus
                                className={`w-6 h-6 relative z-10 ${
                                  isLowStock || isLimitReached
                                    ? "text-gray-500"
                                    : "text-white"
                                }`}
                                strokeWidth={3}
                              />

                              <div className="absolute inset-0 rounded-xl overflow-hidden">
                                <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-500 rounded-full"></div>
                              </div>
                            </button>
                          </div>
                        </div>

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
              </div>
            </div>
          </div>

          {/* Right Side - 32% Item Dijual */}
          <div className="w-[32%] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
            <div className="p-4 bg-gray-50 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-700">
                    Item Dijual
                  </h2>
                </div>
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-md font-bold">
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
                            Harga default {formatRupiah(item.barang.hargaJual)}{" "}
                            / {item.barang.jenisKemasan}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.tempId)}
                          className="text-red-500 hover:bg-red-100 p-1.5 rounded-lg transition-all flex-shrink-0 ml-2 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Harga Jual */}
                      <div className="my-2 space-y-1">
                        <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-2 rounded-xl border border-blue-200">
                          <span className="text-xs font-bold text-gray-700 uppercase">
                            Harga:
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-blue-700">
                              Rp
                            </span>
                            <input
                              type="text"
                              value={getItemHargaDisplayValue(item)}
                              onChange={(e) =>
                                handleItemHargaChange(item, e.target.value)
                              }
                              className="w-24 text-right text-xs border-2 border-blue-300 rounded-lg px-2 py-1 font-bold bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              placeholder={formatRupiahInput(
                                String(item.barang.hargaJual)
                              )}
                            />
                          </div>
                        </div>
                        {item.hargaJual < item.barang.hargaJual && (
                          <p className="text-xs text-red-600 font-semibold">
                            Harga di bawah default, berpotensi menimbulkan
                            kerugian.
                          </p>
                        )}
                      </div>

                      {/* Quantity Controls - Enhanced */}
                      <div className="space-y-2">
                        {/* Jika jumlahPerKemasan > 1, tampilkan kontrol terpisah */}
                        {item.barang.jumlahPerKemasan > 1 ? (
                          <>
                            {/* Kemasan */}
                            <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100 p-2 rounded-xl">
                              <span className="text-xs font-bold text-gray-700 uppercase">
                                {item.barang.jenisKemasan}:
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() =>
                                    handleUpdateItem(
                                      item.tempId,
                                      "jumlahDus",
                                      Math.max(0, item.jumlahDus - 1)
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
                                      item.tempId,
                                      "jumlahDus",
                                      Math.max(0, parseInt(e.target.value) || 0)
                                    )
                                  }
                                  onWheel={(e) =>
                                    (e.target as HTMLInputElement).blur()
                                  }
                                  className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                  min="0"
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
                                  <Plus
                                    className="w-3.5 h-3.5"
                                    strokeWidth={3}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Pcs */}
                            <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-orange-100 p-2 rounded-xl">
                              <span className="text-xs font-bold text-gray-700 uppercase">
                                Pcs:
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() =>
                                    handleUpdateItem(
                                      item.tempId,
                                      "jumlahPcs",
                                      Math.max(0, item.jumlahPcs - 1)
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
                                      item.tempId,
                                      "jumlahPcs",
                                      Math.max(0, parseInt(e.target.value) || 0)
                                    )
                                  }
                                  onWheel={(e) =>
                                    (e.target as HTMLInputElement).blur()
                                  }
                                  className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                  min="0"
                                  max={item.barang.jumlahPerKemasan - 1}
                                />
                                <button
                                  onClick={() =>
                                    handleUpdateItem(
                                      item.tempId,
                                      "jumlahPcs",
                                      item.jumlahPcs + 1
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
                                  handleUpdateItem(
                                    item.tempId,
                                    "jumlahPcs",
                                    Math.max(0, item.jumlahPcs - 1)
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
                                    item.tempId,
                                    "jumlahPcs",
                                    Math.max(0, parseInt(e.target.value) || 0)
                                  )
                                }
                                onWheel={(e) =>
                                  (e.target as HTMLInputElement).blur()
                                }
                                className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                min="0"
                              />
                              <button
                                onClick={() =>
                                  handleUpdateItem(
                                    item.tempId,
                                    "jumlahPcs",
                                    item.jumlahPcs + 1
                                  )
                                }
                                className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                        )}

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
                      <div className="flex items-center justify-between pt-2.5 border-t-2 border-blue-300 mt-2.5 bg-blue-50 -mx-3 -mb-3 px-3 py-2.5 rounded-b-lg">
                        <span className="text-sm font-extrabold text-gray-800 uppercase">
                          Total:
                        </span>
                        <p className="font-extrabold text-blue-600 text-base">
                          {formatRupiah(
                            item.hargaJual * item.jumlahDus +
                              Math.round(
                                (item.hargaJual /
                                  item.barang.jumlahPerKemasan) *
                                  item.jumlahPcs
                              ) -
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
                      Item dijual masih kosong
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
                        className="w-16 text-right border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center font-bold text-base border-t-2 border-gray-200 pt-2 mt-2">
                    <span className="text-gray-900">TOTAL</span>
                    <span className="text-blue-600 text-lg">
                      {formatRupiah(Math.max(0, calculatedTotal))}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleOpenCheckoutModal}
                  disabled={
                    loading ||
                    cartItems.length === 0 ||
                    hasZeroQtyItem ||
                    (!selectedCustomer && !manualCustomerName)
                  }
                  className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-98"
                >
                  <CreditCard className="w-5 h-5" />
                  {loading ? "Memproses..." : "Proses Pembayaran"}
                </button>

                {/* Peringatan jika customer belum dipilih */}
                {cartItems.length > 0 &&
                  !selectedCustomer &&
                  !manualCustomerName && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">
                        Pilih customer untuk melanjutkan pembayaran
                      </p>
                    </div>
                  )}
                {hasZeroQtyItem && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">
                      Tambahkan item sebelum melanjutkan.
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
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-5 rounded-t-xl flex items-center justify-between">
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
              {/* Info Header: No Nota, Customer, Sales */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 mb-4 border border-slate-200">
                <div className="grid grid-cols-3 gap-4">
                  {/* No Nota */}

                  {/* Customer */}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
                      <User className="w-3.5 h-3.5" />
                      Customer
                    </div>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {selectedCustomer
                        ? selectedCustomer.nama
                        : manualCustomerName}
                    </p>
                  </div>

                  {/* Sales - Placeholder kosong */}
                  <div>
                    <p className="text-sm font-bold text-slate-900">-</p>
                  </div>
                </div>
              </div>

              {/* Ringkasan Transaksi */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="w-4 h-4 text-slate-700" />
                  <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                    Ringkasan Transaksi
                  </h3>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">Subtotal</span>
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
                    <span className="text-slate-600">Diskon Nota</span>
                    <span className="font-semibold">
                      -{formatRupiah(calculateDiskonNotaRupiah())}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-3 border-t border-slate-200">
                    <span className="text-slate-900">Total Bayar</span>
                    <span className="text-slate-900">
                      {formatRupiah(Math.max(0, calculatedTotal))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tanggal Penjualan */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-slate-700" />
                  <label className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                    Tanggal Penjualan
                  </label>
                </div>
                <input
                  type="date"
                  value={tanggalTransaksi}
                  onChange={(e) => setTanggalTransaksi(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none text-sm"
                />
              </div>

              {/* Metode Pembayaran */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-slate-700" />
                  <label className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                    Metode Pembayaran
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleMetodePembayaranChange("CASH")}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 border-2 ${
                      metodePembayaran === "CASH"
                        ? "bg-slate-800 border-slate-800 text-white"
                        : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    Cash
                  </button>
                  <button
                    onClick={() => handleMetodePembayaranChange("TRANSFER")}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 border-2 ${
                      metodePembayaran === "TRANSFER"
                        ? "bg-slate-800 border-slate-800 text-white"
                        : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    Transfer
                  </button>
                  <button
                    onClick={() =>
                      handleMetodePembayaranChange("CASH_TRANSFER")
                    }
                    className={`py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 border-2 ${
                      metodePembayaran === "CASH_TRANSFER"
                        ? "bg-slate-800 border-slate-800 text-white"
                        : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    Cash + Transfer
                  </button>
                </div>
              </div>

              {/* Payment Input */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="w-4 h-4 text-slate-700" />
                  <label className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                    {metodePembayaran === "CASH_TRANSFER"
                      ? "Jumlah Pembayaran"
                      : "Jumlah Dibayar"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                </div>

                {metodePembayaran === "CASH_TRANSFER" ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          value={jumlahCash}
                          onChange={(e) =>
                            setJumlahCash(formatRupiahInput(e.target.value))
                          }
                          className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none text-base font-semibold"
                          placeholder="Jumlah Cash"
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          value={jumlahTransfer}
                          onChange={(e) =>
                            setJumlahTransfer(formatRupiahInput(e.target.value))
                          }
                          className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none text-base font-semibold"
                          placeholder="Jumlah Transfer"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                      Total dibayar: {formatRupiah(getEffectiveJumlahDibayar())}
                    </p>
                  </>
                ) : (
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-semibold">
                      Rp
                    </span>
                    <input
                      type="text"
                      value={jumlahDibayar}
                      onChange={(e) =>
                        setJumlahDibayar(formatRupiahInput(e.target.value))
                      }
                      className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none text-base font-semibold"
                      placeholder="0"
                    />
                  </div>
                )}

                {/* Quick Amount Buttons */}
                {metodePembayaran !== "CASH_TRANSFER" && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    <button
                      onClick={() => {
                        const total = Math.max(0, calculatedTotal);
                        setJumlahByNumber(setJumlahDibayar, total);
                      }}
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200 transition-colors"
                    >
                      Semua
                    </button>
                    {[375000, 562500, 750000].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => {
                          const total = Math.round(
                            Math.max(0, calculatedTotal) * (percent / 750000)
                          );
                          setJumlahByNumber(setJumlahDibayar, total);
                        }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200 transition-colors"
                      >
                        {percent === 375000
                          ? "50%"
                          : percent === 562500
                          ? "75%"
                          : "100%"}
                      </button>
                    ))}
                  </div>
                )}
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
                      <Clock className="w-4 h-4 text-slate-700" />
                      <label className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                        Tanggal Jatuh Tempo
                        <span className="text-slate-500 font-normal ml-1 normal-case">
                          (Default 30 hari)
                        </span>
                      </label>
                    </div>
                    <input
                      type="date"
                      value={tanggalJatuhTempo}
                      onChange={(e) => setTanggalJatuhTempo(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none text-sm"
                    />
                  </div>
                )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-lg transition-all font-semibold border border-slate-300"
                >
                  Batal
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={
                    loading ||
                    !hasPaymentInput ||
                    (!selectedCustomer && !manualCustomerName) ||
                    (paymentStatus !== null && !paymentStatus.canCheckout)
                  }
                  className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white px-4 py-3 rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    "Memproses..."
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      {editPenjualanId
                        ? "Simpan Perubahan"
                        : "Selesaikan Pembayaran"}
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
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-xl text-center">
              <Check className="w-16 h-16 text-white mx-auto mb-2" />
              <h2 className="text-2xl font-bold text-white">
                Transaksi Berhasil!
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
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-medium">
                    {receiptData.customer.nama}
                  </span>
                </div>
                {receiptData.customer.namaToko && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Toko</span>
                    <span>{receiptData.customer.namaToko}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Metode</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      receiptData.metodePembayaran === "CASH"
                        ? "bg-green-100 text-green-700"
                        : receiptData.metodePembayaran === "TRANSFER"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {formatMetodePembayaranLabel(
                      receiptData.metodePembayaran
                    )}
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

              <div className="space-y-3">
                <button
                  onClick={() => {
                    window.open(
                      `/api/penjualan/${receiptData.id}/print-receipt`,
                      "_blank"
                    );
                  }}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-98"
                >
                  <Receipt className="w-5 h-5" />
                  CETAK NOTA
                </button>
                <button
                  onClick={() => {
                    setShowReceiptModal(false);
                    handleReset();
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-98"
                >
                  <Plus className="w-5 h-5" strokeWidth={3} />
                  Transaksi Baru
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PenjualanPage;
