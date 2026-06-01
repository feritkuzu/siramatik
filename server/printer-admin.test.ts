import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Admin Printer Settings", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    // Initialize database
    await db.getDb();
    
    // Create caller
    caller = appRouter.createCaller({
      user: null,
      req: null,
      res: null,
    });
  });

  it("should get printer settings", async () => {
    const settings = await caller.admin.getPrinterSettings();
    
    expect(settings).toBeDefined();
    expect(settings.id).toBeDefined();
    expect(typeof settings.isEnabled).toBe("boolean");
    expect(typeof settings.vendorId).toBe("number");
    expect(typeof settings.productId).toBe("number");
    expect(settings.printerType).toMatch(/escpos|network|bluetooth/);
  });

  it("should update printer settings", async () => {
    const result = await caller.admin.updatePrinterSettings({
      isEnabled: false,
      vendorId: 0x04b8,
      productId: 0x0202,
    });
    
    expect(result.success).toBe(true);
    
    // Verify update
    const updated = await caller.admin.getPrinterSettings();
    expect(updated.isEnabled).toBe(false);
    expect(updated.vendorId).toBe(0x04b8);
    expect(updated.productId).toBe(0x0202);
  });

  it("should list USB printers", async () => {
    const printers = await caller.admin.listUSBPrinters();
    
    expect(Array.isArray(printers)).toBe(true);
    // Printers array may be empty if no USB printers connected
    if (printers.length > 0) {
      expect(printers[0].vendorId).toBeDefined();
      expect(printers[0].productId).toBeDefined();
    }
  });

  it("should test printer without error", async () => {
    const result = await caller.admin.testPrinter();
    
    expect(result).toBeDefined();
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.message).toBe("string");
  });
});
