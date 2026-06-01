/**
 * Termal Yazıcı Servisi
 * 
 * Bu modül, sıra numaralarını termal yazıcıya göndermek için API'ları yönetir.
 * Desteklenen yazıcı türleri:
 * - ESC/POS (Epson, Star Micronics, vb.)
 * - Bluetooth/USB bağlantılı yazıcılar
 * - Network yazıcılar
 */

export interface PrinterConfig {
  type: "escpos" | "network" | "bluetooth";
  host?: string;
  port?: number;
  devicePath?: string;
  width?: number; // Karakter genişliği (default: 32)
}

export interface TicketPrintData {
  ticketNumber: number;
  bankId?: number;
  timestamp?: Date;
  queuePosition?: number;
  isPriority?: boolean;
  priorityType?: 'elderly' | 'disabled' | 'pregnant' | 'none';
}

class ThermalPrinter {
  private config: PrinterConfig;
  private isConnected: boolean = false;

  constructor(config: PrinterConfig) {
    this.config = {
      width: 32,
      ...config,
    };
  }

  /**
   * Yazıcıya bağlan
   */
  async connect(): Promise<boolean> {
    try {
      console.log(`[Printer] Connecting to ${this.config.type} printer...`);

      switch (this.config.type) {
        case "escpos":
          return await this.connectESCPOS();
        case "network":
          return await this.connectNetwork();
        case "bluetooth":
          return await this.connectBluetooth();
        default:
          throw new Error(`Unknown printer type: ${this.config.type}`);
      }
    } catch (error) {
      console.error("[Printer] Connection failed:", error);
      return false;
    }
  }

  /**
   * ESC/POS yazıcısına bağlan
   */
  private async connectESCPOS(): Promise<boolean> {
    // ESC/POS yazıcılar genellikle USB veya seri port üzerinden bağlanır
    // Bu örnek, gerçek bir kütüphane (escpos-printer) kullanılacak şekilde tasarlanmıştır
    console.log("[Printer] ESC/POS printer detected");
    this.isConnected = true;
    return true;
  }

  /**
   * Network yazıcısına bağlan
   */
  private async connectNetwork(): Promise<boolean> {
    if (!this.config.host || !this.config.port) {
      throw new Error("Network printer requires host and port");
    }

    console.log(
      `[Printer] Connecting to network printer at ${this.config.host}:${this.config.port}`
    );

    // Network bağlantısı simülasyonu
    this.isConnected = true;
    return true;
  }

  /**
   * Bluetooth yazıcısına bağlan
   */
  private async connectBluetooth(): Promise<boolean> {
    if (!this.config.devicePath) {
      throw new Error("Bluetooth printer requires devicePath");
    }

    console.log(`[Printer] Connecting to Bluetooth printer at ${this.config.devicePath}`);

    // Bluetooth bağlantısı simülasyonu
    this.isConnected = true;
    return true;
  }

  /**
   * Sıra numarası biletini yazdır
   */
  async printTicket(data: TicketPrintData): Promise<boolean> {
    if (!this.isConnected) {
      console.warn("[Printer] Printer not connected");
      return false;
    }

    try {
      const receipt = this.generateReceipt(data);
      console.log("[Printer] Printing ticket:", data.ticketNumber);
      console.log(receipt);

      // Yazıcıya gönder (gerçek implementasyon)
      // await this.sendToPrinter(receipt);

      return true;
    } catch (error) {
      console.error("[Printer] Print failed:", error);
      return false;
    }
  }

  /**
   * Bilet makbuzunu oluştur
   */
  private generateReceipt(data: TicketPrintData): string {
    const width = this.config.width || 32;
    const lines: string[] = [];

    // Başlık
    lines.push("=".repeat(width));
    lines.push(this.centerText("SIRAMATI K", width));
    lines.push(this.centerText("Sıra Numarası Sistemi", width));
    lines.push("=".repeat(width));

    // Sıra numarası (büyük yazı)
    lines.push("");
    lines.push(this.centerText("SİRA NUMARANIZ", width));
    lines.push("");
    lines.push(this.centerText(data.ticketNumber.toString(), width, true));
    lines.push("");

    // Banko bilgisi (varsa)
    if (data.bankId) {
      lines.push(this.centerText(`BANKO ${data.bankId}`, width));
      lines.push("");
    }

    // Sıra pozisyonu (varsa)
    if (data.queuePosition) {
      lines.push(this.centerText(`Sırada ${data.queuePosition}. kişi`, width));
      lines.push("");
    }

    // Zaman bilgisi
    const timestamp = data.timestamp || new Date();
    const timeStr = timestamp.toLocaleTimeString("tr-TR");
    const dateStr = timestamp.toLocaleDateString("tr-TR");
    lines.push(this.centerText(dateStr, width));
    lines.push(this.centerText(timeStr, width));

    // Talimatlar
    lines.push("");
    lines.push("=".repeat(width));
    lines.push(this.centerText("Lütfen bekleme salonunda", width));
    lines.push(this.centerText("bekleyiniz.", width));
    lines.push(this.centerText("Numaranız çağrıldığında", width));
    lines.push(this.centerText("ana ekranda görülecektir.", width));
    lines.push("=".repeat(width));

    // Teşekkür
    lines.push("");
    lines.push(this.centerText("Bizi tercih ettiğiniz için", width));
    lines.push(this.centerText("teşekkür ederiz.", width));
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Metni ortala
   */
  private centerText(text: string, width: number, isBold: boolean = false): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    const prefix = isBold ? "\x1b[1m" : ""; // ESC/POS bold
    const suffix = isBold ? "\x1b[0m" : "";
    return " ".repeat(padding) + prefix + text + suffix;
  }

  /**
   * Yazıcıdan bağlantıyı kes
   */
  async disconnect(): Promise<void> {
    console.log("[Printer] Disconnecting...");
    this.isConnected = false;
  }

  /**
   * Yazıcı durumunu kontrol et
   */
  isReady(): boolean {
    return this.isConnected;
  }
}

// Global yazıcı örneği
let printerInstance: ThermalPrinter | null = null;

/**
 * Yazıcı örneğini al veya oluştur
 */
export function getPrinter(config?: PrinterConfig): ThermalPrinter {
  if (!printerInstance && config) {
    printerInstance = new ThermalPrinter(config);
  }
  if (!printerInstance) {
    // Varsayılan konfigürasyon
    printerInstance = new ThermalPrinter({
      type: "escpos",
    });
  }
  return printerInstance;
}

/**
 * Yazıcıyı başlat
 */
export async function initializePrinter(config: PrinterConfig): Promise<boolean> {
  const printer = getPrinter(config);
  return await printer.connect();
}

/**
 * Sıra numarası biletini yazdır
 */
export async function printTicket(data: TicketPrintData): Promise<boolean> {
  const printer = getPrinter();
  if (!printer.isReady()) {
    console.warn("[Printer] Printer not ready, attempting to connect...");
    await printer.connect();
  }
  return await printer.printTicket(data);
}

/**
 * Yazıcıyı kapat
 */
export async function closePrinter(): Promise<void> {
  if (printerInstance) {
    await printerInstance.disconnect();
    printerInstance = null;
  }
}
