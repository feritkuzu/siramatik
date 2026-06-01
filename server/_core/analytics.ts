/**
 * Veri Analitikleri Servisi
 * 
 * Raporlama ve istatistik hesaplamaları
 */

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface BankPerformance {
  bankId: number;
  bankNumber: number;
  totalServed: number;
  avgServiceTime: number;
  maxServiceTime: number;
  minServiceTime: number;
}

export interface HourlyStats {
  hour: number;
  ticketCount: number;
  avgWaitTime: number;
  avgServiceTime: number;
}

export interface DailyStats {
  date: string;
  ticketCount: number;
  servedCount: number;
  avgWaitTime: number;
  avgServiceTime: number;
  peakHour: number;
}

export interface AnalyticsReport {
  dateRange: DateRange;
  totalTickets: number;
  totalServed: number;
  avgWaitTime: number;
  avgServiceTime: number;
  maxWaitTime: number;
  peakHour: number;
  bankPerformance: BankPerformance[];
  dailyStats: DailyStats[];
  hourlyStats: HourlyStats[];
}

/**
 * Tarih aralığında ortalama bekleme süresi hesapla
 */
export function calculateAverageWaitTime(
  queueEntries: any[],
  startDate: Date,
  endDate: Date
): number {
  const filtered = queueEntries.filter((entry) => {
    const entryDate = new Date(entry.createdAt);
    return entryDate >= startDate && entryDate <= endDate;
  });

  if (filtered.length === 0) return 0;

  const totalWaitTime = filtered.reduce((sum, entry) => {
    const createdAt = new Date(entry.createdAt).getTime();
    const calledAt = entry.calledAt ? new Date(entry.calledAt).getTime() : createdAt;
    return sum + (calledAt - createdAt);
  }, 0);

  return Math.round(totalWaitTime / filtered.length);
}

/**
 * Tarih aralığında ortalama hizmet süresi hesapla
 */
export function calculateAverageServiceTime(
  queueEntries: any[],
  startDate: Date,
  endDate: Date
): number {
  const filtered = queueEntries.filter((entry) => {
    const entryDate = new Date(entry.createdAt);
    return entryDate >= startDate && entryDate <= endDate && entry.completedAt;
  });

  if (filtered.length === 0) return 0;

  const totalServiceTime = filtered.reduce((sum, entry) => {
    const calledAt = entry.calledAt ? new Date(entry.calledAt).getTime() : new Date(entry.createdAt).getTime();
    const completedAt = new Date(entry.completedAt).getTime();
    return sum + (completedAt - calledAt);
  }, 0);

  return Math.round(totalServiceTime / filtered.length);
}

/**
 * Maksimum bekleme süresi hesapla
 */
export function calculateMaxWaitTime(
  queueEntries: any[],
  startDate: Date,
  endDate: Date
): number {
  const filtered = queueEntries.filter((entry) => {
    const entryDate = new Date(entry.createdAt);
    return entryDate >= startDate && entryDate <= endDate;
  });

  if (filtered.length === 0) return 0;

  const waitTimes = filtered.map((entry) => {
    const createdAt = new Date(entry.createdAt).getTime();
    const calledAt = entry.calledAt ? new Date(entry.calledAt).getTime() : createdAt;
    return calledAt - createdAt;
  });

  return Math.round(Math.max(...waitTimes));
}

/**
 * Yoğun saati bulma
 */
