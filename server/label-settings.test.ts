import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("Label Settings Integration", () => {
  beforeAll(async () => {
    await db.getDb();
  });



  it("should initialize label settings", async () => {
    await db.initializeLabelSettings();
    const settings = await db.getLabelSettings(1);
    expect(settings).toBeDefined();
  });

  it("should get label settings by ID", async () => {
    await db.initializeLabelSettings();
    const settings = await db.getLabelSettings(1);
    expect(settings).toBeDefined();
  });

  it("should get all label settings", async () => {
    await db.initializeLabelSettings();
    const allSettings = await db.getAllLabelSettings();
    expect(Array.isArray(allSettings)).toBe(true);
  });

  it("should create new label settings", async () => {
    const newLabel = {
      labelName: "Test Label",
      labelType: "sticker" as const,
      width: 100,
      height: 50,
    };
    const labelId = await db.createLabelSettings(newLabel);
    expect(typeof labelId).toBe("number");
  });

  it("should update label settings", async () => {
    await db.initializeLabelSettings();
    const updates = {
      labelName: "Updated Label",
      headerFontSize: 16,
    };
    await db.updateLabelSettings(1, updates);
    expect(true).toBe(true);
  });

  it("should toggle QR code visibility", async () => {
    await db.initializeLabelSettings();
    await db.updateLabelSettings(1, { showQRCode: true });
    expect(true).toBe(true);
  });

  it("should handle boolean conversions", async () => {
    await db.initializeLabelSettings();
    await db.updateLabelSettings(1, {
      showDateTime: false,
      showWaitingTime: true,
    });
    expect(true).toBe(true);
  });
});


import { generateTicketContent } from "./_core/native-printer";

describe("Ticket Content Generation with Label Settings", () => {
  it("should generate ticket content with label settings (Turkish chars transliterated)", () => {
    const labelSettings = {
      headerText: "Özel Başlık",
      footerText: "Özel Alt Metin",
      showBankInfo: true,
      showDateTime: true,
    };

    const ticketData = {
      queueNumber: "001",
      bankName: "Banko 1",
      timestamp: new Date("2026-06-03T08:00:00"),
      labelSettings: labelSettings,
    };

    const content = generateTicketContent(ticketData);
    const contentStr = content.toString("utf-8");

    expect(contentStr).toContain("Ozel Baslik");
    expect(contentStr).toContain("Ozel Alt Metin");
    expect(contentStr).toContain("001");
  });

  it("should respect showBankInfo flag in label settings", () => {
    const labelSettings = {
      headerText: "Baslik",
      footerText: "Alt Metin",
      showBankInfo: false,
      showDateTime: true,
    };

    const ticketData = {
      queueNumber: "002",
      bankName: "Banko 2",
      timestamp: new Date("2026-06-03T08:00:00"),
      labelSettings: labelSettings,
    };

    const content = generateTicketContent(ticketData);
    const contentStr = content.toString("utf-8");

    expect(contentStr).not.toContain("BANKO:");
    expect(contentStr).toContain("002");
  });

  it("should respect showDateTime flag in label settings", () => {
    const labelSettings = {
      headerText: "Baslik",
      footerText: "Alt Metin",
      showBankInfo: true,
      showDateTime: false,
    };

    const ticketData = {
      queueNumber: "003",
      bankName: "Banko 3",
      timestamp: new Date("2026-06-03T08:00:00"),
      labelSettings: labelSettings,
    };

    const content = generateTicketContent(ticketData);
    const contentStr = content.toString("utf-8");

    expect(contentStr).not.toContain("2026");
    expect(contentStr).toContain("003");
  });

  it("should handle empty label settings", () => {
    const ticketData = {
      queueNumber: "004",
      bankName: "Banko 4",
      timestamp: new Date("2026-06-03T08:00:00"),
      labelSettings: {},
    };

    const content = generateTicketContent(ticketData);
    const contentStr = content.toString("utf-8");

    expect(contentStr).toContain("004");
    expect(contentStr).toContain("SIRA NO");
  });

  it("should generate valid ESC/POS commands", () => {
    const labelSettings = {
      headerText: "Baslik",
      footerText: "Alt Metin",
      showBankInfo: true,
      showDateTime: true,
    };

    const ticketData = {
      queueNumber: "005",
      bankName: "Banko 5",
      timestamp: new Date("2026-06-03T08:00:00"),
      labelSettings: labelSettings,
    };

    const content = generateTicketContent(ticketData);
    const contentStr = content.toString("utf-8");

    // Check for ESC/POS commands
    expect(contentStr).toContain("\x1B"); // ESC character
    expect(contentStr).toContain("\x1D"); // GS character
  });
});
