"use client";
// Dropdown checklist: pilih lebih dari satu opsi, dengan pencarian.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface ChecklistOption {
  value: number;
  label: string;
  hint?: string;
}

export default function MultiSelectChecklist({
  options,
  selected,
  onChange,
  allLabel = "Semua",
  unitLabel = "dipilih",
  searchPlaceholder = "Cari...",
  className = "",
}: {
  options: ChecklistOption[];
  selected: number[];
  onChange: (values: number[]) => void;
  /** teks saat tidak ada yang dipilih (= semua) */
  allLabel?: string;
  /** mis. "supplier" -> "3 supplier" */
  unitLabel?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Tutup saat klik di luar
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((o) => o.label.toLowerCase().includes(q))
      : options;
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (value: number) => {
    onChange(
      selectedSet.has(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const selectAllFiltered = () => {
    const next = new Set(selected);
    filtered.forEach((o) => next.add(o.value));
    onChange(Array.from(next));
  };

  const buttonText =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ||
          `1 ${unitLabel}`
        : `${selected.length} ${unitLabel}`;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-4 py-2 border rounded-lg bg-white text-left transition-all focus:ring-2 focus:ring-blue-400 outline-none ${
          selected.length > 0
            ? "border-blue-400 text-blue-800"
            : "border-gray-300 text-gray-700"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex-1 truncate">{buttonText}</span>
        {selected.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onChange([]);
              }
            }}
            className="p-0.5 rounded hover:bg-blue-100 text-blue-600"
            title="Hapus pilihan"
          >
            <X className="w-4 h-4" />
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] right-0 md:left-0 md:right-auto bg-white border border-gray-200 rounded-xl shadow-xl overflow-clip">
          {/* Pencarian */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
            <div className="flex justify-between mt-2 px-1 text-xs">
              <button
                type="button"
                onClick={selectAllFiltered}
                disabled={filtered.length === 0}
                className="text-blue-600 hover:underline font-medium disabled:opacity-40"
              >
                Pilih semua{query ? " (hasil cari)" : ""}
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={selected.length === 0}
                className="text-gray-500 hover:underline disabled:opacity-40"
              >
                Hapus pilihan
              </button>
            </div>
          </div>

          {/* Daftar */}
          <ul role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-500">
                Tidak ditemukan
              </li>
            ) : (
              filtered.map((o) => {
                const checked = selectedSet.has(o.value);
                // Pakai <button> (bukan <label> + input tersembunyi):
                // input `sr-only` yang difokus membuat browser menggulir
                // panel luar (overflow-hidden) sehingga isi panel bergeser
                // dan tampak putih.
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(o.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50 focus:outline-none focus-visible:bg-blue-50 ${
                        checked ? "bg-blue-50/60" : ""
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          checked
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="flex-1 truncate text-gray-800">
                        {o.label}
                      </span>
                      {o.hint && (
                        <span className="text-[11px] text-gray-400">
                          {o.hint}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              {selected.length === 0
                ? allLabel
                : `${selected.length} ${unitLabel} dipilih`}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
