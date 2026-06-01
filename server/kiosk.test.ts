import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Kiosk Ticket Creation", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    // Initialize database
    await db.getDb();
    
    // Initialize system with 2 banks
    await db.initializeSystem(2);
    
    // Create caller
    caller = appRouter.createCaller({
      user: null,
      req: null,
      res: null,
    });
  });

  it("should create a regular ticket with phone number", async () => {
    const result = await caller.queue.createTicket({
      phoneNumber: "5551234567",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.ticketNumber).toBeGreaterThan(0);
    expect(result.entryId).toBeGreaterThan(0);
    expect(result.isPriority).toBe(false);
  });

  it("should create a priority ticket (elderly)", async () => {
    const result = await caller.queue.createPriorityTicket({
      priorityType: "elderly",
      phoneNumber: "5559876543",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.ticketNumber).toBeGreaterThan(0);
    expect(result.entryId).toBeGreaterThan(0);
    expect(result.isPriority).toBe(true);
  });

  it("should create a ticket without phone number", async () => {
    const result = await caller.queue.createTicket({
      phoneNumber: undefined,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.ticketNumber).toBeGreaterThan(0);
    expect(result.entryId).toBeGreaterThan(0);
  });

  it("should store phone number in queue entry", async () => {
    const phoneNumber = "5555555555";
    const result = await caller.queue.createTicket({
      phoneNumber,
    });

    // Verify entry was created with phone number
    const entry = await db.getQueueEntryById(result.entryId);
    expect(entry).toBeDefined();
    expect(entry?.phoneNumber).toBe(phoneNumber);
  });

  it("should increment ticket numbers sequentially", async () => {
    const result1 = await caller.queue.createTicket({
      phoneNumber: "5551111111",
    });
    const result2 = await caller.queue.createTicket({
      phoneNumber: "5552222222",
    });

    expect(result2.ticketNumber).toBeGreaterThan(result1.ticketNumber);
  });

  afterAll(async () => {
    // Cleanup if needed
  });
});
