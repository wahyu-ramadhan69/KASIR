// components/BarangModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

interface BarangFormData {
  namaBarang: string;
  hargaBeli: string;
  hargaJual: string;
  jumlahPerKemasan: string;
  ukuran: string;
  satuan: string;
  supplierId: string;
  limitPenjualan: string;
}

interface Supplier {
  id: number;
  namaSupplier: string;
}

interface BarangModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "add" | "edit";
  barangId?: number | null;
  initialData?: BarangFormData;
}

const BarangModal: React.FC<BarangModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode,
  barangId,
  initialData,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showLimitPenjualan, setShowLimitPenjualan] = useState(false);
  const [formData, setFormData] = useState<BarangFormData>({
    namaBarang: "",
    hargaBeli: "",
    hargaJual: "",
    jumlahPerKemasan: "",
    ukuran: "",
    satuan: "",
    supplierId: "",
    limitPenjualan: "0",
  });

  // Fetch suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch("http://localhost:3000/api/supplier");
        const data = await res.json();
        if (data.success) {
          setSuppliers(data.data);
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    };

    if (isOpen) {
      fetchSuppliers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (mode === "edit" && initialData) {
      const dataWithLimit = {
        ...initialData,
        limitPenjualan: initialData.limitPenjualan || "0"
      };
      setFormData(dataWithLimit);
      // Show limit penjualan field if it has a value > 0
      if (initialData.limitPenjualan && parseInt(initialData.limitPenjualan) > 0) {
        setShowLimitPenjualan(true);
      } else {
        setShowLimitPenjualan(false);
      }
    } else {
      setFormData({
        namaBarang: "",
        hargaBeli: "",
        hargaJual: "",
        jumlahPerKemasan: "",
        ukuran: "",
        satuan: "",
        supplierId: "",
        limitPenjualan: "0",
      });
      setShowLimitPenjualan(false);
    }
  }, [mode, initialData, isOpen]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url =
        mode === "add"
          ? "http://localhost:3000/api/barang"
          : `http://localhost:3000/api/barang/${barangId}`;

      const method = mode === "add" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          namaBarang: formData.namaBarang,
          hargaBeli: parseInt(formData.hargaBeli),
          hargaJual: parseInt(formData.hargaJual),
          jumlahPerKemasan: parseInt(formData.jumlahPerKemasan),
          ukuran: parseInt(formData.ukuran),
          satuan: formData.satuan,
          supplierId: parseInt(formData.supplierId),
          limitPenjualan: showLimitPenjualan ? parseInt(formData.limitPenjualan) : 0,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert(
          mode === "add"
            ? "Barang berhasil ditambahkan!"
            : "Barang berhasil diupdate!"
        );
        onSuccess();
        onClose();
      } else {
        alert(
          data.error ||
            `Gagal ${mode === "add" ? "menambahkan" : "mengupdate"} barang`
        );
      }
    } catch (error) {
      console.error(
        `Error ${mode === "add" ? "adding" : "updating"} barang:`,
        error
      );
      alert(
        `Terjadi kesalahan saat ${
          mode === "add" ? "menambahkan" : "mengupdate"
        } barang`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isEditMode = mode === "edit";
  const headerColor = isEditMode
    ? "from-yellow-500 to-yellow-600"
    : "from-blue-600 to-blue-700";
  const focusColor = isEditMode
    ? "focus:ring-yellow-400"
    : "focus:ring-blue-400";
  const buttonColor = isEditMode
    ? "from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
    : "from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800";

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`bg-gradient-to-r ${headerColor} p-6 flex items-center justify-between`}
        >
          <h2 className="text-2xl font-bold text-white">
            {isEditMode ? "Edit Barang" : "Tambah Barang Baru"}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Nama Barang */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nama Barang <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="namaBarang"
                value={formData.namaBarang}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${focusColor} focus:border-transparent outline-none`}
                placeholder="Masukkan nama barang"
                required
              />
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select
                name="supplierId"
                value={formData.supplierId}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${focusColor} focus:border-transparent outline-none`}
                required
              >
                <option value="">Pilih Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.namaSupplier}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Harga Beli */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Harga Beli <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="hargaBeli"
                  value={formData.hargaBeli}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${focusColor} focus:border-transparent outline-none`}
                  placeholder="Contoh: 12000"
                  required
                />
              </div>

              {/* Harga Jual */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Harga Jual <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="hargaJual"
                  value={formData.hargaJual}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${focusColor} focus:border-transparent outline-none`}
                  placeholder="Contoh: 15000"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Ukuran */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ukuran <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="ukuran"
                  value={formData.ukuran}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${focusColor} focus:border-transparent outline-none`}
                  placeholder="Contoh: 1"
                  required
                />
              </div>

              {/* Satuan */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Satuan <span className="text-red-500">*</span>
                </label>
                <select
                  name="satuan"
                  value={formData.satuan}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${focusColor} focus:border-transparent outline-none`}
                  required
                >
                  <option value="">Pilih Satuan</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="liter">Liter</option>
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="box">Box</option>
                  <option value="pack">Pack</option>
                </select>
              </div>
            </div>

            {/* Jumlah Per Kardus */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Jumlah Per Kardus <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="jumlahPerKemasan"
                value={formData.jumlahPerKemasan}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${focusColor} focus:border-transparent outline-none`}
                placeholder="Contoh: 20"
                required
              />
            </div>

            {/* Checkbox untuk Limit Pembelian */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="showLimitPenjualan"
                checked={showLimitPenjualan}
                onChange={(e) => setShowLimitPenjualan(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="showLimitPenjualan"
                className="text-sm font-medium text-gray-700 cursor-pointer"
              >
                Aktifkan Limit Pembelian
              </label>
            </div>

            {/* Limit Pembelian - Hidden by default */}
            {showLimitPenjualan && (
              <div className="animate-fadeIn">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Limit Pembelian (dalam unit)
                </label>
                <input
                  type="number"
                  name="limitPenjualan"
                  value={formData.limitPenjualan}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${focusColor} focus:border-transparent outline-none`}
                  placeholder="Contoh: 100"
                  min="0"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Batasan maksimal unit yang dapat dibeli per transaksi. Kosongkan atau isi 0 untuk tidak ada batasan.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 bg-gradient-to-r ${buttonColor} text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting
                ? "Menyimpan..."
                : isEditMode
                ? "Update Barang"
                : "Simpan Barang"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BarangModal;
