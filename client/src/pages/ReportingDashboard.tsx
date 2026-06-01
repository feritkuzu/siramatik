import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function ReportingDashboard() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split("T")[0];
  });

  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);

  // Analytics queries
  const reportQuery = trpc.analytics.generateReport.useQuery(
    { startDate: new Date(startDate), endDate: new Date(endDate) },
    { enabled: false }
  );

  const bankPerformanceQuery = trpc.analytics.getBankPerformance.useQuery(
    undefined,
    { enabled: false }
  );

  const dailyStatsQuery = trpc.analytics.getDailyStats.useQuery(
    { date: new Date(startDate) },
    { enabled: false }
  );

  const hourlyStatsQuery = trpc.analytics.getHourlyStats.useQuery(
    { date: new Date(startDate) },
    { enabled: false }
  );

  const handleLoadReport = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        reportQuery.refetch(),
        bankPerformanceQuery.refetch(),
        dailyStatsQuery.refetch(),
        hourlyStatsQuery.refetch(),
      ]);
    } catch (error) {
      console.error("Failed to load report:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = ["#ff006e", "#00d9ff", "#00ff41", "#ffbe0b", "#fb5607"];

  return (
    <div className="w-full min-h-screen bg-background p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="border-2 sm:border-3 md:border-4 border-primary p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 md:mb-8 relative">
        <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary" />
        <div className="absolute top-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary" />
        <h1
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-1 sm:mb-2"
          style={{ color: "#ff006e", textShadow: "0 0 10px #ff006e" }}
        >
          RAPORLAMA DASHBOARD
        </h1>
        <p className="text-xs sm:text-sm md:text-base lg:text-lg" style={{ color: "#00d9ff", textShadow: "0 0 10px #00d9ff" }}>
          Detaylı İstatistikler ve Analizler
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="border-2 sm:border-3 md:border-4 border-secondary p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 md:mb-8 relative">
        <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary" />
        <h2
          className="text-sm sm:text-base md:text-lg lg:text-2xl font-black mb-3 sm:mb-4"
          style={{ color: "#00d9ff", textShadow: "0 0 10px #00d9ff" }}
        >
          TARİH ARALIGI SEÇ
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 items-end">
          <div>
            <label className="block text-xs sm:text-sm font-black mb-1 sm:mb-2" style={{ color: "#00d9ff" }}>
              Başlangıç Tarihi
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-2 sm:border-3 md:border-4 border-primary bg-card text-foreground font-black text-xs sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-black mb-1 sm:mb-2" style={{ color: "#00d9ff" }}>
              Bitiş Tarihi
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-2 sm:border-3 md:border-4 border-primary bg-card text-foreground font-black text-xs sm:text-sm"
            />
          </div>
          <Button
            onClick={handleLoadReport}
            disabled={isLoading}
            className="h-8 sm:h-10 md:h-12 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-2 sm:border-3 md:border-4 border-primary text-xs sm:text-sm md:text-base touch-manipulation"
          >
            {isLoading ? "YÜKLENİYOR..." : "RAPOR YÜKLE"}
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      {reportQuery.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
            {/* Total Tickets */}
            <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-6 relative">
              <div className="absolute top-0 left-0 w-1 sm:w-2 md:w-4 h-1 sm:h-2 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary" />
              <p className="text-xs sm:text-sm text-foreground/60 mb-1 sm:mb-2">Toplam Bilet</p>
              <p
                className="text-xl sm:text-2xl md:text-4xl font-black"
                style={{ color: "#ff006e", textShadow: "0 0 10px #ff006e" }}
              >
                {reportQuery.data.totalTickets}
              </p>
            </div>

            {/* Served Count */}
            <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-6 relative">
              <div className="absolute top-0 left-0 w-1 sm:w-2 md:w-4 h-1 sm:h-2 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary" />
              <p className="text-xs sm:text-sm text-foreground/60 mb-1 sm:mb-2">Hizmet Verilen</p>
              <p
                className="text-xl sm:text-2xl md:text-4xl font-black"
                style={{ color: "#00ff41", textShadow: "0 0 10px #00ff41" }}
              >
                {reportQuery.data.totalServed}
              </p>
            </div>

            {/* Avg Wait Time */}
            <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-6 relative">
              <div className="absolute top-0 left-0 w-1 sm:w-2 md:w-4 h-1 sm:h-2 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary" />
              <p className="text-xs sm:text-sm text-foreground/60 mb-1 sm:mb-2">Ort. Bekleme</p>
              <p
                className="text-xl sm:text-2xl md:text-4xl font-black"
                style={{ color: "#00d9ff", textShadow: "0 0 10px #00d9ff" }}
              >
                {Math.round(reportQuery.data.avgWaitTime / 1000)}s
              </p>
            </div>

            {/* Avg Service Time */}
            <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-6 relative">
              <div className="absolute top-0 left-0 w-1 sm:w-2 md:w-4 h-1 sm:h-2 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary" />
              <p className="text-xs sm:text-sm text-foreground/60 mb-1 sm:mb-2">Ort. Hizmet</p>
              <p
                className="text-xl sm:text-2xl md:text-4xl font-black"
                style={{ color: "#ffbe0b", textShadow: "0 0 10px #ffbe0b" }}
              >
                {Math.round(reportQuery.data.avgServiceTime / 1000)}s
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 lg:gap-8 mb-4 sm:mb-6 md:mb-8">
            {/* Daily Statistics Chart */}
            {dailyStatsQuery.data && dailyStatsQuery.data.length > 0 && (
              <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-6">
                <h3
                  className="text-sm sm:text-base md:text-lg lg:text-xl font-black mb-2 sm:mb-3 md:mb-4"
                  style={{ color: "#ff006e", textShadow: "0 0 10px #ff006e" }}
                >
                  GÜNLÜK İSTATİSTİKLER
                </h3>
                <ResponsiveContainer width="100%" height={200} minHeight={200}>
                  <LineChart data={dailyStatsQuery.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                      dataKey="date"
                      stroke="#00d9ff"
                      style={{ fontSize: "10px" }}
                    />
                    <YAxis stroke="#00d9ff" style={{ fontSize: "10px" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#000",
                        border: "2px solid #ff006e",
                        fontSize: "10px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                    <Line
                      type="monotone"
                      dataKey="ticketCount"
                      stroke="#ff006e"
                      strokeWidth={2}
                      name="Bilet Sayısı"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="servedCount"
                      stroke="#00ff41"
                      strokeWidth={2}
                      name="Hizmet Verilen"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Hourly Statistics Chart */}
            {hourlyStatsQuery.data && hourlyStatsQuery.data.length > 0 && (
              <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-6">
                <h3
                  className="text-sm sm:text-base md:text-lg lg:text-xl font-black mb-2 sm:mb-3 md:mb-4"
                  style={{ color: "#00d9ff", textShadow: "0 0 10px #00d9ff" }}
                >
                  SAATLİK İSTATİSTİKLER
                </h3>
                <ResponsiveContainer width="100%" height={200} minHeight={200}>
                  <BarChart data={hourlyStatsQuery.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                      dataKey="hour"
                      stroke="#00d9ff"
                      style={{ fontSize: "10px" }}
                    />
                    <YAxis stroke="#00d9ff" style={{ fontSize: "10px" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#000",
                        border: "2px solid #00d9ff",
                        fontSize: "10px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                    <Bar
                      dataKey="ticketCount"
                      fill="#ff006e"
                      name="Bilet Sayısı"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bank Performance */}
          {bankPerformanceQuery.data && bankPerformanceQuery.data.length > 0 && (
            <div className="border-2 sm:border-3 md:border-4 border-primary p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 md:mb-8 relative">
              <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary" />
              <div className="absolute top-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary" />
              <h2
                className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black mb-3 sm:mb-4 md:mb-6"
                style={{ color: "#ff006e", textShadow: "0 0 10px #ff006e" }}
              >
                BANKO PERFORMANSI
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                {bankPerformanceQuery.data.map((bank: any) => (
                  <div key={bank.bankId} className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-4">
                    <h3
                      className="text-sm sm:text-base md:text-lg font-black mb-2 sm:mb-3"
                      style={{ color: "#00d9ff", textShadow: "0 0 10px #00d9ff" }}
                    >
                      BANKO {bank.bankNumber}
                    </h3>
                    <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                      <div>
                        <span className="text-foreground/60">Hizmet:</span>
                        <span className="ml-2 font-black text-foreground">
                          {bank.totalServed}
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground/60">Ort.:</span>
                        <span className="ml-2 font-black" style={{ color: "#00ff41" }}>
                          {Math.round(bank.avgServiceTime / 1000)}s
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground/60">Maks.:</span>
                        <span className="ml-2 font-black" style={{ color: "#ffbe0b" }}>
                          {Math.round(bank.maxServiceTime / 1000)}s
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground/60">Min.:</span>
                        <span className="ml-2 font-black" style={{ color: "#fb5607" }}>
                          {Math.round(bank.minServiceTime / 1000)}s
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!reportQuery.data && (
        <div className="border-2 sm:border-3 md:border-4 border-secondary p-6 sm:p-8 md:p-12 text-center">
          <p
            className="text-lg sm:text-xl md:text-2xl font-black mb-2 sm:mb-3 md:mb-4"
            style={{ color: "#ff006e", textShadow: "0 0 10px #ff006e" }}
          >
            RAPOR YÜKLEMEDİ
          </p>
          <p className="text-xs sm:text-sm md:text-base text-foreground/60">
            Tarih aralığı seçip "RAPOR YÜKLE" butonuna tıklayın
          </p>
        </div>
      )}
    </div>
  );
}
