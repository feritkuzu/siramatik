import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import { execSync } from 'child_process';


interface PrinterInfo {
  name: string;
  model?: string;
  driver?: string;
  status?: string;
  isDefault?: boolean;
}

interface PrintOptions {
  printerName: string;
  data: Buffer | string;
  type?: 'RAW' | 'TEXT';
}

let printer: any = null;

// Lazy load printer module (only on Windows)
function getPrinter() {
  if (printer) return printer;
  
  try {
    if (process.platform === 'win32') {
      printer = require('@grandchef/node-printer');
      return printer;
    }
  } catch (error) {
    console.error('[Native Printer] Failed to load node-printer:', error);
    return null;
  }
  return null;
}

/**
 * List all available printers on Windows
 */
export async function listWindowsPrinters(): Promise<PrinterInfo[]> {
  try {
    // Try Windows Print API first (more reliable)
    if (process.platform === 'win32') {
      const { listWindowsPrintersViaAPI } = await import('./windows-print-api');
      const printers = await listWindowsPrintersViaAPI();
      if (printers.length > 0) {
        return printers;
      }
    }

    // Fallback to node-printer module
    const printerModule = getPrinter();
    if (!printerModule) {
      console.log('[Native Printer] Not running on Windows or printer module not available');
      // Return mock printers for development/testing and production (sandbox)
      return [
        { name: 'Microsoft Print to PDF', isDefault: false },
        { name: 'Zjiang ZJ-5890K', isDefault: true },
      ];
    }

    const printers = printerModule.getPrinters();
    
    if (!Array.isArray(printers)) {
      console.log('[Native Printer] No printers found');
      return [];
    }

    return printers.map((p: any) => ({
      name: p.name || p,
      model: p.model,
      driver: p.driver,
      status: p.status,
      isDefault: p.isDefault || p.default,
    }));
  } catch (error) {
    console.error('[Native Printer] Error listing printers:', error);
    return [];
  }
}

/**
 * Get default printer name
 */
export async function getDefaultPrinter(): Promise<string | null> {
  try {
    const printers = await listWindowsPrinters();
    const defaultPrinter = printers.find(p => p.isDefault);
    return defaultPrinter?.name || (printers.length > 0 ? printers[0].name : null);
  } catch (error) {
    console.error('[Native Printer] Error getting default printer:', error);
    return null;
  }
}

/**
 * Print to Windows printer with timeout and error handling
 */
function tryNetworkPrint(ip: string, buffer: Buffer): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setNoDelay(true);
    const timeout = setTimeout(() => { client.destroy(); resolve(false); }, 8000);
    client.connect(9100, ip, () => {
      clearTimeout(timeout);
      client.write(buffer);
      // Yazıcının veriyi işlemesi için 300ms bekle
      setTimeout(() => {
        client.end();
        resolve(true);
      }, 300);
    });
    client.on('error', () => { clearTimeout(timeout); resolve(false); });
  });
}

export async function printToWindowsPrinter(options: PrintOptions): Promise<{ success: boolean; message: string }> {
  const buffer = typeof options.data === 'string' ? Buffer.from(options.data, 'utf8') : options.data;
  const printerName = options.printerName;

  // 1. Doğrudan IP'ye PowerShell TCP soket (port 9100) — en güvenilir
  try {
    const portInfo = execSync(
      `powershell -NoProfile -Command "(Get-Printer -Name '${printerName.replace(/'/g, "''")}').PortName"`,
      { timeout: 5000, encoding: 'utf-8' }
    ).trim();
    if (portInfo && /^\d+\.\d+\.\d+\.\d+$/.test(portInfo)) {
      // Binary veriyi Base64'e çevir, PowerShell'de çözüp TCP'ye yaz
      const b64 = buffer.toString('base64');
      const psScript = `
        $tcp=New-Object System.Net.Sockets.TcpClient;
        $tcp.Connect('${portInfo}',9100);
        $s=$tcp.GetStream();
        $b=[System.Convert]::FromBase64String('${b64}');
        $s.Write($b,0,$b.Length);
        $s.Flush();
        Start-Sleep -Milliseconds 300;
        $s.Close();
        $tcp.Close();
      `.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      execSync(`powershell -NoProfile -Command "${psScript}"`, { timeout: 15000 });
      console.log(`[Native Printer] PowerShell TCP sent to ${portInfo}:9100`);
      return { success: true, message: `Yazdırıldı: ${printerName}` };
    }
  } catch (e) {
    console.log('[Native Printer] PowerShell TCP failed:', (e as Error).message);
  }

  // 2. PowerShell .NET RAW printing (System.Printing)
  try {
    const { printESCPOSViaWindowsAPI } = await import('./windows-print-api');
    const result = await printESCPOSViaWindowsAPI(printerName, buffer);
    if (result.success) return result;
    console.log('[Native Printer] PowerShell RAW failed:', result.message);
  } catch (e) {
    console.log('[Native Printer] PowerShell RAW error:', (e as Error).message);
  }

  // 3. Node.js raw TCP (port 9100)
  try {
    const portInfo = execSync(
      `powershell -NoProfile -Command "(Get-Printer -Name '${printerName.replace(/'/g, "''")}').PortName"`,
      { timeout: 5000, encoding: 'utf-8' }
    ).trim();
    if (portInfo && /^\d+\.\d+\.\d+\.\d+$/.test(portInfo)) {
      const printed = await tryNetworkPrint(portInfo, buffer);
      if (printed) {
        console.log(`[Native Printer] Node TCP sent to ${portInfo}:9100`);
        return { success: true, message: `Yazdırıldı: ${printerName}` };
      }
    }
  } catch (e) {
    console.log('[Native Printer] Node TCP failed:', (e as Error).message);
  }

  // 4. PowerShell Out-Printer (text-only yedek)
  try {
    const tempFile = path.join(os.tmpdir(), `print-${Date.now()}.bin`);
    fs.writeFileSync(tempFile, buffer);
    execSync(`powershell -NoProfile -Command "Get-Content '${tempFile}' -Raw | Out-Printer -Name '${printerName}'"`, { timeout: 15000 });
    try { fs.unlinkSync(tempFile); } catch {}
    console.log(`[Native Printer] Out-Printer sent to ${printerName}`);
    return { success: true, message: `Yazdırıldı: ${printerName}` };
  } catch (e) {
    console.log('[Native Printer] Out-Printer failed:', (e as Error).message);
  }

  return { success: false, message: `Hiçbir yazdırma yöntemi çalışmadı: ${printerName}` };
}

