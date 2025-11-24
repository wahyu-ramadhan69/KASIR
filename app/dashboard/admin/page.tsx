"use client";

import React, { useEffect, useState } from "react";
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
  TrendingDown,
  Clock,
  Wallet,
  ShoppingCart,
} from "lucide-react";

interface DailySales {
  date: string;
  penjualan: number;
  pengeluaran: number;
  laba: number;
  label?: string;
}

const formatRupiah = (number: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}jt`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}rb`;
  return num.toString();
};

// Custom Tooltip dengan 3 metrics
// Di dalam CustomTooltip component, ganti bagian margin calculation:

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const d = payload[0].payload;
  const date = new Date(d.date + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  // FIX: Pastikan margin selalu string
  const marginValue =
    d.penjualan > 0 ? ((d.laba / d.penjualan) * 100).toFixed(1) : "0";

  return (
    <div className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl shadow-2xl border border-purple-100 transform transition-all">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
        <Calendar className="w-4 h-4 text-purple-600" />
        <p className="font-bold text-gray-800">{date}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500" />
            <span className="text-sm text-gray-600">Penjualan Kotor</span>
          </div>
          <span className="font-bold text-purple-600">
            {formatRupiah(d.penjualan)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-orange-500" />
            <span className="text-sm text-gray-600">Pengeluaran</span>
          </div>
          <span className="font-bold text-red-500">
            {formatRupiah(d.pengeluaran)}
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

        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between gap-8">
            <span className="text-xs text-gray-500">Margin Laba</span>
            <span
              className={`text-sm font-bold ${
                parseFloat(marginValue) >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {marginValue}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Komponen Stat Card dengan animasi
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
      {/* Background decorative elements */}
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
                {Math.abs(trend)}%
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
  const [chartType, setChartType] = useState<"line" | "area">("area");
  const [visibleLines, setVisibleLines] = useState({
    penjualan: true,
    pengeluaran: true,
    laba: true,
  });

  const fetchData = async () => {
    try {
      if (!data.length) setLoading(true);
      else setRefreshing(true);

      const res = await fetch("/api/penjualan/grafik");
      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        console.error(json.error);
      }
    } catch (error) {
      console.error("Error fetch penjualan 30 hari:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculations
  const totalPenjualan = data.reduce((sum, item) => sum + item.penjualan, 0);
  const totalPengeluaran = data.reduce(
    (sum, item) => sum + item.pengeluaran,
    0
  );
  const totalLaba = data.reduce((sum, item) => sum + item.laba, 0);
  const rataRataPerHari = data.length ? totalPenjualan / data.length : 0;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayData = data.find((item) => item.date === todayKey);
  const totalHariIni = todayData?.penjualan ?? 0;

  // Trend calculation (compare last 7 days vs previous 7 days)
  const last7Days = data.slice(-7);
  const prev7Days = data.slice(-14, -7);
  const last7Total = last7Days.reduce((sum, item) => sum + item.penjualan, 0);
  const prev7Total = prev7Days.reduce((sum, item) => sum + item.penjualan, 0);
  const trendPercentage =
    prev7Total > 0 ? ((last7Total - prev7Total) / prev7Total) * 100 : 0;

  // Chart data
  const chartData = data.map((item) => {
    const dateObj = new Date(item.date + "T00:00:00");
    const label = dateObj.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    });
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

  const tanggalHariIni = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const toggleLine = (line: keyof typeof visibleLines) => {
    setVisibleLines((prev) => ({ ...prev, [line]: !prev[line] }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="relative bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-3xl p-8 mb-8 shadow-2xl overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-900/20 rounded-full translate-y-48 -translate-x-48 blur-3xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm text-sm text-white mb-4 shadow-lg">
                <Activity className="w-4 h-4 animate-pulse" />
                <span className="font-semibold">Real-time Monitoring</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
                Dashboard Penjualan
              </h1>
              <p className="text-purple-100 text-base max-w-2xl">
                Analisis komprehensif penjualan, pengeluaran, dan laba bersih 30
                hari terakhir
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm text-white text-sm shadow-lg">
                <Clock className="w-4 h-4" />
                <span className="font-semibold">{tanggalHariIni}</span>
              </div>
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

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Penjualan Kotor"
            value={formatNumber(totalPenjualan)}
            subtitle={formatRupiah(totalPenjualan)}
            icon={ShoppingCart}
            gradient="bg-gradient-to-br from-purple-500 to-indigo-600"
            trend={trendPercentage}
            delay={0}
          />

          <StatCard
            title="Total Pengeluaran"
            value={formatNumber(totalPengeluaran)}
            subtitle={formatRupiah(totalPengeluaran)}
            icon={Wallet}
            gradient="bg-gradient-to-br from-red-500 to-orange-600"
            delay={100}
          />

          <StatCard
            title="Laba Bersih"
            value={formatNumber(totalLaba)}
            subtitle={formatRupiah(totalLaba)}
            icon={Sparkles}
            gradient="bg-gradient-to-br from-green-500 to-emerald-600"
            delay={200}
          />

          <StatCard
            title="Rata-rata/Hari"
            value={formatNumber(Math.round(rataRataPerHari))}
            subtitle={formatRupiah(Math.round(rataRataPerHari))}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
            delay={300}
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
                Visualisasi penjualan kotor, pengeluaran, dan laba bersih harian
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Chart Type Toggle */}
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
                  onClick={() => setChartType("line")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    chartType === "line"
                      ? "bg-white text-purple-600 shadow-md"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Line
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
              onClick={() => toggleLine("penjualan")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                visibleLines.penjualan
                  ? "bg-purple-100 text-purple-700 border-2 border-purple-300"
                  : "bg-gray-100 text-gray-400 border-2 border-gray-200"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500" />
              Penjualan
            </button>
            <button
              onClick={() => toggleLine("pengeluaran")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                visibleLines.pengeluaran
                  ? "bg-red-100 text-red-700 border-2 border-red-300"
                  : "bg-gray-100 text-gray-400 border-2 border-gray-200"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-orange-500" />
              Pengeluaran
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
              Laba
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
                Belum ada data penjualan
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
                        id="colorPenjualan"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#8b5cf6"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#8b5cf6"
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
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: "20px" }}
                      iconType="circle"
                    />

                    {visibleLines.penjualan && (
                      <Area
                        type="monotone"
                        dataKey="penjualan"
                        name="Penjualan"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        fill="url(#colorPenjualan)"
                        dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 2 }}
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

                    {visibleLines.laba && (
                      <Area
                        type="monotone"
                        dataKey="laba"
                        name="Laba"
                        stroke="#10b981"
                        strokeWidth={3}
                        fill="url(#colorLaba)"
                        dot={{ r: 4, fill: "#10b981", strokeWidth: 2 }}
                        activeDot={{ r: 7 }}
                      />
                    )}
                  </AreaChart>
                ) : (
                  <LineChart data={chartData} margin={{ left: 0, right: 20 }}>
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
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: "20px" }}
                      iconType="circle"
                    />

                    {visibleLines.penjualan && (
                      <Line
                        type="monotone"
                        dataKey="penjualan"
                        name="Penjualan"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{
                          r: 5,
                          fill: "#8b5cf6",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        activeDot={{ r: 7 }}
                      />
                    )}

                    {visibleLines.pengeluaran && (
                      <Line
                        type="monotone"
                        dataKey="pengeluaran"
                        name="Pengeluaran"
                        stroke="#ef4444"
                        strokeWidth={3}
                        dot={{
                          r: 5,
                          fill: "#ef4444",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        activeDot={{ r: 7 }}
                      />
                    )}

                    {visibleLines.laba && (
                      <Line
                        type="monotone"
                        dataKey="laba"
                        name="Laba"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{
                          r: 5,
                          fill: "#10b981",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        activeDot={{ r: 7 }}
                      />
                    )}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100">
            <p className="text-xs text-gray-600 leading-relaxed">
              <span className="font-bold text-purple-700">💡 Info:</span> Grafik
              menampilkan 3 metrik utama:
              <strong> Penjualan Kotor</strong> (total dari PenjualanHeader),
              <strong> Pengeluaran</strong> (dari tabel Pengeluaran), dan
              <strong> Laba Bersih</strong> (dari PenjualanItem.laba). Klik
              tombol di atas untuk show/hide line yang diinginkan.
            </p>
          </div>
        </div>

        {/* QUICK INSIGHTS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  {new Date(maxPenjualan.date + "T00:00:00").toLocaleDateString(
                    "id-ID",
                    {
                      day: "numeric",
                      month: "long",
                    }
                  )}
                </p>
              </>
            )}
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500 rounded-xl">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-green-900">Laba Tertinggi</h3>
            </div>
            {maxLaba && (
              <>
                <p className="text-2xl font-black text-green-700 mb-1">
                  {formatRupiah(maxLaba.laba)}
                </p>
                <p className="text-sm text-green-600">
                  {new Date(maxLaba.date + "T00:00:00").toLocaleDateString(
                    "id-ID",
                    {
                      day: "numeric",
                      month: "long",
                    }
                  )}
                </p>
              </>
            )}
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500 rounded-xl">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-blue-900">Margin Profit</h3>
            </div>
            <p className="text-2xl font-black text-blue-700 mb-1">
              {totalPenjualan > 0
                ? ((totalLaba / totalPenjualan) * 100).toFixed(1)
                : 0}
              %
            </p>
            <p className="text-sm text-blue-600">
              Dari total penjualan 30 hari
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Penjualan30HariPage;
