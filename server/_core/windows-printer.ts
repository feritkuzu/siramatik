import { execSync } from "child_process";
import * as os from "os";

export interface WindowsPrinter {
  name: string;
  status: string;
  isDefault: boolean;
}

export interface PrinterSettings {
  printerName: string;
  isEnabled: boolean;
  paperWidth: number;
  paperHeight: number;
}

let printerSettings: PrinterSettings = {
  printerName: "",
  isEnabled: false,
  paperWidth: 80,
  paperHeight: 200,
};

/**
 * Windows sistem yazıcılarını listele
 */
export function listWindowsPrinters(): WindowsPrinter[] {
  try {
    if (os.platform() !== "win32") {
      console.warn("[Printer] Not running on Windows, cannot list system printers");
      return [];
    }

    // PowerShell komutu ile yazıcıları listele
    const command = `powershell -Command "Get-Printer | Select-Object Name, PrinterStatus, @{Name='IsDefault';Expression={$_.Name -eq (Get-DefaultPrinter).Name}} | ConvertTo-Json"`;
    const output = execSync(command, { encoding: "utf-8" });
    
    if (!output || output.trim() === "") {
      console.log("[Printer] No printers found");
      return [];
    }

    const printers = JSON.parse(output);
    
    // Tek yazıcı durumunda array'e dönüştür
    const printerArray = Array.isArray(printers) ? printers : [printers];

    return printerArray.map((p: any) => ({
      name: p.Name || "Unknown",
      status: p.PrinterStatus || "Unknown",
      isDefault: p.IsDefault || false,
    }));
  } catch (error) {
    console.error("[Printer] Failed to list Windows printers:", error);
    return [];
  }
}

/**
 * Yazıcı ayarlarını al
 */
export function getPrinterSettings(): PrinterSettings {
  return { ...printerSettings };
}

/**
 * Yazıcı ayarlarını güncelle
 */
export function updatePrinterSettings(settings: Partial<PrinterSettings>): void {
  printerSettings = { ...printerSettings, ...settings };
  console.log("[Printer] Settings updated:", printerSettings);
}

/**
 * Windows yazıcısına yazdır
 */
export async function printToWindowsPrinter(
  content: string,
  printerName?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (os.platform() !== "win32") {
      return {
        success: false,
        message: "Windows yazıcı desteği sadece Windows'ta kullanılabilir",
      };
    }

    const targetPrinter = printerName || printerSettings.printerName;

    if (!targetPrinter) {
      return {
        success: false,
        message: "Yazıcı seçilmedi. Lütfen admin panelinden yazıcı seçin.",
      };
    }

    if (!printerSettings.isEnabled) {
      return {
        success: false,
        message: "Yazıcı devre dışı bırakılmış. Lütfen admin panelinden etkinleştirin.",
      };
    }

    // Yazıcıya gönder - basit metin yazdırma
    // Gerçek uygulamada, ESC/POS komutlarını Windows yazıcısına uyarlamak gerekir
    const command = `powershell -Command "Add-Content -Path 'C:\\temp\\print_job.txt' -Value '${content.replace(/'/g, "''")}'; Print-Document -FilePath 'C:\\temp\\print_job.txt' -PrinterName '${targetPrinter}'"`;
    
    execSync(command);

    console.log(`[Printer] Successfully printed to ${targetPrinter}`);
    return {
      success: true,
      message: `${targetPrinter} yazıcısına yazdırıldı`,
    };
  } catch (error) {
    console.error("[Printer] Print failed:", error);
    return {
      success: false,
      message: `Yazdırma başarısız: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
    };
  }
}

/**
 * Test yazdırması yap
 */
export async function testWindowsPrinter(printerName?: string): Promise<{ success: boolean; message: string }> {
  try {
    const targetPrinter = printerName || printerSettings.printerName;

    if (!targetPrinter) {
      return {
        success: false,
        message: "Yazıcı seçilmedi",
      };
    }

    const testContent = `
╔════════════════════════════════════╗
║     SIRAMATIK TEST YAZDIRMASI      ║
╚════════════════════════════════════╝

Tarih: ${new Date().toLocaleString("tr-TR")}
Yazıcı: ${targetPrinter}

Test başarılı!

═════════════════════════════════════
    `;

    return await printToWindowsPrinter(testContent, targetPrinter);
  } catch (error) {
    console.error("[Printer] Test print failed:", error);
    return {
      success: false,
      message: `Test yazdırması başarısız: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
    };
  }
}

/**
 * Bilet yazdır
 */
export async function printTicketToWindowsPrinter(ticketData: {
  ticketNumber: number;
  bankNumber?: number;
  position?: number;
  timestamp?: number;
  companyName?: string;
  customMessage?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("tr-TR");
    const dateStr = now.toLocaleDateString("tr-TR");

    const content = `
╔════════════════════════════════════╗
║  ${(ticketData.companyName || "SIRAMATIK").padEnd(32)}  ║
╚════════════════════════════════════╝

SIRAnumarası: ${String(ticketData.ticketNumber).padStart(4, "0")}

${ticketData.bankNumber ? `Banko: ${ticketData.bankNumber}` : ""}
${ticketData.position ? `Sıradaki Pozisyon: ${ticketData.position}` : ""}

Tarih: ${dateStr}
Saat: ${timeStr}

${ticketData.customMessage ? ticketData.customMessage : ""}

═════════════════════════════════════
    `;

    return await printToWindowsPrinter(content);
  } catch (error) {
    console.error("[Printer] Failed to print ticket:", error);
    return {
      success: false,
      message: `Bilet yazdırması başarısız: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
    };
  }
}