/**
 * Generate ESC/POS ticket content with label settings
 */
interface TicketData {
  queueNumber: string;
  bankName?: string;
  timestamp?: Date;
  companyName?: string;
  customMessage?: string;
  labelSettings?: any; // Label design settings
}

// Türkçe karakterleri ASCII karşılıklarına çevir
function trToAscii(text: string): string {
  const map: Record<string, string> = {
    'İ': 'I', 'ı': 'i',
    'Ş': 'S', 'ş': 's',
    'Ğ': 'G', 'ğ': 'g',
    'Ü': 'U', 'ü': 'u',
    'Ö': 'O', 'ö': 'o',
    'Ç': 'C', 'ç': 'c',
  };
  return text.replace(/[İışşğĞüÜöÖçÇ]/g, c => map[c] || c);
}

export function generateTicketContent(ticketData: TicketData): Buffer {
  const ESC = '\x1B';
  const GS = '\x1D';
  const lines: string[] = [];
  const labelSettings = ticketData.labelSettings || {};

  // Set alignment to center
  lines.push(ESC + 'a' + '\x01');
  
  // Header
  lines.push('================================');
  
  if (labelSettings.headerText) {
    lines.push(trToAscii(labelSettings.headerText));
  } else if (ticketData.companyName) {
    lines.push(trToAscii(ticketData.companyName));
  } else {
    lines.push('SIRAMATIK SISTEMI');
  }
  
  lines.push('================================');
  lines.push('');

  // Queue number (large font)
  lines.push(ESC + 'E' + '\x01'); // Bold on
  lines.push('SIRA NO: ' + ticketData.queueNumber);
  lines.push(ESC + 'E' + '\x00'); // Bold off
  lines.push('');

  // Bank info (if enabled)
  if (labelSettings.showBankInfo !== false && ticketData.bankName) {
    lines.push('BANKO: ' + trToAscii(ticketData.bankName));
    lines.push('');
  }

  // Date and time (if enabled)
  if (labelSettings.showDateTime !== false && ticketData.timestamp) {
    const date = new Date(ticketData.timestamp);
    lines.push('Tarih: ' + date.toLocaleDateString('tr-TR'));
    lines.push('Saat: ' + date.toLocaleTimeString('tr-TR'));
    lines.push('');
  }

  // Custom message
  if (ticketData.customMessage) {
    lines.push(trToAscii(ticketData.customMessage));
    lines.push('');
  }

  // Footer
  lines.push('================================');
  if (labelSettings.footerText) {
    lines.push(trToAscii(labelSettings.footerText));
  } else {
    lines.push('Hos geldiniz');
  }
  lines.push('================================');
  lines.push('');

  // Cut paper
  lines.push(GS + 'V' + '\x41' + '\x00');

  // Convert to buffer using UTF-8 (ASCII-safe content after transliteration)
  const content = lines.join('\n');
  return Buffer.from(content, 'utf8');
}

/**
 * Test print to Windows printer
 */
export async function testPrintToWindowsPrinter(printerName: string): Promise<{ success: boolean; message: string }> {
  try {
    const testContent = generateTicketContent({
      queueNumber: '001',
      bankName: 'Test Banko',
      timestamp: new Date(),
      companyName: 'Sıramatik Sistemi',
      customMessage: 'Test Yazdırması',
    });

    return await printToWindowsPrinter({
      printerName,
      data: testContent,
      type: 'RAW',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Native Printer] Test print error:', errorMessage);
    return {
      success: false,
      message: `Test yazdırması başarısız: ${errorMessage}`,
    };
  }
}
