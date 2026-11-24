"use client";
import React, { useEffect, useState } from "react";
import {
  History,
  CalendarDays,
  CalendarCheck,
  Store,
  Truck,
  Loader2,
  Save,
  Check,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

type RiwayatMode = "SEMUA" | "HARI_INI";
type Jenis = "toko" | "sales";
type Modes = Record<Jenis, RiwayatMode>;

const MENU: {
  jenis: Jenis;
  title: string;
  path: string;
  icon: React.ReactNode;
}[] = [
  {
    jenis: "toko",
    title: "Riwayat Penjualan Toko",
    path: "/dashboard/kasir/penjualan/riwayat",
    icon: <Store className="w-5 h-5 text-white" />,
  },
  {
    jenis: "sales",
    title: "Riwayat Penjualan Sales",
    path: "/dashboard/kasir/penjualan-sales/riwayat",
    icon: <Truck className="w-5 h-5 text-white" />,
  },
];

const OPTIONS: {
  value: RiwayatMode;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "SEMUA",
    label: "Semua History",
    desc: "Kasir bisa melihat transaksi tanggal berapa pun.",
    icon: <CalendarDays className="w-5 h-5" />,
  },
  {
    value: "HARI_INI",
    label: "Hari Ini Saja",
    desc: "Kasir hanya bisa melihat transaksi hari ini. Filter tanggal dikunci.",
    icon: <CalendarCheck className="w-5 h-5" />,
  },
];

const AksesRiwayatPage = () => {
  const [saved, setSaved] = useState<Modes | null>(null);
  const [draft, setDraft] = useState<Modes | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/pengaturan/riwayat-kasir", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSaved(data.data);
          setDraft(data.data);
        } else {
          toast.error(data.error || "Gagal memuat pengaturan");
        }
      })
      .catch(() => toast.error("Gagal memuat pengaturan"));
  }, []);

  const isDirty =
    !!saved &&
    !!draft &&
    (saved.toko !== draft.toko || saved.sales !== draft.sales);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pengaturan/riwayat-kasir", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(data.data);
        setDraft(data.data);
        toast.success(data.message || "Pengaturan disimpan");
      } else {
        toast.error(data.error || "Gagal menyimpan pengaturan");
      }
    } catch {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full px-3 sm:px-6 pb-8">
        <Toaster position="top-right" />

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-5 sm:p-6 mb-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-xl">
              <History className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Akses Riwayat Kasir
              </h1>
              <p className="text-blue-100 text-sm">
                Atur sejauh mana kasir bisa melihat riwayat penjualan.
              </p>
            </div>
          </div>
        </div>

        {!draft ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              {MENU.map((menu) => (
                <div
                  key={menu.jenis}
                  className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow">
                      {menu.icon}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-gray-900">{menu.title}</h2>
                      <p className="text-xs text-gray-500 font-mono truncate">
                        {menu.path}
                      </p>
                    </div>
                  </div>

                  <div
                    className="p-4 space-y-3"
                    role="radiogroup"
                    aria-label={menu.title}
                  >
                    {OPTIONS.map((opt) => {
                      const selected = draft[menu.jenis] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            setDraft((d) =>
                              d ? { ...d, [menu.jenis]: opt.value } : d,
                            )
                          }
                          className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${
                            selected
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <span
                            className={`mt-0.5 ${
                              selected ? "text-blue-600" : "text-gray-400"
                            }`}
                          >
                            {opt.icon}
                          </span>
                          <span className="flex-1">
                            <span className="block font-semibold text-gray-900">
                              {opt.label}
                            </span>
                            <span className="block text-sm text-gray-500 mt-0.5">
                              {opt.desc}
                            </span>
                          </span>
                          <span
                            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              selected
                                ? "border-blue-600 bg-blue-600"
                                : "border-gray-300"
                            }`}
                          >
                            {selected && <Check className="w-3 h-3 text-white" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-gray-500">
                Berlaku untuk akun <b>KASIR</b>. Admin selalu bisa melihat semua
                riwayat.
              </p>
              <div className="flex gap-2">
                {isDirty && (
                  <button
                    onClick={() => setDraft(saved)}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm disabled:opacity-50"
                  >
                    Batal
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Simpan Pengaturan
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AksesRiwayatPage;
