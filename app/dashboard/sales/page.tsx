"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  BarChart,
  Bar,
} from "recharts";
import {
  Calendar,
  RefreshCw,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface DailySales {
  date: string;
  penjualan: number;
  piutang: number;
  pengeluaran: number;
  kerugian: number;
  label?: string;
}

type Period = "daily" | "monthly" | "yearly";
// lupa

interface SalesApprovalStats {
  approved: number;
  rejected: number;
  pending: number;
}

const formatRupiah = (number: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
};

const formatNumber = (num: number): string => {
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const formatShort = (value: number, suffix: string) => {
    const rounded = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
    return `${sign}${rounded} ${suffix}`;
  };

  if (abs >= 1000000000) return formatShort(abs / 1000000000, "M");
  if (abs >= 1000000) return formatShort(abs / 1000000, "jt");
  if (abs >= 1000) return formatShort(abs / 1000, "rb");
  return `${num}`;
};

// Custom Tooltip dengan 3 metrics
const CustomTooltip = ({ active, payload, period }: any) => {
  if (!active || !payload || !payload.length) return null;

  const d = payload[0].payload;

  let dateLabel = "";
  if (period === "daily") {
    dateLabel = new Date(d.date + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } else if (period === "monthly") {
    const [year, month] = d.date.split("-");
    dateLabel = new Date(
      parseInt(year),
      parseInt(month) - 1,
    ).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  } else {
    dateLabel = `Tahun ${d.date}`;
  }

  const marginKerugian =
    d.penjualan > 0 ? ((d.kerugian / d.penjualan) * 100).toFixed(1) : "0";

  return (
    <div className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl shadow-2xl border border-purple-100 transform transition-all">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
        <Calendar className="w-4 h-4 text-purple-600" />
        <p className="font-bold text-gray-800">{dateLabel}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500" />
            <span className="text-sm text-gray-600">Pembayaran Penjualan</span>
          </div>
          <span className="font-bold text-purple-600">
            {formatRupiah(d.penjualan)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-pink-500" />
            <span className="text-sm text-gray-600">Pengeluaran</span>
          </div>
          <span className="font-bold text-red-500">
            {formatRupiah(d.pengeluaran)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-slate-700 to-slate-900" />
            <span className="text-sm text-gray-600">Kerugian</span>
          </div>
          <span
            className={`font-bold ${
              d.kerugian >= 0 ? "text-slate-700" : "text-red-600"
            }`}
          >
            {formatRupiah(d.kerugian)}
          </span>
        </div>

        <div className="pt-3 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between gap-8">
            <span className="text-xs text-gray-500">Rasio Kerugian</span>
            <span
              className={`text-sm font-bold ${
                parseFloat(marginKerugian) >= 0
                  ? "text-slate-700"
                  : "text-red-600"
              }`}
            >
              {marginKerugian}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  trend,
  delay,
}: any) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), delay);
  }, [delay]);

  return (
    <div
      className={`group bg-white rounded-3xl p-6 shadow-lg border border-gray-100 relative overflow-hidden transform transition-all duration-700 hover:scale-105 hover:shadow-2xl ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <div
        className={`absolute -right-8 -top-8 w-32 h-32 ${gradient} rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700`}
      />
      <div
        className={`absolute -right-16 -bottom-8 w-40 h-40 ${gradient} rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700`}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {title}
            </p>
            {trend !== undefined && trend !== null && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  trend > 0
                    ? "bg-green-100 text-green-700"
                    : trend < 0
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                {trend > 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : trend < 0 ? (
                  <ArrowDownRight className="w-3 h-3" />
                ) : null}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-3xl font-black text-gray-900 mb-1 tracking-tight">
            {value}
          </p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>

        <div
          className={`${gradient} p-4 rounded-2xl shadow-lg group-hover:rotate-12 transition-transform duration-500`}
        >
          <Icon className="w-7 h-7 text-white" />
        </div>
      </div>
    </div>
  );
};

const Penjualan30HariPage = () => {
  const [data, setData] = useState<DailySales[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [chartType, setChartType] = useState<"bar" | "area">("area");
  const [period, setPeriod] = useState<Period>("daily");
  const [range, setRange] = useState<number>(1);
  const [visibleLines, setVisibleLines] = useState({
    penjualan: true,
    pengeluaran: true,
    kerugian: true,
  });
  const [approvalStats, setApprovalStats] = useState<SalesApprovalStats>({
    approved: 0,
    rejected: 0,
    pending: 0,
  });
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  const [debouncedRange, setDebouncedRange] = useState<number>(range);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRange(range);
    }, 500);
    return () => clearTimeout(timer);
  }, [range]);

  const fetchData = useCallback(async () => {
    try {
      if (!data.length) setLoading(true);
      else setRefreshing(true);

      const res = await fetch(
        `/api/penjualan/grafik?period=${period}&range=${debouncedRange}`,
      );
      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        console.error(json.error);
      }
    } catch (error) {
      console.error("Error fetch penjualan:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, debouncedRange]);

  const fetchApprovalStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await fetch("/api/sales/statistik");
      const json = await res.json();
      if (json.success) {
        setApprovalStats({
          approved: json.data?.approved ?? 0,
          rejected: json.data?.rejected ?? 0,
          pending: json.data?.pending ?? 0,
        });
      } else {
        console.error(json.error);
      }
    } catch (error) {
      console.error("Error fetch statistik sales:", error);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchApprovalStats();
  }, [fetchApprovalStats]);

  // Calculations
  // Trend calculation
  const halfPoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, halfPoint);
  const secondHalf = data.slice(halfPoint);
  const firstHalfTotal = firstHalf.reduce(
    (sum, item) => sum + item.penjualan,
    0,
  );
  const secondHalfTotal = secondHalf.reduce(
    (sum, item) => sum + item.penjualan,
    0,
  );
  const trendPercentage =
    firstHalfTotal > 0
      ? ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100
      : 0;

  // Format label berdasarkan period
  const chartData = data.map((item) => {
    let label = "";
    if (period === "daily") {
      const dateObj = new Date(item.date + "T00:00:00");
      label = dateObj.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      });
    } else if (period === "monthly") {
      const [year, month] = item.date.split("-");
      const dateObj = new Date(parseInt(year), parseInt(month) - 1);
      label = dateObj.toLocaleDateString("id-ID", {
        month: "short",
        year: "2-digit",
      });
    } else {
      label = item.date;
    }
    return { ...item, label };
  });

  const maxPenjualan =
    data.length > 0
      ? data.reduce(
          (max, cur) => (cur.penjualan > max.penjualan ? cur : max),
          data[0],
        )
      : null;

  const maxPengeluaran =
    data.length > 0
      ? data.reduce(
          (max, cur) => (cur.pengeluaran > max.pengeluaran ? cur : max),
          data[0],
        )
      : null;

  const maxKerugian =
    data.length > 0
      ? data.reduce(
          (max, cur) => (cur.kerugian > max.kerugian ? cur : max),
          data[0],
        )
      : null;

  const tanggalHariIni = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const toggleLine = (line: keyof typeof visibleLines) => {
    setVisibleLines((prev) => ({ ...prev, [line]: !prev[line] }));
  };

  const setRangeInstant = (nextRange: number) => {
    setRange(nextRange);
    setDebouncedRange(nextRange);
  };

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    if (newPeriod === "daily") setRangeInstant(1);
    else if (newPeriod === "monthly") setRangeInstant(12);
    else setRangeInstant(5);
  };

  const getPeriodLabel = () => {
    if (period === "daily") return `${range} Hari Terakhir`;
    if (period === "monthly") return `${range} Bulan Terakhir`;
    return `${range} Tahun Terakhir`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="w-full mx-auto">
        {/* HEADER */}
        <div className="relative bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-3xl p-8 mb-8 shadow-2xl overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-900/20 rounded-full translate-y-48 -translate-x-48 blur-3xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm text-sm text-white mb-4 shadow-lg">
                <Activity className="w-4 h-4 animate-pulse" />
                <span className="font-semibold">Real-time Monitoring</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
                Dashboard Keuangan
              </h1>
              <p className="text-purple-100 text-base max-w-2xl">
                Analisis lengkap penjualan, pengeluaran, dan kerugian
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm text-white text-sm shadow-lg">
                <Clock className="w-4 h-4" />
                <span className="font-semibold">{tanggalHariIni}</span>
              </div>
              <button
                onClick={() => {
                  fetchData();
                  fetchApprovalStats();
                }}
                disabled={refreshing}
                className="group bg-white text-purple-700 hover:bg-purple-50 px-6 py-3 rounded-2xl flex items-center gap-3 font-bold transition-all shadow-xl hover:shadow-2xl hover:scale-105 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-5 h-5 transition-transform ${
                    refreshing ? "animate-spin" : "group-hover:rotate-180"
                  }`}
                />
                <span>{refreshing ? "Memuat..." : "Refresh Data"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* FILTER SECTION */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 mb-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Period Filter */}
            <div className="flex-1 w-full lg:w-auto">
              <label className="text-sm font-bold text-gray-700 mb-3 block">
                Periode Waktu
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handlePeriodChange("daily")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl font-semibold transition-all ${
                    period === "daily"
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg scale-105"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <CalendarDays className="w-6 h-6" />
                  <span className="text-xs">Harian</span>
                </button>
                <button
                  onClick={() => handlePeriodChange("monthly")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl font-semibold transition-all ${
                    period === "monthly"
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg scale-105"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <CalendarRange className="w-6 h-6" />
                  <span className="text-xs">Bulanan</span>
                </button>
                <button
                  onClick={() => handlePeriodChange("yearly")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl font-semibold transition-all ${
                    period === "yearly"
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg scale-105"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <CalendarClock className="w-6 h-6" />
                  <span className="text-xs">Tahunan</span>
                </button>
              </div>
            </div>

            {/* Range Filter */}
            <div className="flex-1 w-full lg:w-auto">
              <label className="text-sm font-bold text-gray-700 mb-3 block">
                Rentang{" "}
                {period === "daily"
                  ? "Hari"
                  : period === "monthly"
                    ? "Bulan"
                    : "Tahun"}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={period === "daily" ? 90 : period === "monthly" ? 24 : 10}
                  value={range}
                  onChange={(e) => setRange(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="min-w-[120px] px-4 py-2 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-xl">
                  <p className="text-2xl font-black text-purple-700 text-center">
                    {range}
                  </p>
                  <p className="text-xs text-purple-600 text-center">
                    {period === "daily"
                      ? "Hari"
                      : period === "monthly"
                        ? "Bulan"
                        : "Tahun"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="w-full lg:w-auto">
              <label className="text-sm font-bold text-gray-700 mb-3 block">
                Quick Filter
              </label>
              <div className="flex flex-wrap gap-2">
                {period === "daily" && (
                  <>
                    <button
                      onClick={() => setRange(1)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      1 Hari
                    </button>
                    <button
                      onClick={() => setRangeInstant(7)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      7 Hari
                    </button>
                    <button
                      onClick={() => setRangeInstant(30)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      30 Hari
                    </button>
                    <button
                      onClick={() => setRangeInstant(90)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      90 Hari
                    </button>
                  </>
                )}
                {period === "monthly" && (
                  <>
                    <button
                      onClick={() => setRangeInstant(6)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      6 Bulan
                    </button>
                    <button
                      onClick={() => setRangeInstant(12)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      12 Bulan
                    </button>
                  </>
                )}
                {period === "yearly" && (
                  <>
                    <button
                      onClick={() => setRangeInstant(3)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      3 Tahun
                    </button>
                    <button
                      onClick={() => setRangeInstant(5)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      5 Tahun
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ✅ UPDATED: STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Disetujui"
            value={loadingStats ? "..." : formatNumber(approvalStats.approved)}
            subtitle="Order disetujui"
            icon={CheckCircle}
            gradient="bg-gradient-to-br from-emerald-500 to-green-600"
            trend={loadingStats ? undefined : trendPercentage}
            delay={0}
          />

          <StatCard
            title="Menunggu"
            value={loadingStats ? "..." : formatNumber(approvalStats.pending)}
            subtitle="Menunggu approval"
            icon={Clock}
            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            delay={25}
          />

          <StatCard
            title="Ditolak"
            value={loadingStats ? "..." : formatNumber(approvalStats.rejected)}
            subtitle="Order ditolak"
            icon={XCircle}
            gradient="bg-gradient-to-br from-red-500 to-rose-600"
            delay={50}
          />
        </div>

        {/* CHART SECTION */}

        {/* QUICK INSIGHTS */}
      </div>
    </div>
  );
};

export default Penjualan30HariPage;
