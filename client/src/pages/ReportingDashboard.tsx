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

const COLORS = ["#ff006e", "#00d9ff", "#00ff41", "#ffbe0b", "#fb5607", "#9b5de5", "#15f5ba", "#ff8fab", "#00f5d4", "#fee440"];

export default function ReportingDashboard() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split("T")[0];
  });

  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadTrigger, setLoadTrigger] = useState(0);

  const reportQuery = trpc.analytics.generateReport.useQuery(
    { startDate: new Date(startDate), endDate: new Date(endDate) },
    { enabled: loadTrigger > 0 }
  );

  const bankPerformanceQuery = trpc.analytics.getBankPerformance.useQuery(
    undefined,
    { enabled: loadTrigger > 0 }
  );

  const dailyStatsQuery = trpc.analytics.getDailyStats.useQuery(
    { date: new Date(startDate) },
    { enabled: loadTrigger > 0 }
  );

  const hourlyStatsQuery = trpc.analytics.getHourlyStats.useQuery(
    { date: new Date(startDate) },
    { enabled: loadTrigger > 0 }
  );

  const operatorPerformanceQuery = trpc.analytics.getOperatorPerformance.useQuery(
    { startDate: new Date(startDate), endDate: new Date(endDate) },
    { enabled: loadTrigger > 0 }
  );

  const exportCSVQuery = trpc.analytics.exportOperatorPerformance.useQuery(
    { startDate: new Date(startDate), endDate: new Date(endDate), format: "csv" },
    { enabled: false }
  );

  const exportPDFQuery = trpc.analytics.exportOperatorPerformance.useQuery(
    { startDate: new Date(startDate), endDate: new Date(endDate), format: "pdf" },
    { enabled: false }
  );

  const handleLoadReport = async () => {
    setIsLoading(true);
    setLoadTrigger((n) => n + 1);
    try {
      await Promise.all([
        reportQuery.refetch(),
        bankPerformanceQuery.refetch(),
        dailyStatsQuery.refetch(),
        hourlyStatsQuery.refetch(),
        operatorPerformanceQuery.refetch(),
      ]);
    } catch (error) {
      console.error("Failed to load report:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: "csv" | "pdf") => {
    try {
      if (format === "csv") {
        const result = await exportCSVQuery.refetch();
        const data = result.data;
        if (!data) return;
        const blob = new Blob([data.content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Print-friendly HTML
        const win = window.open("", "_blank");
        if (!win) return;
        const dateStr = `${startDate} - ${endDate}`;
        const rows = (operatorData || []).flatMap((op: any) =>
          op.banks && op.banks.length > 0
            ? op.banks.map((b: any) => ({ name: op.operatorName, served: op.totalServed, avg: formatDuration(op.avgServiceTimeMs), bank: `Banko ${b.bankNumber}`, bankServed: b.count }))
            : [{ name: op.operatorName, served: op.totalServed, avg: formatDuration(op.avgServiceTimeMs), bank: "-", bankServed: 0 }]
        );
        const totalServed = (operatorData || []).reduce((s: number, op: any) => s + op.totalServed, 0);
        win.document.write(`
          <html>
          <head><title>Kullanici Performans Raporu</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #222; }
            h1 { font-size: 22px; margin-bottom: 5px; color: #c00; }
            .sub { font-size: 13px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th { background: #c00; color: #fff; padding: 8px 10px; text-align: left; }
            td { padding: 6px 10px; border-bottom: 1px solid #ddd; }
            tr:nth-child(even) td { background: #f9f9f9; }
            .footer { margin-top: 20px; font-size: 12px; color: #999; }
            .total { font-weight: bold; font-size: 14px; margin-top: 10px; }
            @media print { body { padding: 15px; } }
          </style>
          </head>
          <body>
            <h1>KULLANICI PERFORMANS RAPORU</h1>
            <div class="sub">Tarih: ${dateStr} | Toplam Hizmet: ${totalServed}</div>
            <table>
              <tr><th>Kullanici</th><th>Toplam Hizmet</th><th>Ortalama Sure</th><th>Calisilan Banko</th><th>Bankodaki Hizmet</th></tr>
              ${rows.map((r: any) => `<tr><td>${r.name}</td><td>${r.served}</td><td>${r.avg}</td><td>${r.bank}</td><td>${r.bankServed}</td></tr>`).join("")}
            </table>
            <div class="total">Toplam Hizmet: ${totalServed}</div>
            <div class="footer">Siramatik Sistemi - ${new Date().toLocaleString("tr-TR")}</div>
            <script>window.print()<\/script>
          </body>
          </html>
        `);
        win.document.close();
      }
    } catch (error) {
      console.error("Failed to export:", error);
    }
  };

  const data = reportQuery.data;
  const bankData = bankPerformanceQuery.data;
  const dailyData = dailyStatsQuery.data;
  const hourlyData = hourlyStatsQuery.data;
  const operatorData = operatorPerformanceQuery.data;

  const hasData = !!data && (data.totalTickets > 0 || data.totalServed > 0);

  return (
    <div className="w-full min-h-screen bg-background p-2 sm:p-3 md:p-4 lg:p-6 xl:p-8">
      {/* Header */}
      <div className="border-2 sm:border-3 md:border-4 border-primary p-3 sm:p-4 md:p-5 lg:p-6 mb-3 sm:mb-4 md:mb-6 relative">
        <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary" />
        <div className="absolute top-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary" />
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black" style={{ color: "#ff006e" }}>
          RAPORLAMA
        </h1>
        <p className="text-xs sm:text-sm md:text-base lg:text-lg mt-1" style={{ color: "#00d9ff" }}>
          Detaylı İstatistikler ve Analizler
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="border-2 sm:border-3 md:border-4 border-secondary p-3 sm:p-4 md:p-5 lg:p-6 mb-3 sm:mb-4 md:mb-6 relative">
        <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary" />
        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-black mb-3 sm:mb-4" style={{ color: "#00d9ff" }}>
          TARİH ARALIĞI
        </h2>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 items-stretch sm:items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-black mb-1" style={{ color: "#00d9ff" }}>
              Başlangıç
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-2 sm:border-3 md:border-4 border-primary bg-card text-foreground font-black text-xs sm:text-sm w-full"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-black mb-1" style={{ color: "#00d9ff" }}>
              Bitiş
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-2 sm:border-3 md:border-4 border-primary bg-card text-foreground font-black text-xs sm:text-sm w-full"
            />
          </div>
          <Button
            onClick={handleLoadReport}
            disabled={isLoading}
            className="h-9 sm:h-10 md:h-11 lg:h-12 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-2 sm:border-3 md:border-4 border-primary text-xs sm:text-sm md:text-base touch-manipulation px-4 sm:px-6 shrink-0"
          >
            {isLoading ? "YÜKLENİYOR..." : "RAPOR YÜKLE"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {hasData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-6">
          <SummaryCard label="Toplam Bilet" value={data.totalTickets} color="#ff006e" />
          <SummaryCard label="Hizmet Verilen" value={data.totalServed} color="#00ff41" />
          <SummaryCard label="Ort. Bekleme" value={formatDuration(data.avgWaitTime || 0)} color="#00d9ff" />
          <SummaryCard label="Ort. Hizmet" value={formatDuration(data.avgServiceTime || 0)} color="#ffbe0b" />
        </div>
      )}

      {/* Charts */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-3 sm:mb-4 md:mb-6">
          {/* Daily Stats */}
          {dailyData && dailyData.length > 0 && (
            <ChartCard title="GÜNLÜK İSTATİSTİKLER" color="#ff006e">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#00d9ff" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#00d9ff" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#000", border: "2px solid #ff006e", fontSize: 10 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="ticketCount" stroke="#ff006e" strokeWidth={2} name="Bilet" dot={false} />
                  <Line type="monotone" dataKey="servedCount" stroke="#00ff41" strokeWidth={2} name="Hizmet" dot={false} />
                  <Line type="monotone" dataKey="noShowCount" stroke="#fb5607" strokeWidth={2} name="NoShow" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Hourly Stats */}
          {hourlyData && hourlyData.length > 0 && (
            <ChartCard title="SAATLİK DAĞILIM" color="#00d9ff">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="hour" stroke="#00d9ff" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#00d9ff" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#000", border: "2px solid #00d9ff", fontSize: 10 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="ticketCount" fill="#ff006e" name="Bilet" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Bank Performance Bar Chart */}
          {bankData && bankData.length > 0 && (
            <ChartCard title="BANKO HİZMET SAYISI" color="#00ff41">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bankData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="bankNumber" stroke="#00d9ff" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#00d9ff" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#000", border: "2px solid #00ff41", fontSize: 10 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="totalServed" fill="#00ff41" name="Hizmet" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Bank Performance Pie Chart */}
          {bankData && bankData.length > 0 && (
            <ChartCard title="BANKO YÜZDE DAĞILIM" color="#ffbe0b">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={bankData}
                    dataKey="totalServed"
                    nameKey="bankNumber"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ bankNumber, percent }) => `${bankNumber} (%${(percent * 100).toFixed(0)})`}
                    labelLine={true}
                  >
                    {bankData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#000", border: "2px solid #ffbe0b", fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {/* Bank Performance Cards */}
      {bankData && bankData.length > 0 && (
        <div className="border-2 sm:border-3 md:border-4 border-primary p-3 sm:p-4 md:p-5 lg:p-6 mb-4 relative">
          <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary" />
          <div className="absolute top-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary" />
          <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-black mb-3 sm:mb-4 md:mb-5" style={{ color: "#ff006e" }}>
            BANKO PERFORMANSI
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
            {bankData.map((bank: any, idx: number) => (
              <div key={bank.bankId || idx} className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-4" style={{ borderColor: COLORS[idx % COLORS.length] }}>
                <h3 className="text-sm sm:text-base md:text-lg font-black mb-2" style={{ color: COLORS[idx % COLORS.length] }}>
                  BANKO {bank.bankNumber}
                </h3>
                <div className="space-y-1 text-xs sm:text-sm">
                  <MetricRow label="Hizmet" value={bank.totalServed} color="#ffffff" />
                  <MetricRow label="Ortalama" value={formatDuration(bank.avgServiceTime)} color="#00ff41" />
                  <MetricRow label="En Uzun" value={formatDuration(bank.maxServiceTime)} color="#ffbe0b" />
                  <MetricRow label="En Kısa" value={formatDuration(bank.minServiceTime)} color="#00d9ff" />
                  <MetricRow label="Durum" value={bank.isActive ? "AKTİF" : "PASİF"} color={bank.isActive ? "#00ff41" : "#ff006e"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operator Performance */}
      {operatorData && operatorData.length > 0 && (
        <div className="border-2 sm:border-3 md:border-4 border-primary p-3 sm:p-4 md:p-5 lg:p-6 mb-4 relative">
          <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary" />
          <div className="absolute top-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary" />
          <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-5 flex-wrap gap-2">
            <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-black" style={{ color: "#fb5607" }}>
              KULLANICI PERFORMANSI
            </h2>
            <div className="flex gap-2">
              <Button onClick={() => handleExport("csv")} disabled={exportCSVQuery.isFetching} className="h-8 px-3 font-black text-xs bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-primary">
                {exportCSVQuery.isFetching ? "..." : "CSV"}
              </Button>
              <Button onClick={() => handleExport("pdf")} disabled={exportPDFQuery.isFetching} className="h-8 px-3 font-black text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground border-2 border-destructive">
                {exportPDFQuery.isFetching ? "..." : "PDF"}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {operatorData.map((op: any, idx: number) => (
              <div key={op.operatorId || idx} className="border-2 sm:border-3 md:border-4 p-2 sm:p-3 md:p-4" style={{ borderColor: COLORS[idx % COLORS.length] }}>
                <h3 className="text-sm sm:text-base md:text-lg font-black mb-2" style={{ color: COLORS[idx % COLORS.length] }}>
                  {op.operatorName}
                </h3>
                <div className="space-y-1 text-xs sm:text-sm">
                  <MetricRow label="Hizmet" value={op.totalServed} color="#ffffff" />
                  <MetricRow label="Ortalama" value={formatDuration(op.avgServiceTimeMs)} color="#00ff41" />
                </div>
                {op.banks && op.banks.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-foreground/20">
                    <p className="text-[10px] text-foreground/60 mb-1">Çalışılan Bankolar:</p>
                    {op.banks.map((b: any, bi: number) => (
                      <div key={bi} className="flex justify-between items-center text-[10px] sm:text-xs">
                        <span className="text-foreground/60">Banko {b.bankNumber}</span>
                        <span className="font-bold" style={{ color: COLORS[(idx + bi + 1) % COLORS.length] }}>{b.count} müşteri</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasData && loadTrigger > 0 && (
        <div className="border-2 sm:border-3 md:border-4 border-secondary p-6 sm:p-8 md:p-12 text-center">
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-black mb-2" style={{ color: "#ff006e" }}>
            VERİ BULUNAMADI
          </p>
          <p className="text-xs sm:text-sm md:text-base text-foreground/60">
            Seçilen tarih aralığında kayıt bulunamadı
          </p>
        </div>
      )}

      {!hasData && loadTrigger === 0 && (
        <div className="border-2 sm:border-3 md:border-4 border-secondary p-6 sm:p-8 md:p-12 text-center">
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-black mb-2" style={{ color: "#ff006e" }}>
            RAPOR YÜKLENMEDİ
          </p>
          <p className="text-xs sm:text-sm md:text-base text-foreground/60">
            Tarih aralığı seçip "RAPOR YÜKLE" butonuna tıklayın
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-4 lg:p-5 relative">
      <div className="absolute top-0 left-0 w-1 sm:w-2 md:w-3 h-1 sm:h-2 md:h-3 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary" />
      <p className="text-[10px] sm:text-xs md:text-sm text-foreground/60 mb-0.5 sm:mb-1">{label}</p>
      <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-black leading-tight" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function ChartCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-4 lg:p-5">
      <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-black mb-2 sm:mb-3" style={{ color }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-foreground/60 shrink-0">{label}:</span>
      <span className="font-black text-right truncate" style={{ color }}>{value}</span>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0s";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}
