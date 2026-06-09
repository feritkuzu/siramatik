import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listWindowsPrinters,
  getDefaultPrinter,
  generateTicketContent,
  testPrintToWindowsPrinter,
} from "./_core/native-printer";

describe("Native Printer Integration", () => {
  describe("generateTicketContent", () => {
    it("should generate valid ESC/POS content for ticket", () => {
      const content = generateTicketContent({
        queueNumber: "001",
        bankName: "TEST BANKO",
        timestamp: new Date("2026-06-01T12:00:00Z"),
        companyName: "SIRAMATIK",
        customMessage: "Test message",
      });

      expect(content).toBeInstanceOf(Buffer);
      expect(content.length).toBeGreaterThan(0);
      
      // Check for ESC/POS commands
      const contentStr = content.toString("utf-8");
      expect(contentStr).toContain("SIRA NO");
      expect(contentStr).toContain("001");
      expect(contentStr).toContain("TEST BANKO");
    });

    it("should handle missing optional fields", () => {
      const content = generateTicketContent({
        queueNumber: "005",
      });

      expect(content).toBeInstanceOf(Buffer);
      expect(content.length).toBeGreaterThan(0);
      
      const contentStr = content.toString("utf-8");
      expect(contentStr).toContain("005");
    });

    it("should transliterate Turkish characters to ASCII", () => {
      const content = generateTicketContent({
        queueNumber: "010",
        customMessage: "Türkçe mesaj: Sıra numaranız",
      });

      expect(content).toBeInstanceOf(Buffer);
      const contentStr = content.toString("utf-8");
      expect(contentStr).toContain("Turkce mesaj: Sira numaraniz");
      expect(contentStr).not.toContain("Türkçe");
    });
  });

  describe("listWindowsPrinters", () => {
    it("should return array of printers", async () => {
      const printers = await listWindowsPrinters();
      expect(Array.isArray(printers)).toBe(true);
    });

    it("should handle errors gracefully", async () => {
      const printers = await listWindowsPrinters();
      expect(printers).toBeDefined();
    });
  });

  describe("getDefaultPrinter", () => {
    it("should return string or null", async () => {
      const defaultPrinter = await getDefaultPrinter();
      expect(
        defaultPrinter === null || typeof defaultPrinter === "string"
      ).toBe(true);
    });
  });

  describe("testPrintToWindowsPrinter", () => {
    it("should return success or error object", async () => {
      const result = await testPrintToWindowsPrinter("NonExistentPrinter");
      
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("message");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.message).toBe("string");
    });
  });
});
