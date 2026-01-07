"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
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
  DollarSign,
  TrendingUp,
  Calendar,
  RefreshCw,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Sparkles,
  Clock,
  Wallet,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";

interface DailySales {
  date: string;
  penjualan: number;
  pembayaranPenjualan: number;
  pembayaranPiutang: number;
  piutang: number;
  pembelian: number;
  pengeluaran: number;
  labaKotor: number;
  kerugian: number;
  laba: number;
  label?: string;
}

interface PaymentTotals {
  penjualan: number;
  piutang: number;
}

type Period = "daily" | "monthly" | "yearly";

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

// Custom Tooltip dengan 5 metrics
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
      parseInt(month) - 1
    ).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  } else {
    dateLabel = `Tahun ${d.date}`;
  }

  return (
    <div className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl shadow-2xl border border-purple-100 transform transition-all">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
        <Calendar className="w-4 h-4 text-purple-600" />
        <p className="font-bold text-gray-800">{dateLabel}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-sky-500" />
            <span className="text-sm text-gray-600">Pembayaran Penjualan</span>
          </div>
          <span className="font-bold text-blue-600">
            {formatRupiah(d.pembayaranPenjualan)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500" />
            <span className="text-sm text-gray-600">Pembayaran Piutang</span>
          </div>
          <span className="font-bold text-teal-600">
            {formatRupiah(d.pembayaranPiutang)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500" />
            <span className="text-sm text-gray-600">Total Piutang</span>
          </div>
          <span className="font-bold text-orange-600">
            {formatRupiah(d.piutang)}
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
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
            <span className="text-sm text-gray-600">Laba Kotor</span>
          </div>
          <span className="font-bold text-cyan-600">
            {formatRupiah(d.labaKotor)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
            <span className="text-sm text-gray-600">Laba Bersih</span>
          </div>
          <span
            className={`font-bold ${
              d.laba >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatRupiah(d.laba)}
          </span>
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
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [paymentTotals, setPaymentTotals] = useState<PaymentTotals>({
    penjualan: 0,
    piutang: 0,
  });
  const [totalPiutang, setTotalPiutang] = useState<number>(0);
  const [visibleLines, setVisibleLines] = useState({
    pembayaranPenjualan: true,
    pembayaranPiutang: true,
    piutang: true,
    pengeluaran: true,
    labaKotor: true,
    laba: true,
  });

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
        `/api/penjualan/grafik?period=${period}&range=${debouncedRange}&date=${selectedDate}`
      );
      const json = await res.json();

      if (json.success) {
        setData(json.data);
        setPaymentTotals({
          penjualan: json.paymentTotals?.penjualan ?? 0,
          piutang: json.paymentTotals?.piutang ?? 0,
        });
        setTotalPiutang(json.totalPiutang ?? 0);
      } else {
        console.error(json.error);
      }
    } catch (error) {
      console.error("Error fetch penjualan:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, debouncedRange, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculations
  const totalPenjualan = data.reduce((sum, item) => sum + item.penjualan, 0);
  const totalPengeluaran = data.reduce(
    (sum, item) => sum + item.pengeluaran,
    0
  );
  const totalLabaKotor = data.reduce((sum, item) => sum + item.labaKotor, 0);
  const totalKerugian = data.reduce((sum, item) => sum + item.kerugian, 0);
  const totalLaba = data.reduce((sum, item) => sum + item.laba, 0);

  // Trend calculation
  const halfPoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, halfPoint);
  const secondHalf = data.slice(halfPoint);
  const firstHalfTotal = firstHalf.reduce(
    (sum, item) => sum + item.penjualan,
    0
  );
  const secondHalfTotal = secondHalf.reduce(
    (sum, item) => sum + item.penjualan,
    0
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
          data[0]
        )
      : null;

  const maxLaba =
    data.length > 0
      ? data.reduce((max, cur) => (cur.laba > max.laba ? cur : max), data[0])
      : null;

  const maxKerugian =
    data.length > 0
      ? data.reduce(
          (max, cur) => (cur.kerugian > max.kerugian ? cur : max),
          data[0]
        )
      : null;

  const getFilterDateLabel = () => {
    const endDate = selectedDate
      ? new Date(`${selectedDate}T00:00:00`)
      : new Date();
    const startDate = new Date(endDate);

    if (period === "daily") {
      startDate.setDate(startDate.getDate() - (range - 1));
      const startLabel = startDate.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const endLabel = endDate.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      return range === 1 ? endLabel : `${startLabel} - ${endLabel}`;
    }

    if (period === "monthly") {
      startDate.setMonth(startDate.getMonth() - (range - 1));
      startDate.setDate(1);
      const startLabel = startDate.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
      const endLabel = endDate.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
      return range === 1 ? endLabel : `${startLabel} - ${endLabel}`;
    }

    startDate.setFullYear(startDate.getFullYear() - (range - 1));
    const startLabel = startDate.toLocaleDateString("id-ID", {
      year: "numeric",
    });
    const endLabel = endDate.toLocaleDateString("id-ID", {
      year: "numeric",
    });
    return range === 1 ? endLabel : `${startLabel} - ${endLabel}`;
  };

  const toggleLine = (line: keyof typeof visibleLines) => {
    setVisibleLines((prev) => ({ ...prev, [line]: !prev[line] }));
  };

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    if (newPeriod === "daily") setRange(1);
    else if (newPeriod === "monthly") setRange(12);
    else setRange(5);
  };

  const getPeriodLabel = () => {
    if (period === "daily") return `${range} Hari Terakhir`;
    if (period === "monthly") return `${range} Bulan Terakhir`;
    return `${range} Tahun Terakhir`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto">
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
                Analisis lengkap penjualan, piutang, pengeluaran, kerugian, dan
                laba bersih
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <label className="relative cursor-pointer">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 z-10 opacity-0 cursor-pointer"
                  aria-label="Filter tanggal"
                />
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm text-white text-sm shadow-lg">
                  <Calendar className="w-4 h-4" />
                  <span className="font-semibold">{getFilterDateLabel()}</span>
                </div>
              </label>
              <button
                onClick={fetchData}
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
                      onClick={() => setRange(7)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      7 Hari
                    </button>
                    <button
                      onClick={() => setRange(30)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      30 Hari
                    </button>
                    <button
                      onClick={() => setRange(90)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      90 Hari
                    </button>
                  </>
                )}
                {period === "monthly" && (
                  <>
                    <button
                      onClick={() => setRange(6)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      6 Bulan
                    </button>
                    <button
                      onClick={() => setRange(12)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      12 Bulan
                    </button>
                  </>
                )}
                {period === "yearly" && (
                  <>
                    <button
                      onClick={() => setRange(3)}
                      className="px-4 py-2 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      3 Tahun
                    </button>
                    <button
                      onClick={() => setRange(5)}
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

        {/* ✅ UPDATED: STATS CARDS - Now 5 cards (removed Rata-rata) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Pembayaran Penjualan"
            value={formatNumber(paymentTotals.penjualan)}
            subtitle={formatRupiah(paymentTotals.penjualan)}
            icon={DollarSign}
            gradient="bg-gradient-to-br from-blue-500 to-sky-600"
            delay={0}
          />

          <StatCard
            title="Pembayaran Piutang"
            value={formatNumber(paymentTotals.piutang)}
            subtitle={formatRupiah(paymentTotals.piutang)}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-teal-500 to-emerald-600"
            delay={50}
          />

          <StatCard
            title="Total Piutang"
            value={formatNumber(totalPiutang)}
            subtitle={formatRupiah(totalPiutang)}
            icon={Wallet}
            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            delay={75}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Pengeluaran"
            value={formatNumber(totalPengeluaran)}
            subtitle={formatRupiah(totalPengeluaran)}
            icon={Wallet}
            gradient="bg-gradient-to-br from-red-500 to-pink-600"
            delay={100}
          />

          <StatCard
            title="Laba Kotor"
            value={formatNumber(totalLabaKotor)}
            subtitle={formatRupiah(totalLabaKotor)}
            icon={BarChart3}
            gradient="bg-gradient-to-br from-cyan-500 to-blue-600"
            delay={150}
          />

          <StatCard
            title="Laba Bersih"
            value={formatNumber(totalLaba)}
            subtitle={formatRupiah(totalLaba)}
            icon={Sparkles}
            gradient="bg-gradient-to-br from-green-500 to-emerald-600"
            delay={200}
          />
        </div>

        {/* CHART SECTION */}
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 mb-8">
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-800 mb-2">
                Analisis Tren Keuangan
              </h2>
              <p className="text-sm text-gray-500">
                Visualisasi {getPeriodLabel().toLowerCase()}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 p-1.5 bg-gray-100 rounded-2xl">
                <button
                  onClick={() => setChartType("area")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    chartType === "area"
                      ? "bg-white text-purple-600 shadow-md"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Area
                </button>
                <button
                  onClick={() => setChartType("bar")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    chartType === "bar"
                      ? "bg-white text-purple-600 shadow-md"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Bar
                </button>
              </div>
            </div>
          </div>

          {/* Line Toggles */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span className="text-sm font-semibold text-gray-600">
              Tampilkan:
            </span>
            <button
              onClick={() => toggleLine("pembayaranPenjualan")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                visibleLines.pembayaranPenjualan
                  ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                  : "bg-gray-100 text-gray-400 border-2 border-gray-200"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-sky-500" />
              Pembayaran Penjualan
            </button>
            <button
              onClick={() => toggleLine("pembayaranPiutang")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                visibleLines.pembayaranPiutang
                  ? "bg-teal-100 text-teal-700 border-2 border-teal-300"
                  : "bg-gray-100 text-gray-400 border-2 border-gray-200"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500" />
              Pembayaran Piutang
            </button>
            <button
              onClick={() => toggleLine("piutang")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                visibleLines.piutang
                  ? "bg-orange-100 text-orange-700 border-2 border-orange-300"
                  : "bg-gray-100 text-gray-400 border-2 border-gray-200"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500" />
              Total Piutang
            </button>
            <button
              onClick={() => toggleLine("pengeluaran")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                visibleLines.pengeluaran
                  ? "bg-red-100 text-red-700 border-2 border-red-300"
                  : "bg-gray-100 text-gray-400 border-2 border-gray-200"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-pink-500" />
              Pengeluaran
            </button>
            <button
              onClick={() => toggleLine("labaKotor")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                visibleLines.labaKotor
                  ? "bg-cyan-100 text-cyan-700 border-2 border-cyan-300"
                  : "bg-gray-100 text-gray-400 border-2 border-gray-200"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
              Laba Kotor
            </button>
            <button
              onClick={() => toggleLine("laba")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                visibleLines.laba
                  ? "bg-green-100 text-green-700 border-2 border-green-300"
                  : "bg-gray-100 text-gray-400 border-2 border-gray-200"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
              Laba Bersih
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col justify-center items-center py-32">
              <div className="relative">
                <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-purple-600" />
                <div className="animate-ping absolute top-0 left-0 rounded-full h-20 w-20 border-4 border-purple-400 opacity-20" />
              </div>
              <p className="mt-6 text-gray-500 font-semibold">Memuat data...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-32">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
                <BarChart3 className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg font-semibold">
                Belum ada data
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Data akan muncul setelah transaksi pertama dibuat
              </p>
            </div>
          ) : (
            <div className="w-full h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "area" ? (
                  <AreaChart data={chartData} margin={{ left: 0, right: 20 }}>
                    <defs>
                      <linearGradient
                        id="colorPembayaranPenjualan"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorPembayaranPiutang"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#14b8a6"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#14b8a6"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorPiutang"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f97316"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f97316"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorPengeluaran"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#ef4444"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#ef4444"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorLabaKotor"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#06b6d4"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#06b6d4"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorLaba"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10b981"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10b981"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      tickLine={false}
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <Tooltip content={<CustomTooltip period={period} />} />
                    <Legend
                      wrapperStyle={{ paddingTop: "20px" }}
                      iconType="circle"
                    />

                    {visibleLines.pembayaranPenjualan && (
                      <Area
                        type="monotone"
                        dataKey="pembayaranPenjualan"
                        name="Pembayaran Penjualan"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fill="url(#colorPembayaranPenjualan)"
                        dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2 }}
                        activeDot={{ r: 7 }}
                      />
                    )}

                    {visibleLines.pembayaranPiutang && (
                      <Area
                        type="monotone"
                        dataKey="pembayaranPiutang"
                        name="Pembayaran Piutang"
                        stroke="#14b8a6"
                        strokeWidth={3}
                        fill="url(#colorPembayaranPiutang)"
                        dot={{ r: 4, fill: "#14b8a6", strokeWidth: 2 }}
                        activeDot={{ r: 7 }}
                      />
                    )}

                    {visibleLines.piutang && (
                      <Area
                        type="monotone"
                        dataKey="piutang"
                        name="Total Piutang"
                        stroke="#f97316"
                        strokeWidth={3}
                        fill="url(#colorPiutang)"
                        dot={{ r: 4, fill: "#f97316", strokeWidth: 2 }}
                        activeDot={{ r: 7 }}
                      />
                    )}

                    {visibleLines.pengeluaran && (
                      <Area
                        type="monotone"
                        dataKey="pengeluaran"
                        name="Pengeluaran"
                        stroke="#ef4444"
                        strokeWidth={3}
                        fill="url(#colorPengeluaran)"
                        dot={{ r: 4, fill: "#ef4444", strokeWidth: 2 }}
                        activeDot={{ r: 7 }}
                      />
                    )}

                    {visibleLines.labaKotor && (
                      <Area
                        type="monotone"
                        dataKey="labaKotor"
                        name="Laba Kotor"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        fill="url(#colorLabaKotor)"
                        dot={{ r: 4, fill: "#06b6d4", strokeWidth: 2 }}
                        activeDot={{ r: 7 }}
                      />
                    )}

                    {visibleLines.laba && (
                      <Area
                        type="monotone"
                        dataKey="laba"
                        name="Laba Bersih"
                        stroke="#10b981"
                        strokeWidth={3}
                        fill="url(#colorLaba)"
                        dot={{ r: 4, fill: "#10b981", strokeWidth: 2 }}
                        activeDot={{ r: 7 }}
                      />
                    )}
                  </AreaChart>
                ) : (
                  <BarChart data={chartData} margin={{ left: 0, right: 20 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      tickLine={false}
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <Tooltip content={<CustomTooltip period={period} />} />
                    <Legend
                      wrapperStyle={{ paddingTop: "20px" }}
                      iconType="rect"
                    />

                    {visibleLines.pembayaranPenjualan && (
                      <Bar
                        dataKey="pembayaranPenjualan"
                        name="Pembayaran Penjualan"
                        fill="#3b82f6"
                        radius={[8, 8, 0, 0]}
                      />
                    )}

                    {visibleLines.pembayaranPiutang && (
                      <Bar
                        dataKey="pembayaranPiutang"
                        name="Pembayaran Piutang"
                        fill="#14b8a6"
                        radius={[8, 8, 0, 0]}
                      />
                    )}

                    {visibleLines.piutang && (
                      <Bar
                        dataKey="piutang"
                        name="Total Piutang"
                        fill="#f97316"
                        radius={[8, 8, 0, 0]}
                      />
                    )}

                    {visibleLines.pengeluaran && (
                      <Bar
                        dataKey="pengeluaran"
                        name="Pengeluaran"
                        fill="#ef4444"
                        radius={[8, 8, 0, 0]}
                      />
                    )}

                    {visibleLines.labaKotor && (
                      <Bar
                        dataKey="labaKotor"
                        name="Laba Kotor"
                        fill="#06b6d4"
                        radius={[8, 8, 0, 0]}
                      />
                    )}

                    {visibleLines.laba && (
                      <Bar
                        dataKey="laba"
                        name="Laba Bersih"
                        fill="#10b981"
                        radius={[8, 8, 0, 0]}
                      />
                    )}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100">
            <p className="text-xs text-gray-600 leading-relaxed">
              <span className="font-bold text-purple-700">💡 Info:</span>{" "}
              Menampilkan data <strong>{getPeriodLabel().toLowerCase()}</strong>
              . Grafik menampilkan 6 metrik: Pembayaran Penjualan, Pembayaran
              Piutang, Total Piutang, Pengeluaran, Laba Kotor, dan Laba Bersih
              (Laba Kotor - Pengeluaran - Kerugian).
            </p>
          </div>
        </div>

        {/* QUICK INSIGHTS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500 rounded-xl">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-purple-900">Penjualan Tertinggi</h3>
            </div>
            {maxPenjualan && (
              <>
                <p className="text-2xl font-black text-purple-700 mb-1">
                  {formatRupiah(maxPenjualan.penjualan)}
                </p>
                <p className="text-sm text-purple-600">
                  {period === "daily" &&
                    new Date(
                      maxPenjualan.date + "T00:00:00"
                    ).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                    })}
                  {period === "monthly" &&
                    (() => {
                      const [year, month] = maxPenjualan.date.split("-");
                      return new Date(
                        parseInt(year),
                        parseInt(month) - 1
                      ).toLocaleDateString("id-ID", {
                        month: "long",
                        year: "numeric",
                      });
                    })()}
                  {period === "yearly" && `Tahun ${maxPenjualan.date}`}
                </p>
              </>
            )}
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500 rounded-xl">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-green-900">
                Laba Bersih Tertinggi
              </h3>
            </div>
            {maxLaba && (
              <>
                <p className="text-2xl font-black text-green-700 mb-1">
                  {formatRupiah(maxLaba.laba)}
                </p>
                <p className="text-sm text-green-600">
                  {period === "daily" &&
                    new Date(maxLaba.date + "T00:00:00").toLocaleDateString(
                      "id-ID",
                      {
                        day: "numeric",
                        month: "long",
                      }
                    )}
                  {period === "monthly" &&
                    (() => {
                      const [year, month] = maxLaba.date.split("-");
                      return new Date(
                        parseInt(year),
                        parseInt(month) - 1
                      ).toLocaleDateString("id-ID", {
                        month: "long",
                        year: "numeric",
                      });
                    })()}
                  {period === "yearly" && `Tahun ${maxLaba.date}`}
                </p>
              </>
            )}
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-500 rounded-xl">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-indigo-900">
                Margin Profit Bersih
              </h3>
            </div>
            <p className="text-2xl font-black text-indigo-700 mb-1">
              {totalPenjualan > 0
                ? ((totalLaba / totalPenjualan) * 100).toFixed(1)
                : 0}
              %
            </p>
            <p className="text-sm text-indigo-600">
              Dari total penjualan {getPeriodLabel().toLowerCase()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Penjualan30HariPage;
