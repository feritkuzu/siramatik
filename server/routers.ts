import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { printTicket } from "./_core/printer";
import { printUSBTicket, initializeUSBPrinter, testUSBPrinter, listUSBPrinters } from "./_core/printer-usb";

export const appRouter = router({
  queue: router({
    // Get next ticket number and create queue entry
    createTicket: publicProcedure
      .input(z.object({ phoneNumber: z.string().optional() }))
      .mutation(async ({ input }) => {
      try {
        const config = await db.getSystemConfig();
        if (!config) throw new Error("System not initialized");
        
        const ticketNumber = await db.incrementQueueNumber();
        const entry = await db.createQueueEntry(ticketNumber, "none", input.phoneNumber);
        await db.logSystemEvent("ticket_created", undefined, entry.id, { ticketNumber, isPriority: false });
        
        // USB termal yazıcıya gönder (arka planda)
        const waitingQueue = await db.getWaitingQueue();
        printUSBTicket(ticketNumber, waitingQueue?.length || 1).catch((err) => 
          console.error("USB Printer error:", err)
        );
        
        return {
          success: true,
          ticketNumber,
          entryId: entry.id,
          isPriority: false,
        };
      } catch (error) {
        console.error("Failed to create ticket:", error);
        throw error;
      }
    }),
    
    // Create priority ticket (elderly, disabled, pregnant)
    createPriorityTicket: publicProcedure
      .input(z.object({ priorityType: z.enum(["elderly", "disabled", "pregnant"]), phoneNumber: z.string().optional() }))
      .mutation(async ({ input }) => {
        try {
          const config = await db.getSystemConfig();
          if (!config) throw new Error("System not initialized");
          
          const ticketNumber = await db.incrementQueueNumber();
          const entry = await db.createQueueEntry(ticketNumber, input.priorityType, input.phoneNumber);
          await db.logSystemEvent("priority_ticket_created", undefined, entry.id, { ticketNumber, priorityType: input.priorityType });
          
          // USB termal yazıcıya gönder
          const waitingQueue = await db.getWaitingQueue();
          printUSBTicket(ticketNumber, waitingQueue?.length || 1).catch((err) => 
            console.error("USB Printer error:", err)
          );
          
          return {
            success: true,
            ticketNumber,
            entryId: entry.id,
            isPriority: true,
            priorityType: input.priorityType,
          };
        } catch (error) {
          console.error("Failed to create priority ticket:", error);
          throw error;
        }
      }),

    // Get waiting queue
    getWaitingQueue: publicProcedure.query(async () => {
      return await db.getWaitingQueue();
    }),

    // Get next waiting entry
    getNextWaitingEntry: publicProcedure.query(async () => {
      return await db.getNextWaitingEntry();
    }),

    // Update queue entry status
    updateQueueEntryStatus: publicProcedure
      .input(z.object({ entryId: z.number(), status: z.string() }))
      .mutation(async ({ input }) => {
        try {
          await db.updateQueueEntryStatus(input.entryId, input.status);
          await db.logSystemEvent("queue_entry_status_updated", undefined, input.entryId, { status: input.status });
          return { success: true };
        } catch (error) {
          console.error("Failed to update queue entry status:", error);
          throw error;
        }
      }),

    // Get estimated wait time
    getEstimatedWaitTime: publicProcedure
      .input(z.object({ ticketNumber: z.number() }))
      .query(async ({ input }) => {
        const waitTime = await db.calculateEstimatedWaitTime(input.ticketNumber);
        return { estimatedWaitTime: waitTime };
      }),

    // Get queue stats
    getStats: publicProcedure.query(async () => {
      try {
        const waiting = await db.getWaitingQueue();
        const completed = await db.getQueueStats();
        
        return {
          waitingCount: waiting.length,
          totalProcessed: completed.totalProcessed,
          totalCompleted: completed.totalProcessed,
          averageServiceTime: completed.averageServiceTime,
          averageWaitTime: 0,
        };
      } catch (error) {
        console.error("Failed to get queue stats:", error);
        return {
          waitingCount: 0,
          totalProcessed: 0,
          totalCompleted: 0,
          averageServiceTime: 0,
          averageWaitTime: 0,
        };
      }
    }),
  }),

  bank: router({
    // Get all banks
    getAll: publicProcedure.query(async () => {
      const banks = await db.getAllBanks();
      return banks.map((bank: any) => ({
        id: bank.id,
        bankNumber: bank.bank_number,
        isActive: bank.is_active === 1,
        isOccupied: bank.is_occupied === 1,
        currentQueueEntryId: bank.current_queue_entry_id,
        totalServed: bank.total_served,
        createdAt: bank.created_at,
        updatedAt: bank.updated_at,
      }));
    }),

    // Get available bank
    getAvailable: publicProcedure.query(async () => {
      return await db.getAvailableBank();
    }),
  }),

  admin: router({
    // Initialize system
    initialize: publicProcedure
      .input(z.object({ bankCount: z.number().min(2).max(10) }))
      .mutation(async ({ input }) => {
        try {
          await db.initializeSystem(input.bankCount);
          return { success: true };
        } catch (error) {
          console.error("Failed to initialize system:", error);
          throw error;
        }
      }),

    // Get system config
    getConfig: publicProcedure.query(async () => {
      const config = await db.getSystemConfig();
      if (!config) return null;
      return {
        id: config.id,
        totalBanks: config.totalBanks,
        currentQueueNumber: config.currentQueueNumber,
        isSystemActive: config.isSystemActive,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    }),

    // Update bank count
    updateBankCount: publicProcedure
      .input(z.object({ count: z.number().min(2).max(10) }))
      .mutation(async ({ input }) => {
        try {
          await db.updateSystemConfig({ totalBanks: input.count });
          await db.initializeBanks(input.count);
          await db.logSystemEvent("bank_count_updated", undefined, undefined, { newCount: input.count });
          return { success: true };
        } catch (error) {
          console.error("Failed to update bank count:", error);
          throw error;
        }
      }),

    // Get all banks
    getAllBanks: publicProcedure.query(async () => {
      const banks = await db.getAllBanks();
      return banks.map((bank: any) => ({
        id: bank.id,
        bankNumber: bank.bank_number,
        isActive: bank.is_active === 1,
        isOccupied: bank.is_occupied === 1,
        currentQueueEntryId: bank.current_queue_entry_id,
        totalServed: bank.total_served,
        createdAt: bank.created_at,
        updatedAt: bank.updated_at,
      }));
    }),

    // Toggle bank status
    toggleBankStatus: publicProcedure
      .input(z.object({ bankId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          const bank = await db.getBankById(input.bankId);
          if (!bank) throw new Error("Bank not found");
          await db.updateBankStatus(input.bankId, !bank.isActive, null);
          await db.logSystemEvent("bank_status_toggled", input.bankId, undefined, { isActive: !bank.isActive });
          return { success: true };
        } catch (error) {
          console.error("Failed to toggle bank status:", error);
          throw error;
        }
      }),

    // Get sound settings
    getSoundSettings: publicProcedure.query(async () => {
      const settings = await db.getSoundSettings();
      return settings || {
        id: 1,
        soundType: "chime" as const,
        soundVolume: 70,
        isEnabled: true,
        animationType: "pulse" as const,
        animationSpeed: "normal" as const,
        customSoundUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

    // Get printer settings
    getPrinterSettings: publicProcedure.query(async () => {
      try {
        const settings = await db.getPrinterSettings();
        return settings || {
          id: 1,
          isEnabled: true,
          vendorId: 0x0483,
          productId: 0x3743,
          printerType: "escpos",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } catch (error) {
        console.error("Failed to get printer settings:", error);
        return null;
      }
    }),

    // Update printer settings
    updatePrinterSettings: publicProcedure
      .input(z.object({
        isEnabled: z.boolean().optional(),
        vendorId: z.number().optional(),
        productId: z.number().optional(),
        printerType: z.enum(["escpos", "network", "bluetooth"]).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await db.updatePrinterSettings(input);
          await db.logSystemEvent("printer_settings_updated", undefined, undefined, input);
          return { success: true };
        } catch (error) {
          console.error("Failed to update printer settings:", error);
          throw error;
        }
      }),

    // Test printer
    testPrinter: publicProcedure.mutation(async () => {
      try {
        const result = await testUSBPrinter();
        await db.logSystemEvent("printer_test", undefined, undefined, { success: result });
        return { success: result, message: result ? "Test yazdırması başarılı" : "Yazıcı bağlantısı kurulamadı" };
      } catch (error) {
        console.error("Failed to test printer:", error);
        return { success: false, message: "Test yazdırması başarısız" };
      }
    }),

    // List available USB printers
    listUSBPrinters: publicProcedure.query(async () => {
      try {
        const printers = listUSBPrinters();
        return printers;
      } catch (error) {
        console.error("Failed to list USB printers:", error);
        return [];
      }
    }),

    // Update sound settings
      updateSoundSettings: publicProcedure
      .input(z.object({
        soundType: z.enum(["bell", "chime", "alarm", "beep", "siren", "notification", "custom"]).optional(),
        soundVolume: z.number().min(0).max(100).optional(),
        isEnabled: z.boolean().optional(),
        animationType: z.enum(["pulse", "flash", "bounce", "shake", "rainbow", "glow"]).optional(),
        animationSpeed: z.enum(["slow", "normal", "fast"]).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await db.updateSoundSettings(input);
          await db.logSystemEvent("sound_settings_updated", undefined, undefined, input);
          return { success: true };
        } catch (error) {
          console.error("Failed to update sound settings:", error);
          throw error;
        }
      }),

    // Reset queue (admin only)
    resetQueue: publicProcedure.mutation(async () => {
      try {
        await db.resetQueue();
        await db.logSystemEvent("queue_reset", undefined, undefined, {});
        return { success: true };
      } catch (error) {
        console.error("Failed to reset queue:", error);
        throw error;
      }
    }),
  }),

  analytics: router({
    generateReport: publicProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date() }))
      .query(async ({ input }) => {
        try {
          const stats = await db.getSystemStats(input.startDate, input.endDate);
          return stats;
        } catch (error) {
          console.error("Failed to generate report:", error);
          throw error;
        }
      }),

    getBankPerformance: publicProcedure.query(async () => {
      try {
        const banks = await db.getAllBanks();
        return banks.map(bank => ({
          bankNumber: bank.bankNumber,
          totalServed: bank.totalServed,
          isActive: bank.isActive,
        }));
      } catch (error) {
        console.error("Failed to get bank performance:", error);
        throw error;
      }
    }),

    getDailyStats: publicProcedure
      .input(z.object({ date: z.date() }))
      .query(async ({ input }) => {
        try {
          const stats = await db.getSystemStats(input.date, new Date(input.date.getTime() + 24 * 60 * 60 * 1000));
          return stats;
        } catch (error) {
          console.error("Failed to get daily stats:", error);
          throw error;
        }
      }),

    getHourlyStats: publicProcedure
      .input(z.object({ date: z.date() }))
      .query(async ({ input }) => {
        try {
          const stats = await db.getSystemStats(input.date, new Date(input.date.getTime() + 60 * 60 * 1000));
          return stats;
        } catch (error) {
          console.error("Failed to get hourly stats:", error);
          throw error;
        }
      }),
  }),

  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      return ctx.user || null;
    }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      return { success: true };
    }),
  })
});

export type AppRouter = typeof appRouter;
