/**
 * Email Servisi
 * 
 * Raporları email ile gönderme işlevleri
 */

import nodemailer from "nodemailer";
import { AnalyticsReport } from "./analytics";

// Email transporter configuration
let transporter: nodemailer.Transporter | null = null;

/**
 * Email transporter'ı başlat
 */
export function initializeEmailService(config: {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}) {
  transporter = nodemailer.createTransport(config);
}

/**
 * HTML rapor şablonu oluştur
 */
export function generateReportHTML(report: AnalyticsReport): string {
  const startDate = report.dateRange.startDate.toLocaleDateString("tr-TR");
  const endDate = report.dateRange.endDate.toLocaleDateString("tr-TR");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #000;
            color: #fff;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: #111;
            border: 2px solid #ff006e;
            padding: 20px;
          }
          h1 {
            color: #ff006e;
            text-align: center;
            text-shadow: 0 0 10px #ff006e;
            margin-bottom: 10px;
          }
          .subtitle {
            text-align: center;
            color: #00d9ff;
            text-shadow: 0 0 10px #00d9ff;
            margin-bottom: 30px;
          }
          .section {
            margin-bottom: 30px;
            border: 2px solid #00d9ff;
            padding: 15px;
          }
          .section-title {
            color: #00d9ff;
            text-shadow: 0 0 10px #00d9ff;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
          }
          .stat-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .stat-item {
            background-color: #000;
            border: 1px solid #333;
            padding: 10px;
          }
          .stat-label {
            color: #999;
            font-size: 12px;
          }
          .stat-value {
            color: #ff006e;
            font-size: 24px;
            font-weight: bold;
            text-shadow: 0 0 10px #ff006e;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #1a1a1a;
            color: #00d9ff;
            padding: 10px;
            text-align: left;
            border: 1px solid #333;
          }
          td {
            padding: 8px;
            border: 1px solid #333;
          }
          tr:nth-child(even) {
            background-color: #0a0a0a;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #333;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>SİRAMATİK RAPORU</h1>
          <div class="subtitle">${startDate} - ${endDate}</div>

          <!-- Summary Section -->
          <div class="section">
            <div class="section-title">ÖZET İSTATİSTİKLER</div>
            <div class="stat-grid">
              <div class="stat-item">
                <div class="stat-label">Toplam Bilet</div>
                <div class="stat-value">${report.totalTickets}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Hizmet Verilen</div>
                <div class="stat-value">${report.totalServed}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Ort. Bekleme Süresi</div>
                <div class="stat-value">${Math.round(report.avgWaitTime / 1000)}s</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Ort. Hizmet Süresi</div>
                <div class="stat-value">${Math.round(report.avgServiceTime / 1000)}s</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Maks. Bekleme Süresi</div>
                <div class="stat-value">${Math.round(report.maxWaitTime / 1000)}s</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Yoğun Saat</div>
                <div class="stat-value">${report.peakHour}:00</div>
              </div>
            </div>
          </div>

          <!-- Bank Performance Section -->
          <div class="section">
            <div class="section-title">BANKO PERFORMANSI</div>
            <table>
              <thead>
                <tr>
                  <th>Banko</th>
                  <th>Hizmet Verilen</th>
                  <th>Ort. Hizmet Süresi</th>
                  <th>Maks. Hizmet Süresi</th>
                </tr>
              </thead>
              <tbody>
                ${report.bankPerformance
                  .map(
                    (bank) => `
                  <tr>
                    <td>Banko ${bank.bankNumber}</td>
                    <td>${bank.totalServed}</td>
                    <td>${Math.round(bank.avgServiceTime / 1000)}s</td>
                    <td>${Math.round(bank.maxServiceTime / 1000)}s</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>

          <!-- Daily Statistics Section -->
          <div class="section">
            <div class="section-title">GÜNLÜK İSTATİSTİKLER</div>
            <table>
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Bilet Sayısı</th>
                  <th>Hizmet Verilen</th>
                  <th>Ort. Bekleme</th>
                  <th>Yoğun Saat</th>
                </tr>
              </thead>
              <tbody>
                ${report.dailyStats
                  .map(
                    (day) => `
                  <tr>
                    <td>${day.date}</td>
                    <td>${day.ticketCount}</td>
                    <td>${day.servedCount}</td>
                    <td>${Math.round(day.avgWaitTime / 1000)}s</td>
                    <td>${day.peakHour}:00</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>Bu rapor otomatik olarak oluşturulmuştur.</p>
            <p>Sıramatik Sistemi © 2026</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Metin formatında rapor oluştur
 */
export function generateReportText(report: AnalyticsReport): string {
  const startDate = report.dateRange.startDate.toLocaleDateString("tr-TR");
  const endDate = report.dateRange.endDate.toLocaleDateString("tr-TR");

  let text = `
SİRAMATİK RAPORU
${startDate} - ${endDate}

ÖZET İSTATİSTİKLER
==================
Toplam Bilet: ${report.totalTickets}
Hizmet Verilen: ${report.totalServed}
Ortalama Bekleme Süresi: ${Math.round(report.avgWaitTime / 1000)}s
Ortalama Hizmet Süresi: ${Math.round(report.avgServiceTime / 1000)}s
Maksimum Bekleme Süresi: ${Math.round(report.maxWaitTime / 1000)}s
Yoğun Saat: ${report.peakHour}:00

BANKO PERFORMANSI
==================
`;

  report.bankPerformance.forEach((bank) => {
    text += `
Banko ${bank.bankNumber}:
  - Hizmet Verilen: ${bank.totalServed}
  - Ort. Hizmet Süresi: ${Math.round(bank.avgServiceTime / 1000)}s
  - Maks. Hizmet Süresi: ${Math.round(bank.maxServiceTime / 1000)}s
  - Min. Hizmet Süresi: ${Math.round(bank.minServiceTime / 1000)}s
`;
  });

  return text;
}

/**
 * Raporu email ile gönder
 */
export async function sendReportEmail(
  to: string,
  report: AnalyticsReport,
  subject: string = "Sıramatik Raporu"
): Promise<boolean> {
  if (!transporter) {
    console.warn("Email service not initialized");
    return false;
  }

  try {
    const htmlContent = generateReportHTML(report);
    const textContent = generateReportText(report);

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "noreply@siramatik.com",
      to,
      subject,
      text: textContent,
      html: htmlContent,
    });

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

/**
 * Birden fazla alıcıya rapor gönder
 */
export async function sendReportEmailToMultiple(
  recipients: string[],
  report: AnalyticsReport,
  subject: string = "Sıramatik Raporu"
): Promise<{ success: number; failed: number }> {
  const results = await Promise.all(
    recipients.map((recipient) => sendReportEmail(recipient, report, subject))
  );

  const success = results.filter((r) => r).length;
  const failed = results.filter((r) => !r).length;

  return { success, failed };
}

/**
 * Test email gönder
 */
export async function sendTestEmail(to: string): Promise<boolean> {
  if (!transporter) {
    console.warn("Email service not initialized");
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "noreply@siramatik.com",
      to,
      subject: "Sıramatik - Test Email",
      text: "Bu bir test emailidir. Email servisi düzgün çalışıyor.",
      html: `
        <h1>Sıramatik Email Servisi</h1>
        <p>Bu bir test emailidir. Email servisi düzgün çalışıyor.</p>
      `,
    });

    return true;
  } catch (error) {
    console.error("Failed to send test email:", error);
    return false;
  }
}
