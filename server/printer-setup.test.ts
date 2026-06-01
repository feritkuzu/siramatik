import { describe, it, expect } from "vitest";
import {
  listUSBPrinters,
  getUSBPrinter,
  initializeUSBPrinter,
  testUSBPrinter,
} from "./_core/printer-usb";

describe("USB Thermal Printer Setup", () => {
  it("should list available USB printers", () => {
    const printers = listUSBPrinters();
    console.log("Available USB Printers:", printers);
    
    // Yazıcı olmasa da test geçmeli (empty array is valid)
    expect(Array.isArray(printers)).toBe(true);
  });

  it("should create USB printer instance", () => {
    const printer = getUSBPrinter();
    expect(printer).toBeDefined();
    expect(printer.isReady()).toBe(false); // Bağlantı yapılmadığı için false olmalı
  });

  it("should handle printer connection gracefully", async () => {
    const printer = getUSBPrinter({
      vendorId: 0x0483,
      productId: 0x3743,
    });

    // Yazıcı olmasa da hata vermemeli
    const connected = await printer.connect();
    console.log("Printer connection result:", connected);
    
    // Yazıcı olmasa da false döner, hata vermez
    expect(typeof connected).toBe("boolean");
  });

  it("should initialize USB printer with custom config", async () => {
    const result = await initializeUSBPrinter({
      vendorId: 0x0483,
      productId: 0x3743,
    });

    // Yazıcı olmasa da test geçmeli
    expect(typeof result).toBe("boolean");
  });

  it("should handle test print gracefully", async () => {
    const result = await testUSBPrinter();
    console.log("Test print result:", result);
    
    // Yazıcı olmasa da hata vermemeli
    expect(typeof result).toBe("boolean");
  });
});
