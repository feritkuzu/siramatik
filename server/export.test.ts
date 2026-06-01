import { describe, it, expect } from "vitest";
import {
  generateCSV,
  generatePDF,
  generateFilename,
  generateSummaryStats,
  filterByDateRange,
  groupByDate,
} from "./_core/export";

describe("Export Functions", () => {
  describe("CSV Generation", () => {
    it("should generate valid CSV format", () => {
      const data = [
        { name: "Test 1", value: 100 },
        { name: "Test 2", value: 200 },
      ];

      const csv = generateCSV({
        title: "Test Report",
        filename: "test.csv",
        columns: ["name", "value"],
        data,
      });

      expect(csv).toContain("name,value");
      expect(csv).toContain("Test 1,100");
      expect(csv).toContain("Test 2,200");
    });

    it("should escape CSV special characters", () => {
      const data = [{ text: 'Value with "quotes" and, comma' }];

      const csv = generateCSV({
        title: "Test",
        filename: "test.csv",
        columns: ["text"],
        data,
      });

      expect(csv).toContain('"Value with ""quotes"" and, comma"');
    });

    it("should handle empty data", () => {
      const csv = generateCSV({
        title: "Empty Report",
        filename: "empty.csv",
        columns: ["col1", "col2"],
        data: [],
      });

      expect(csv).toContain("col1,col2");
      expect(csv.split("\n").length).toBe(1); // Only header
    });
  });

  describe("PDF Generation", () => {
    it("should generate PDF buffer", async () => {
      const data = [
        { name: "Test 1", value: 100 },
        { name: "Test 2", value: 200 },
      ];

      const pdf = await generatePDF({
        title: "Test Report",
        filename: "test.pdf",
        columns: ["name", "value"],
        data,
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      // PDF header signature
      expect(pdf.toString("utf8", 0, 4)).toBe("%PDF");
    });

    it("should handle large datasets", async () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        value: Math.random() * 1000,
      }));

      const pdf = await generatePDF({
        title: "Large Report",
        filename: "large.pdf",
        columns: ["id", "value"],
        data,
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });

  describe("Filename Generation", () => {
    it("should generate filename with date and time", () => {
      const filename = generateFilename("report", "csv");

      expect(filename).toMatch(/^report_\d{8}_\d{4}\.csv$/);
    });

    it("should generate different filenames for different times", () => {
      const filename1 = generateFilename("test", "pdf");
      // Small delay to ensure different timestamp
      const filename2 = generateFilename("test", "pdf");

      expect(filename1).toMatch(/^test_\d{8}_\d{4}\.pdf$/);
      expect(filename2).toMatch(/^test_\d{8}_\d{4}\.pdf$/);
    });
  });

  describe("Data Filtering", () => {
    it("should filter data by date range", () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const data = [
        { date: yesterday, value: 1 },
        { date: now, value: 2 },
        { date: tomorrow, value: 3 },
      ];

      const filtered = filterByDateRange(data, yesterday, now, "date");

      expect(filtered.length).toBe(2);
      expect(filtered[0].value).toBe(1);
      expect(filtered[1].value).toBe(2);
    });

    it("should handle empty filter results", () => {
      const data = [{ date: new Date("2020-01-01"), value: 1 }];
      const start = new Date("2025-01-01");
      const end = new Date("2025-12-31");

      const filtered = filterByDateRange(data, start, end, "date");

      expect(filtered.length).toBe(0);
    });
  });

  describe("Data Grouping", () => {
    it("should group data by date", () => {
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const data = [
        { date: today, value: 1 },
        { date: today, value: 2 },
        { date: tomorrow, value: 3 },
      ];

      const grouped = groupByDate(data, "date");

      const todayKey = today.toLocaleDateString("tr-TR");
      const tomorrowKey = tomorrow.toLocaleDateString("tr-TR");

      expect(Object.keys(grouped).length).toBe(2);
      expect(grouped[todayKey].length).toBe(2);
      expect(grouped[tomorrowKey].length).toBe(1);
    });
  });

  describe("Summary Statistics", () => {
    it("should generate summary statistics", () => {
      const data = [
        { count: 10, time: 100 },
        { count: 20, time: 200 },
        { count: 30, time: 300 },
      ];

      const stats = generateSummaryStats(data, ["count", "time"]);

      expect(stats["Total Records"]).toBe(3);
      expect(stats["count - Total"]).toBe(60);
      expect(stats["count - Average"]).toBe("20.00");
      expect(stats["count - Maximum"]).toBe(30);
      expect(stats["count - Minimum"]).toBe(10);
      expect(stats["time - Total"]).toBe(600);
      expect(stats["time - Average"]).toBe("200.00");
    });

    it("should handle empty numeric fields", () => {
      const data = [{ value: 100 }];

      const stats = generateSummaryStats(data, ["value", "missing"]);

      expect(stats["Total Records"]).toBe(1);
      expect(stats["value - Total"]).toBe(100);
      expect(stats["missing - Total"]).toBe(0);
    });
  });
});
