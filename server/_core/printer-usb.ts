/**
 * USB Termal Yazıcı Entegrasyonu
 * ESC/POS protokolü ile USB bağlantılı termal yazıcılar için
 */

import Printer from "escpos";
import * as usb from "usb";

export interface USBPrinterConfig {
  vendorId?: number;  // Yazıcı vendor ID (default: 0x0483 - STMicroelectronics/Thermal Printer)
  productId?: number; // Yazıcı product ID (default: 0x3743)
  autoConnect?: boolean;
}

export interface PrinterDevice {
  vendorId: number;
  productId: number;
  serialNumber?: string;
  manufacturer?: string;
  product?: string;
}

class USBThermalPrinter {
  private device: any = null;
  private isConnected: boolean = false;
  private config: USBPrinterConfig;

  constructor(config: USBPrinterConfig = {}) {
    this.config = {
      vendorId: 0x0483,    // Yaygın termal yazıcı vendor ID
      productId: 0x3743,   // Yaygın termal yazıcı product ID
      autoConnect: true,
      ...config,
    };
  }

  /**
   * Kullanılabilir USB yazıcıları listele
   */
  static listPrinters(): PrinterDevice[] {
    try {
      const devices = (usb as any).getDeviceList();
      const printers: PrinterDevice[] = [];

      devices.forEach((device: any) => {
        // Yaygın termal yazıcı vendor/product ID'leri
        const commonPrinterIds = [
          { vendor: 0x0483, product: 0x3743 }, // STMicroelectronics
          { vendor: 0x04b8, product: 0x0202 }, // Epson
          { vendor: 0x04b8, product: 0x0005 }, // Epson TM-T20
          { vendor: 0x0456, product: 0x0808 }, // Sinocan
          { vendor: 0x1504, product: 0x0006 }, // Zebra
        ];

        const isCommonPrinter = commonPrinterIds.some(
          (id) => device.deviceDescriptor.idVendor === id.vendor &&
                  device.deviceDescriptor.idProduct === id.product
        );

        if (isCommonPrinter) {
          printers.push({
            vendorId: device.deviceDescriptor.idVendor,
            productId: device.deviceDescriptor.idProduct,
            serialNumber: device.deviceDescriptor.iSerialNumber?.toString(),
            manufacturer: device.deviceDescriptor.iManufacturer?.toString(),
            product: device.deviceDescriptor.iProduct?.toString(),
          });
        }
      });

      return printers;
    } catch (error) {
      console.error("[Printer] Failed to list USB devices:", error);
      return [];
    }
  }

  /**
   * USB yazıcısına bağlan
   */
  async connect(): Promise<boolean> {
    try {
      console.log("[Printer] Searching for USB thermal printer...");

      const devices = (usb as any).getDeviceList();
      let foundDevice = null;

      for (const device of devices as any[]) {
        if (
          device.deviceDescriptor.idVendor === this.config.vendorId &&
          device.deviceDescriptor.idProduct === this.config.productId
        ) {
          foundDevice = device;
          break;
        }
      }

      if (!foundDevice) {
        console.warn(
          `[Printer] USB printer not found (VID: 0x${this.config.vendorId?.toString(16)}, PID: 0x${this.config.productId?.toString(16)})`
        );
        return false;
      }

      console.log("[Printer] USB printer found, connecting...");
      this.device = new Printer(foundDevice);
      this.isConnected = true;
      console.log("[Printer] USB printer connected successfully");

      return true;
    } catch (error) {
      console.error("[Printer] Failed to connect to USB printer:", error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Yazıcıya sıra numarası biletini yazdır
   */
  async printTicket(ticketNumber: number, queuePosition: number = 1): Promise<boolean> {
    if (!this.isConnected || !this.device) {
      console.warn("[Printer] Printer not connected");
      return false;
    }

    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("tr-TR");
      const dateStr = now.toLocaleDateString("tr-TR");

      // ESC/POS komutları ile bilet yazdır
      this.device
        .align("ct")
        .style("b")
        .size(2, 2)
        .text("SIRAMATIK")
        .size(1, 1)
        .style("normal")
        .text("Sıra Numarası Sistemi")
        .text("")
        .align("ct")
        .style("b")
        .size(3, 3)
        .text(ticketNumber.toString())
        .size(1, 1)
        .style("normal")
        .text("")
        .align("ct")
        .text(`Sırada ${queuePosition}. kişi`)
        .text(dateStr)
        .text(timeStr)
        .text("")
        .text("Lütfen bekleme salonunda")
        .text("bekleyiniz.")
        .text("")
        .text("Numaranız çağrıldığında")
        .text("ana ekranda görülecektir.")
        .text("")
        .text("Bizi tercih ettiğiniz için")
        .text("teşekkür ederiz.")
        .text("")
        .cut()
        .close();

      console.log(`[Printer] Ticket ${ticketNumber} printed successfully`);
      return true;
    } catch (error) {
      console.error("[Printer] Failed to print ticket:", error);
      return false;
    }
  }

  /**
   * Yazıcı bağlantısını kes
   */
  async disconnect(): Promise<void> {
    try {
      if (this.device) {
        this.device.close();
      }
      this.isConnected = false;
      console.log("[Printer] Printer disconnected");
    } catch (error) {
      console.error("[Printer] Error disconnecting printer:", error);
    }
  }

  /**
   * Yazıcı durumunu kontrol et
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Test yazdırması yap
   */
  async testPrint(): Promise<boolean> {
    if (!this.isConnected || !this.device) {
      console.warn("[Printer] Printer not connected");
      return false;
    }

    try {
      this.device
        .align("ct")
        .text("TEST YAZDIRMASI")
        .text("")
        .text("Yazıcı başarıyla bağlandı")
        .text("")
        .text(new Date().toLocaleString("tr-TR"))
        .text("")
        .cut()
        .close();

      console.log("[Printer] Test print completed");
      return true;
    } catch (error) {
      console.error("[Printer] Test print failed:", error);
      return false;
    }
  }
}

// Global yazıcı örneği
let printerInstance: USBThermalPrinter | null = null;

/**
 * USB yazıcı örneğini al veya oluştur
 */
export function getUSBPrinter(config?: USBPrinterConfig): USBThermalPrinter {
  if (!printerInstance) {
    printerInstance = new USBThermalPrinter(config);
  }
  return printerInstance;
}

/**
 * USB yazıcısını başlat
 */
export async function initializeUSBPrinter(
  config?: USBPrinterConfig
): Promise<boolean> {
  const printer = getUSBPrinter(config);
  return await printer.connect();
}

/**
 * Sıra numarası biletini yazdır
 */
export async function printUSBTicket(
  ticketNumber: number,
  queuePosition?: number
): Promise<boolean> {
  const printer = getUSBPrinter();
  if (!printer.isReady()) {
    console.warn("[Printer] Printer not ready, attempting to connect...");
    await printer.connect();
  }
  return await printer.printTicket(ticketNumber, queuePosition || 1);
}

/**
 * Test yazdırması yap
 */
export async function testUSBPrinter(): Promise<boolean> {
  const printer = getUSBPrinter();
  if (!printer.isReady()) {
    console.warn("[Printer] Printer not ready, attempting to connect...");
    await printer.connect();
  }
  return await printer.testPrint();
}

/**
 * Mevcut USB yazıcıları listele
 */
export function listUSBPrinters(): PrinterDevice[] {
  return USBThermalPrinter.listPrinters();
}
