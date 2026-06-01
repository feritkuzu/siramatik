/**
 * Dışa Aktarma Servisleri
 * 
 * CSV ve PDF formatında raporlar oluşturur
 */

import { PDFDocument, rgb } from "pdf-lib";

export interface ExportOptions {
  title: string;
  filename: string;
  columns: string[];
  data: Record<string, any>[];
}

/**
 * CSV formatında veri dışa aktarma
 */
export function generateCSV(options: ExportOptions): string {
  const { columns, data } = options;

  // Header satırı
  const header = columns.join(",");

  // Veri satırları
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const value = row[col] ?? "";
        // CSV'de virgül ve tırnak içeren değerleri escape et
        const stringValue = String(value);
        if (stringValue.includes(",") || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * PDF formatında veri dışa aktarma (ASCII karakterler ile)
 */
export async function generatePDF(options: ExportOptions): Promise<Buffer> {
  const { title, columns, data } = options;

  // PDF belgesi oluştur
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 boyutu

  const { height } = page.getSize();
  let yPosition = height - 50;

  // Başlık (ASCII karakterler kullan)
  page.drawText(title.substring(0, 50), {
    x: 50,
    y: yPosition,
    size: 16,
    color: rgb(1, 0.42, 0.88), // Neon pembe
  });

  yPosition -= 30;

  // Tarih (ASCII karakterler kullan)
  const now = new Date().toISOString().substring(0, 10);
  page.drawText(`Report Date: ${now}`, {
    x: 50,
    y: yPosition,
    size: 10,
    color: rgb(0, 0.85, 1), // Neon mavi
  });

  yPosition -= 20;

  // Tablo başlığı
  const columnWidth = (595 - 100) / columns.length;
  let xPosition = 50;

  page.drawText("-".repeat(80), {
    x: 50,
    y: yPosition,
    size: 8,
    color: rgb(0.5, 0.5, 0.5),
  });

  yPosition -= 15;

  // Sütun başlıkları (ASCII)
  columns.forEach((col) => {
    page.drawText(col.substring(0, 20), {
      x: xPosition,
      y: yPosition,
      size: 10,
      color: rgb(1, 1, 1),
    });
    xPosition += columnWidth;
  });

  yPosition -= 15;

  page.drawText("-".repeat(80), {
    x: 50,
    y: yPosition,
    size: 8,
    color: rgb(0.5, 0.5, 0.5),
  });

  yPosition -= 15;

  // Veri satırları
  data.forEach((row) => {
    // Sayfa sonu kontrolü
    if (yPosition < 50) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
    }

    xPosition = 50;
    columns.forEach((col) => {
      const value = String(row[col] ?? "");
      // Uzun metinleri kes ve ASCII karakterlere dönüştür
      const truncated = value.length > 20 ? value.substring(0, 20) + "..." : value;

      page.drawText(truncated, {
        x: xPosition,
        y: yPosition,
        size: 9,
        color: rgb(0.9, 0.9, 0.9),
      });
      xPosition += columnWidth;
    });

    yPosition -= 15;
  });

  // Footer
  yPosition -= 10;
  page.drawText("-".repeat(80), {
    x: 50,
    y: yPosition,
    size: 8,
    color: rgb(0.5, 0.5, 0.5),
  });

  yPosition -= 15;

  page.drawText(`Total Records: ${data.length}`, {
    x: 50,
    y: yPosition,
    size: 9,
    color: rgb(0.7, 0.7, 0.7),
  });

  // PDF'i buffer'a dönüştür
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * İstatistik raporunu CSV formatında oluştur
 */
export function generateStatisticsCSV(stats: Record<string, any>): string {
  const rows = Object.entries(stats).map(([key, value]) => {
    return `"${key}","${value}"`;
  });

  return ['Metric,Value', ...rows].join("\n");
}

/**
 * İstatistik raporunu PDF formatında oluştur (ASCII karakterler ile)
 */
export async function generateStatisticsPDF(
  stats: Record<string, any>,
  title: string = "Statistics Report"
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 boyutu
  const { height } = page.getSize();

  let yPosition = height - 50;

  // Başlık (ASCII)
  page.drawText(title.substring(0, 50), {
    x: 50,
    y: yPosition,
    size: 18,
    color: rgb(1, 0.42, 0.88), // Neon pembe
  });

  yPosition -= 40;

  // Tarih (ASCII)
  const now = new Date().toISOString().substring(0, 10);
  page.drawText(`Report Date: ${now}`, {
    x: 50,
    y: yPosition,
    size: 10,
    color: rgb(0, 0.85, 1), // Neon mavi
  });

  yPosition -= 30;

  // İstatistikler (ASCII)
  Object.entries(stats).forEach(([key, value]) => {
    if (yPosition < 100) {
      // Yeni sayfa ekle
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
      page.drawText(key.substring(0, 40), {
        x: 50,
        y: yPosition,
        size: 11,
        color: rgb(1, 1, 1),
      });
    } else {
      page.drawText(key.substring(0, 40), {
        x: 50,
        y: yPosition,
        size: 11,
        color: rgb(1, 1, 1),
      });
    }

    page.drawText(`: ${String(value).substring(0, 40)}`, {
      x: 250,
      y: yPosition,
      size: 11,
      color: rgb(0.9, 0.9, 0.9),
    });

    yPosition -= 20;
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Dosya adı oluştur (tarih ile)
 */
export function generateFilename(prefix: string, extension: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${prefix}_${year}${month}${day}_${hours}${minutes}.${extension}`;
}

/**
 * Tarih aralığında verileri filtrele
 */
export function filterByDateRange(
  data: any[],
  startDate: Date,
  endDate: Date,
  dateField: string = "createdAt"
): any[] {
  return data.filter((item) => {
    const itemDate = new Date(item[dateField]);
    return itemDate >= startDate && itemDate <= endDate;
  });
}

/**
 * Günlük verileri grupla
 */
export function groupByDate(
  data: any[],
  dateField: string = "createdAt"
): Record<string, any[]> {
  return data.reduce(
    (acc, item) => {
      const date = new Date(item[dateField]).toLocaleDateString("tr-TR");
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(item);
      return acc;
    },
    {} as Record<string, any[]>
  );
}

/**
 * Verileri özetleyen istatistikler oluştur
 */
export function generateSummaryStats(data: any[], numericFields: string[]): Record<string, any> {
  const stats: Record<string, any> = {
    "Total Records": data.length,
  };

  numericFields.forEach((field) => {
    const values = data.map((item) => Number(item[field]) || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length > 0 ? sum / values.length : 0;
    const max = Math.max(...values);
    const min = Math.min(...values);

    stats[`${field} - Total`] = sum;
    stats[`${field} - Average`] = avg.toFixed(2);
    stats[`${field} - Maximum`] = max;
    stats[`${field} - Minimum`] = min;
  });

  return stats;
}
