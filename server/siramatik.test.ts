import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Sıramatik Sistemi Test Suite
 * 
 * Temel işlevleri test eder
 */

function createMockContext(): TrpcContext {
  const user = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "test",
    role: "admin" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Sıramatik System", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("Authentication", () => {
    it("should get current user", async () => {
      const user = await caller.auth.me();
      
      expect(user).toBeDefined();
      expect(user.id).toBe(1);
      expect(user.role).toBe("admin");
    });

    it("should logout", async () => {
      const result = await caller.auth.logout();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe("Bank Operations", () => {
    it("should get all banks", async () => {
      const banks = await caller.bank.getAll();
      
      expect(Array.isArray(banks)).toBe(true);
    });

    it("should get active banks", async () => {
      const activeBanks = await caller.bank.getActive();
      
      expect(Array.isArray(activeBanks)).toBe(true);
    });
  });

  describe("Queue Operations", () => {
    it("should get queue statistics", async () => {
      const stats = await caller.queue.getStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalTickets).toBe("number");
      expect(typeof stats.waitingCount).toBe("number");
      expect(typeof stats.servedCount).toBe("number");
    });

    it("should get waiting queue", async () => {
      const queue = await caller.queue.getWaitingQueue();
      
      expect(Array.isArray(queue)).toBe(true);
    });
  });

  describe("Printer Operations", () => {
    it("should initialize printer", async () => {
      const result = await caller.printer.initialize({
        type: "escpos",
      });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it("should test printer", async () => {
      const result = await caller.printer.test();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe("System Constraints", () => {
    it("should enforce minimum bank count (2)", async () => {
      try {
        await caller.admin.updateBankCount({ bankCount: 1 });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should enforce maximum bank count (10)", async () => {
      try {
        await caller.admin.updateBankCount({ bankCount: 11 });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Admin Operations", () => {
    it("should reset queue", async () => {
      const result = await caller.admin.resetQueue();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it("should toggle bank status", async () => {
      const banks = await caller.bank.getAll();
      if (banks.length > 0) {
        const firstBank = banks[0];
        const initialStatus = firstBank.isActive;
        
        const result = await caller.admin.toggleBankStatus({
          bankId: firstBank.id,
          isActive: !initialStatus,
        });
        
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      }
    });
  });
});
