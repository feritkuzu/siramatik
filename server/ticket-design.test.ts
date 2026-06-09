import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Ticket Design Settings", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    // Initialize database
    await db.getDb();
    await db.initializeTicketDesign();
    
    // Create caller
    caller = appRouter.createCaller({
      user: null,
      req: null,
      res: null,
    });
  });

  it("should get ticket design settings", async () => {
    // Reset to defaults first
    await caller.admin.updateTicketDesign({
      companyName: "SIRAMATIK",
      companySubtitle: "Sıra Numarası Sistemi",
      ticketWidth: 58,
      showQueuePosition: true,
      showDateTime: true,
      showBankInfo: true,
    });
    
    const design = await caller.admin.getTicketDesign();
    
    expect(design).toBeDefined();
    expect(design.id).toBeDefined();
    expect(design.companyName).toBe("SIRAMATIK");
    expect(design.companySubtitle).toBeDefined();
    expect(design.ticketWidth).toBe(58);
    expect(typeof design.showQueuePosition).toBe("boolean");
    expect(typeof design.showDateTime).toBe("boolean");
    expect(typeof design.showBankInfo).toBe("boolean");
  });

  it("should update company name", async () => {
    // Reset to defaults first
    await caller.admin.updateTicketDesign({
      companyName: "SIRAMATIK",
      companySubtitle: "Sıra Numarası Sistemi",
      ticketWidth: 58,
      showQueuePosition: true,
      showDateTime: true,
      showBankInfo: true,
    });
    
    const result = await caller.admin.updateTicketDesign({
      companyName: "TEST KURUMU",
    });
    
    expect(result.success).toBe(true);
    
    // Verify update
    const updated = await caller.admin.getTicketDesign();
    expect(updated.companyName).toBe("TEST KURUMU");
  });

  it("should update custom messages", async () => {
    // Reset to defaults first
    await caller.admin.updateTicketDesign({
      customMessage1: "",
      customMessage2: "",
      customMessage3: "",
    });
    
    const result = await caller.admin.updateTicketDesign({
      customMessage1: "Hoşgeldiniz",
      customMessage2: "Lütfen bekleyiniz",
      customMessage3: "Teşekkür ederiz",
    });
    
    expect(result.success).toBe(true);
    
    // Verify update
    const updated = await caller.admin.getTicketDesign();
    expect(updated.customMessage1).toBe("Hoşgeldiniz");
    expect(updated.customMessage2).toBe("Lütfen bekleyiniz");
    expect(updated.customMessage3).toBe("Teşekkür ederiz");
  });

  it("should toggle display options", async () => {
    // Reset to defaults first
    await caller.admin.updateTicketDesign({
      showQueuePosition: true,
      showDateTime: true,
      showBankInfo: true,
    });
    
    const result = await caller.admin.updateTicketDesign({
      showQueuePosition: false,
      showDateTime: false,
      showBankInfo: false,
    });
    
    expect(result.success).toBe(true);
    
    // Verify update
    const updated = await caller.admin.getTicketDesign();
    expect(updated.showQueuePosition).toBe(false);
    expect(updated.showDateTime).toBe(false);
    expect(updated.showBankInfo).toBe(false);
  });

  it("should update ticket width", async () => {
    // Reset to defaults first
    await caller.admin.updateTicketDesign({
      ticketWidth: 58,
    });
    
    const result = await caller.admin.updateTicketDesign({
      ticketWidth: 80,
    });
    
    expect(result.success).toBe(true);
    
    // Verify update
    const updated = await caller.admin.getTicketDesign();
    expect(updated.ticketWidth).toBe(80);
  });
});