export function findPeakHour(
  queueEntries: any[],
  startDate: Date,
  endDate: Date
): number {
  const filtered = queueEntries.filter((entry) => {
    const entryDate = new Date(entry.createdAt);
    return entryDate >= startDate && entryDate <= endDate;
  });

  const hourCounts: Record<number, number> = {};

  filtered.forEach((entry) => {
    const hour = new Date(entry.createdAt).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  let peakHour = 0;
  let maxCount = 0;

  Object.entries(hourCounts).forEach(([hour, count]) => {
    if (count > maxCount) {
      maxCount = count;
      peakHour = parseInt(hour);
    }
  });

  return peakHour;
}

/**
 * Saatlik istatistikleri hesapla
 */
export function calculateHourlyStats(
  queueEntries: any[],
  startDate: Date,
  endDate: Date
): HourlyStats[] {
  const hourlyData: Record<number, any> = {};

  // 0-23 saatler için başlat
  for (let hour = 0; hour < 24; hour++) {
    hourlyData[hour] = {
      hour,
      tickets: [],
    };
  }

  // Verileri saat başına grupla
  queueEntries.forEach((entry) => {
    const entryDate = new Date(entry.createdAt);
    if (entryDate >= startDate && entryDate <= endDate) {
      const hour = entryDate.getHours();
      hourlyData[hour].tickets.push(entry);
    }
  });

  // İstatistikleri hesapla
  return Object.values(hourlyData).map((data) => {
    const tickets = data.tickets as any[];
    const ticketCount = tickets.length;

    const avgWaitTime = tickets.length > 0
      ? Math.round(
          tickets.reduce((sum, t) => {
            const created = new Date(t.createdAt).getTime();
            const called = t.calledAt ? new Date(t.calledAt).getTime() : created;
            return sum + (called - created);
          }, 0) / tickets.length
        )
      : 0;

    const completedTickets = tickets.filter((t) => t.completedAt);
    const avgServiceTime = completedTickets.length > 0
      ? Math.round(
          completedTickets.reduce((sum, t) => {
            const called = t.calledAt ? new Date(t.calledAt).getTime() : new Date(t.createdAt).getTime();
            const completed = new Date(t.completedAt).getTime();
            return sum + (completed - called);
          }, 0) / completedTickets.length
        )
      : 0;

    return {
      hour: data.hour,
      ticketCount,
      avgWaitTime,
      avgServiceTime,
    };
  });
}

/**
 * Günlük istatistikleri hesapla
 */
export function calculateDailyStats(
  queueEntries: any[],
  startDate: Date,
  endDate: Date
): DailyStats[] {
  const dailyData: Record<string, any> = {};

  // Tarih aralığındaki tüm günleri başlat
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toLocaleDateString("tr-TR");
    dailyData[dateStr] = {
      date: dateStr,
      tickets: [],
    };
    current.setDate(current.getDate() + 1);
  }

  // Verileri güne göre grupla
  queueEntries.forEach((entry) => {
    const entryDate = new Date(entry.createdAt);
    if (entryDate >= startDate && entryDate <= endDate) {
      const dateStr = entryDate.toLocaleDateString("tr-TR");
      if (dailyData[dateStr]) {
        dailyData[dateStr].tickets.push(entry);
      }
    }
  });

  // İstatistikleri hesapla
  return Object.values(dailyData).map((data) => {
    const tickets = data.tickets as any[];
    const ticketCount = tickets.length;
    const servedCount = tickets.filter((t) => t.completedAt).length;

    const avgWaitTime = tickets.length > 0
      ? Math.round(
          tickets.reduce((sum, t) => {
            const created = new Date(t.createdAt).getTime();
            const called = t.calledAt ? new Date(t.calledAt).getTime() : created;
            return sum + (called - created);
          }, 0) / tickets.length
        )
      : 0;

    const completedTickets = tickets.filter((t) => t.completedAt);
    const avgServiceTime = completedTickets.length > 0
      ? Math.round(
          completedTickets.reduce((sum, t) => {
            const called = t.calledAt ? new Date(t.calledAt).getTime() : new Date(t.createdAt).getTime();
            const completed = new Date(t.completedAt).getTime();
            return sum + (completed - called);
          }, 0) / completedTickets.length
        )
      : 0;

    // Bu gün için yoğun saati bul
    const hourCounts: Record<number, number> = {};
    tickets.forEach((t) => {
      const hour = new Date(t.createdAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    let peakHour = 0;
    let maxCount = 0;
    Object.entries(hourCounts).forEach(([hour, count]) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = parseInt(hour);
      }
    });

    return {
      date: data.date,
      ticketCount,
      servedCount,
      avgWaitTime,
      avgServiceTime,
      peakHour,
    };
  });
}

/**
 * Banka performans analizi
 */
export function calculateBankPerformance(
  banks: any[],
  queueEntries: any[],
  startDate: Date,
  endDate: Date
): BankPerformance[] {
  return banks.map((bank) => {
    const bankTickets = queueEntries.filter((entry) => {
      const entryDate = new Date(entry.createdAt);
      return (
        entryDate >= startDate &&
        entryDate <= endDate &&
        entry.bankId === bank.id &&
        entry.completedAt
      );
    });

    const serviceTimes = bankTickets.map((t) => {
      const called = t.calledAt ? new Date(t.calledAt).getTime() : new Date(t.createdAt).getTime();
      const completed = new Date(t.completedAt).getTime();
      return completed - called;
    });

    const avgServiceTime = serviceTimes.length > 0
      ? Math.round(serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length)
      : 0;

    const maxServiceTime = serviceTimes.length > 0 ? Math.round(Math.max(...serviceTimes)) : 0;
    const minServiceTime = serviceTimes.length > 0 ? Math.round(Math.min(...serviceTimes)) : 0;

    return {
      bankId: bank.id,
      bankNumber: bank.bankNumber,
      totalServed: bankTickets.length,
      avgServiceTime,
      maxServiceTime,
      minServiceTime,
    };
  });
}

/**
 * Tam analitik raporu oluştur
 */
export function generateAnalyticsReport(
  banks: any[],
  queueEntries: any[],
  startDate: Date,
  endDate: Date
): AnalyticsReport {
  const totalTickets = queueEntries.filter((entry) => {
    const entryDate = new Date(entry.createdAt);
    return entryDate >= startDate && entryDate <= endDate;
  }).length;

  const totalServed = queueEntries.filter((entry) => {
    const entryDate = new Date(entry.createdAt);
    return entryDate >= startDate && entryDate <= endDate && entry.completedAt;
  }).length;

  return {
    dateRange: { startDate, endDate },
    totalTickets,
    totalServed,
    avgWaitTime: calculateAverageWaitTime(queueEntries, startDate, endDate),
    avgServiceTime: calculateAverageServiceTime(queueEntries, startDate, endDate),
    maxWaitTime: calculateMaxWaitTime(queueEntries, startDate, endDate),
    peakHour: findPeakHour(queueEntries, startDate, endDate),
    bankPerformance: calculateBankPerformance(banks, queueEntries, startDate, endDate),
    dailyStats: calculateDailyStats(queueEntries, startDate, endDate),
    hourlyStats: calculateHourlyStats(queueEntries, startDate, endDate),
  };
}


/**
 * KPI Metrikleri
 */
export interface KPIMetrics {
  serviceEfficiency: number;
  averageWaitTimeMinutes: number;
  averageServiceTimeMinutes: number;
  peakHourTickets: number;
  bestPerformingBank: { bankNumber: number; efficiency: number };
  worstPerformingBank: { bankNumber: number; efficiency: number };
  dailyAverageTickets: number;
}

/**
 * Trend Analizi
 */
export interface TrendAnalysis {
  waitTimeTrend: "improving" | "declining" | "stable";
  serviceTimeTrend: "improving" | "declining" | "stable";
  volumeTrend: "increasing" | "decreasing" | "stable";
  recommendations: string[];
}

/**
 * KPI metrikleri hesapla
 */
export function calculateKPIMetrics(
  banks: any[],
  queueEntries: any[],
  startDate: Date,
  endDate: Date
): KPIMetrics {
  const filteredEntries = queueEntries.filter((entry) => {
    const entryDate = new Date(entry.createdAt);
    return entryDate >= startDate && entryDate <= endDate;
  });

  const totalTickets = filteredEntries.length;
  const servedTickets = filteredEntries.filter((e) => e.completedAt).length;
  const serviceEfficiency = totalTickets > 0 ? (servedTickets / totalTickets) * 100 : 0;

  const avgWaitTime = calculateAverageWaitTime(queueEntries, startDate, endDate);
  const avgServiceTime = calculateAverageServiceTime(queueEntries, startDate, endDate);

  const peakHour = findPeakHour(queueEntries, startDate, endDate);
  const peakHourTickets = filteredEntries.filter(
    (e) => new Date(e.createdAt).getHours() === peakHour
  ).length;

  const bankPerformance = calculateBankPerformance(banks, queueEntries, startDate, endDate);
  const bestBank = bankPerformance.reduce((best, current) =>
    current.totalServed > best.totalServed ? current : best
  );
  const worstBank = bankPerformance.reduce((worst, current) =>
    current.totalServed < worst.totalServed ? current : worst
  );

  const dayCount = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const dailyAverageTickets = Math.round(totalTickets / dayCount);

  return {
    serviceEfficiency: Math.round(serviceEfficiency * 100) / 100,
    averageWaitTimeMinutes: Math.round(avgWaitTime / 60000),
    averageServiceTimeMinutes: Math.round(avgServiceTime / 60000),
    peakHourTickets,
    bestPerformingBank: {
      bankNumber: bestBank.bankNumber,
      efficiency: Math.round((bestBank.totalServed / totalTickets) * 100 * 100) / 100,
    },
    worstPerformingBank: {
      bankNumber: worstBank.bankNumber,
      efficiency: Math.round((worstBank.totalServed / totalTickets) * 100 * 100) / 100,
    },
    dailyAverageTickets,
  };
}

/**
 * Trend analizi yap
 */
export function analyzeTrends(
  queueEntries: any[],
  startDate: Date,
  endDate: Date
): TrendAnalysis {
  const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);

  const firstHalfWaitTime = calculateAverageWaitTime(queueEntries, startDate, midDate);
  const secondHalfWaitTime = calculateAverageWaitTime(queueEntries, midDate, endDate);

  const firstHalfServiceTime = calculateAverageServiceTime(queueEntries, startDate, midDate);
  const secondHalfServiceTime = calculateAverageServiceTime(queueEntries, midDate, endDate);

  const firstHalfVolume = queueEntries.filter((e) => {
    const date = new Date(e.createdAt);
    return date >= startDate && date <= midDate;
  }).length;

  const secondHalfVolume = queueEntries.filter((e) => {
    const date = new Date(e.createdAt);
    return date >= midDate && date <= endDate;
  }).length;

  const waitTimeTrend =
    secondHalfWaitTime < firstHalfWaitTime * 0.95
      ? "improving"
      : secondHalfWaitTime > firstHalfWaitTime * 1.05
        ? "declining"
        : "stable";

  const serviceTimeTrend =
    secondHalfServiceTime < firstHalfServiceTime * 0.95
      ? "improving"
      : secondHalfServiceTime > firstHalfServiceTime * 1.05
        ? "declining"
        : "stable";

  const volumeTrend =
    secondHalfVolume > firstHalfVolume * 1.05
      ? "increasing"
      : secondHalfVolume < firstHalfVolume * 0.95
        ? "decreasing"
        : "stable";

  const recommendations: string[] = [];

  if (waitTimeTrend === "declining") {
    recommendations.push("Bekleme süresi artıyor. Banko sayısını artırmayı düşünün.");
  }
  if (serviceTimeTrend === "declining") {
    recommendations.push("Hizmet süresi artıyor. Personel eğitimi veya iş akışı iyileştirmesi gerekebilir.");
  }
  if (volumeTrend === "increasing") {
    recommendations.push("Müşteri sayısı artıyor. Sistem kapasitesini gözlemleyin.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Sistem performansı normal. Mevcut ayarları devam ettirin.");
  }

  return {
    waitTimeTrend,
    serviceTimeTrend,
    volumeTrend,
    recommendations,
  };
}
