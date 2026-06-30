import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { randomBytes } from "crypto";

const superadminTokens = new Map<string, number>(); // token -> expiry
import { generateCSV, generatePDF, generateFilename } from "./_core/export";
import { printTicket } from "./_core/printer";
import { printUSBTicket, initializeUSBPrinter, testUSBPrinter, listUSBPrinters } from "./_core/printer-usb";
import { listWindowsPrinters, getPrinterSettings, updatePrinterSettings, testWindowsPrinter, printTicketToWindowsPrinter } from "./_core/windows-printer";
import { getConnectedBankIds, getIO, emitCustomerCalled, emitServiceCompleted } from "./_core/socket";
import { listWindowsPrinters as listNativePrinters, getDefaultPrinter, printToWindowsPrinter, testPrintToWindowsPrinter, generateTicketContent } from "./_core/native-printer";

export const appRouter = router({
  queue: router({
    // Get next ticket number and create queue entry
    createTicket: publicProcedure
      .input(z.object({ phoneNumber: z.string().optional() }))
      .mutation(async ({ input }) => {
      try {
        const config = await db.getSystemConfig();
        if (!config) throw new Error("System not initialized");
        if (!config.isSystemActive) throw new Error("SİSTEM KAPALI");
        
        // Check business hours and working days
        const now = new Date();
        const day = now.getDay();
        const minutes = now.getHours() * 60 + now.getMinutes();
        const days = (config.workingDays || "1,2,3,4,5").split(",").map(Number);
        const start = (config.businessHoursStart || "09:00").split(":").map(Number);
        const end = (config.businessHoursEnd || "18:00").split(":").map(Number);
        const startMin = start[0] * 60 + start[1];
        const endMin = end[0] * 60 + end[1];
        if (!days.includes(day)) throw new Error("BUGÜN ÇALIŞMA GÜNÜ DEĞİL");
        if (minutes < startMin || minutes >= endMin) {
          // Past closing time - auto-clear queue
          try { await db.resetQueue(); } catch {}
          throw new Error("ÇALIŞMA SAATLERİ DIŞINDA");
        }
        
        const ticketNumber = await db.incrementQueueNumber();
        const entry = await db.createQueueEntry(ticketNumber, "none", input.phoneNumber);
        await db.logSystemEvent("ticket_created", undefined, entry.id, { ticketNumber, isPriority: false });
        
        // Get label settings and print ticket
        const waitingQueue = await db.getWaitingQueue();
        const labelSettings = await db.getActiveLabelSettings();
        
        // Windows yazıcıya gönder (arka planda)
        try {
          const printerSettings = await db.getPrinterSettings();
          if (printerSettings?.windowsPrinterName) {
            const ticketContent = generateTicketContent({
              queueNumber: ticketNumber.toString(),
              timestamp: new Date(),
              labelSettings: labelSettings,
            });
            const result = await printToWindowsPrinter({
              printerName: printerSettings.windowsPrinterName,
              data: ticketContent,
            });
            console.log(`[Queue] Ticket ${ticketNumber} Windows printer result:`, result.message);
          } else {
            console.log(`[Queue] Ticket ${ticketNumber} atlandi - windowsPrinterName yok`);
          }
        } catch (err) {
          console.error("[Queue] Windows Printer error:", err);
        }
        
        // USB termal yazıcıya gönder (arka planda)
        try {
          await initializeUSBPrinter();
          await printUSBTicket(ticketNumber, waitingQueue?.length || 1);
          console.log(`[Queue] Ticket ${ticketNumber} printed to USB printer`);
        } catch (err) {
          console.error("[Queue] USB Printer error:", err);
        }
        
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
          if (!config.isSystemActive) throw new Error("SİSTEM KAPALI");
          
          const ticketNumber = await db.incrementQueueNumber();
          const entry = await db.createQueueEntry(ticketNumber, input.priorityType, input.phoneNumber);
          await db.logSystemEvent("priority_ticket_created", undefined, entry.id, { ticketNumber, priorityType: input.priorityType });
          
          // USB termal yazıcıya gönder
          const waitingQueue = await db.getWaitingQueue();
          try {
            await initializeUSBPrinter();
            await printUSBTicket(ticketNumber, waitingQueue?.length || 1);
            console.log(`[Queue] Priority ticket ${ticketNumber} printed to USB printer`);
          } catch (err) {
            console.error("[Queue] USB Printer error:", err);
          }
          
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

    // Get currently called entries (for display screen sync)
    getActiveCalled: publicProcedure.query(async () => {
      return await db.getActiveCalledEntries();
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

    // Call next customer for a bank
    callNext: publicProcedure
      .input(z.object({ bankId: z.number(), operatorId: z.number().optional() }))
      .mutation(async ({ input }) => {
        const result = await db.callNextCustomer(input.bankId, input.operatorId);
        if (!result) throw new Error("No waiting customers");
        await db.logSystemEvent("customer_called", input.bankId, result.id, {
          ticketNumber: result.ticketNumber,
        });
        emitCustomerCalled({
          ticketNumber: result.ticketNumber,
          bankId: input.bankId,
          entryId: result.id,
          phoneNumber: result.phoneNumber,
          isPriority: result.priorityType && result.priorityType !== "none",
          priorityType: result.priorityType,
        });
        return result;
      }),

    // Call specific customer from waiting queue (urgent / special call)
    callSpecific: publicProcedure
      .input(z.object({ bankId: z.number(), entryId: z.number(), operatorId: z.number().optional() }))
      .mutation(async ({ input }) => {
        const result = await db.callSpecificEntry(input.bankId, input.entryId, input.operatorId);
        if (!result) throw new Error("Customer not found or already called");
        await db.logSystemEvent("customer_called_specific", input.bankId, result.id, {
          ticketNumber: result.ticketNumber,
        });
        emitCustomerCalled({
          ticketNumber: result.ticketNumber,
          bankId: input.bankId,
          entryId: result.id,
          phoneNumber: result.phoneNumber,
          isPriority: result.priorityType && result.priorityType !== "none",
          priorityType: result.priorityType,
        });
        return result;
      }),

    // Mark customer as arrived (ticket received at counter)
    markReceived: publicProcedure
      .input(z.object({ entryId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.markReceived(input.entryId);
        return { success: true };
      }),

    // Skip no-show customer and call next
    skipNoShow: publicProcedure
      .input(z.object({ bankId: z.number(), entryId: z.number() }))
      .mutation(async ({ input }) => {
        await db.skipNoShow(input.bankId, input.entryId);
        return { success: true };
      }),

    requeueEntry: publicProcedure
      .input(z.object({ bankId: z.number(), entryId: z.number() }))
      .mutation(async ({ input }) => {
        await db.requeueEntry(input.bankId, input.entryId);
        return { success: true };
      }),

    // Get skipped (no-show) entries
    getSkippedEntries: publicProcedure.query(async () => {
      return db.getSkippedEntries();
    }),

    // Complete service for a bank
    completeService: publicProcedure
      .input(z.object({ bankId: z.number(), entryId: z.number() }))
      .mutation(async ({ input }) => {
        const entry = await db.getQueueEntryById(input.entryId);
        await db.completeService(input.bankId, input.entryId);
        await db.logSystemEvent("service_completed", input.bankId, input.entryId, {});
        if (entry) {
          emitServiceCompleted({
            ticketNumber: entry.ticketNumber,
            bankId: input.bankId,
            entryId: input.entryId,
          });
        }
        return { success: true };
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
          totalTickets: completed.totalProcessed + waiting.length,
          waitingCount: waiting.length,
          totalProcessed: completed.totalProcessed,
          totalCompleted: completed.totalProcessed,
          totalNoShow: completed.totalNoShow,
          averageServiceTime: completed.averageServiceTime,
          averageWaitTime: 0,
        };
      } catch (error) {
        console.error("Failed to get queue stats:", error);
        return {
          totalTickets: 0,
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
        bankNumber: bank.bankNumber,
        isActive: bank.isActive,
        isOccupied: bank.isOccupied,
        currentQueueEntryId: bank.currentQueueEntryId,
        assignedOperatorId: bank.assignedOperatorId,
        totalServed: bank.totalServed,
        ipAddress: bank.ipAddress || "",
        createdAt: bank.createdAt,
        updatedAt: bank.updatedAt,
      }));
    }),

    // Get available bank
    getAvailable: publicProcedure.query(async () => {
      return await db.getAvailableBank();
    }),

    // Get my bank based on MAC address (or IP as fallback)
    getMyBank: publicProcedure
      .input(z.object({ macAddress: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        // Try MAC address first (from client/Electron)
        if (input?.macAddress) {
          const banks = await db.getAllBanks();
          const bank = banks.find((b: any) => b.macAddress === input.macAddress);
          if (bank) return bank;
        }
        // Fallback to IP-based detection
        const clientIp = ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || ctx.req.socket.remoteAddress || "";
        const ip = clientIp.replace(/^::ffff:/, "");
        if (ip) {
          const banks = await db.getAllBanks();
          const bank = banks.find((b: any) => b.ipAddress === ip);
          if (bank) return bank;
        }
        return null;
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

    // Shutdown system
    shutdown: publicProcedure.mutation(async () => {
      await db.shutdownSystem();
      const io = getIO();
      if (io) {
        io.emit("system:shutdown", { timestamp: Date.now() });
      }
      return { success: true };
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
        systemName: config.systemName,
        queuePrefix: config.queuePrefix,
        maxQueueNumber: config.maxQueueNumber,
        businessHoursStart: config.businessHoursStart,
        businessHoursEnd: config.businessHoursEnd,
        kioskMessage: config.kioskMessage,
        kioskMode: config.kioskMode,
        weatherCity: config.weatherCity || "",
        themeBg: config.themeBg || "#000000",
        themeText: config.themeText || "#ffffff",
        themeHeader: config.themeHeader || "#ff006e",
        themeSubheader: config.themeSubheader || "#00d9ff",
        themeFont: config.themeFont || "Courier New, monospace",
        themeBorder: config.themeBorder || "#1b98a0",
        announcements: config.announcements || "",
        tickerSpeed: config.tickerSpeed ?? 8,
        tickerFontSize: config.tickerFontSize ?? 22,
        workingDays: config.workingDays || "1,2,3,4,5",
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    }),

    // Superadmin passcode verification
    verifyPasscode: publicProcedure
      .input(z.object({ passcode: z.string() }))
      .mutation(async ({ input }) => {
        const config = await db.getSystemConfig();
        if (!config || config.superadminPasscode !== input.passcode) {
          return { success: false, token: null };
        }
        const token = randomBytes(32).toString("hex");
        superadminTokens.set(token, Date.now() + 3600000);
        return { success: true, token };
      }),

    validateSuperadminToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const expiry = superadminTokens.get(input.token);
        if (!expiry || expiry < Date.now()) {
          superadminTokens.delete(input.token);
          return { valid: false };
        }
        return { valid: true };
      }),

    // Get currently connected bank IDs (via socket)
    getConnectedBanks: publicProcedure.query(async () => {
      return getConnectedBankIds();
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
        bankNumber: bank.bankNumber,
        isActive: bank.isActive,
        isOccupied: bank.isOccupied,
        currentQueueEntryId: bank.currentQueueEntryId,
        assignedOperatorId: bank.assignedOperatorId,
        totalServed: bank.totalServed,
        ipAddress: bank.ipAddress || "",
        macAddress: bank.macAddress || "",
        createdAt: bank.createdAt,
        updatedAt: bank.updatedAt,
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

    // Bank operator management
    getBankOperators: publicProcedure.query(async () => {
      return await db.getAllBankOperators();
    }),

    createBankOperator: publicProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ input }) => {
        return await db.createBankOperator(input.name);
      }),

    updateBankOperator: publicProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(100) }))
      .mutation(async ({ input }) => {
        return await db.updateBankOperator(input.id, input.name);
      }),

    deleteBankOperator: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteBankOperator(input.id);
        return { success: true };
      }),

    assignBankOperator: publicProcedure
      .input(z.object({ bankId: z.number(), operatorId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        await db.assignOperatorToBank(input.bankId, input.operatorId);
        const bank = await db.getBankById(input.bankId);
        const bankData = bank ? {
          id: bank.id,
          bankNumber: bank.bankNumber,
          isActive: bank.isActive,
          isOccupied: bank.isOccupied,
          currentQueueEntryId: bank.currentQueueEntryId,
          assignedOperatorId: (bank as any).assignedOperatorId,
          totalServed: bank.totalServed,
        } : null;
      return { success: true, bank: bankData };
    }),

    updateBankIpAddress: publicProcedure
      .input(z.object({ bankId: z.number(), ipAddress: z.string().max(15) }))
      .mutation(async ({ input }) => {
        await db.updateBankIpAddress(input.bankId, input.ipAddress);
        return { success: true };
      }),

    updateBankMacAddress: publicProcedure
      .input(z.object({ bankId: z.number(), macAddress: z.string().max(17) }))
      .mutation(async ({ input }) => {
        await db.updateBankMacAddress(input.bankId, input.macAddress);
        return { success: true };
      }),

    // Update system settings
    updateSystemSettings: publicProcedure
      .input(z.object({
        systemName: z.string().max(100).optional(),
        queuePrefix: z.string().max(10).optional(),
        maxQueueNumber: z.number().min(0).max(99999).optional(),
        businessHoursStart: z.string().max(5).optional(),
        businessHoursEnd: z.string().max(5).optional(),
        kioskMessage: z.string().max(500).optional(),
        kioskMode: z.enum(["touch", "usb_keypad", "single_button"]).optional(),
        weatherCity: z.string().max(100).optional(),
        themeBg: z.string().max(20).optional(),
        themeText: z.string().max(20).optional(),
        themeHeader: z.string().max(20).optional(),
        themeSubheader: z.string().max(20).optional(),
        themeFont: z.string().max(100).optional(),
        themeBorder: z.string().max(20).optional(),
        announcements: z.string().max(2000).optional(),
        tickerSpeed: z.number().min(3).max(30).optional(),
        tickerFontSize: z.number().min(12).max(60).optional(),
        workingDays: z.string().max(20).optional(),
        serialBtn1Action: z.enum(["simple_ticket", "normal_ticket", "priority_elderly", "priority_disabled", "priority_pregnant"]).optional(),
        serialBtn2Action: z.enum(["simple_ticket", "normal_ticket", "priority_elderly", "priority_disabled", "priority_pregnant"]).optional(),
        isSystemActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateSystemConfig(input);
        return { success: true };
      }),

    // Get sound settings
    getSoundSettings: publicProcedure.query(async () => {
      const settings = await db.getSoundSettings();
      if (!settings) {
        return {
          id: 1,
          soundType: "chime" as const,
          soundVolume: 70,
          isEnabled: true,
          voiceEnabled: true,
          animationType: "pulse" as const,
          animationSpeed: "normal" as const,
          customSoundUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return {
        id: settings.id,
        soundType: settings.sound_type,
        soundVolume: settings.sound_volume,
        isEnabled: !!(settings.is_enabled),
        voiceEnabled: !!(settings.voice_enabled),
        animationType: settings.animation_type,
        animationSpeed: settings.animation_speed,
        customSoundUrl: settings.custom_sound_url,
        createdAt: settings.created_at,
        updatedAt: settings.updated_at,
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
        windowsPrinterName: z.string().optional(),
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

    // List Windows system printers
    listWindowsPrinters: publicProcedure.query(async () => {
      try {
        const printers = await listNativePrinters();
        return printers;
      } catch (error) {
        console.error("Failed to list Windows printers:", error);
        return [];
      }
    }),

    // Get default Windows printer
    getDefaultWindowsPrinter: publicProcedure.query(async () => {
      try {
        const defaultPrinter = await getDefaultPrinter();
        return { printerName: defaultPrinter || "" };
      } catch (error) {
        console.error("Failed to get default printer:", error);
        return { printerName: "" };
      }
    }),

    // Test Windows printer
    testWindowsPrinterEndpoint: publicProcedure
      .input(z.object({
        printerName: z.string(),
        labelSettings: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
      try {
        if (input.labelSettings) {
          const { generateTicketContent } = await import('./_core/native-printer');
          const { printToWindowsPrinter } = await import('./_core/native-printer');
          const content = generateTicketContent({
            queueNumber: 'TEST',
            bankName: 'Test Banko',
            timestamp: new Date(),
            companyName: input.labelSettings.labelName || 'Sıramatik',
            customMessage: input.labelSettings.footerText,
            labelSettings: input.labelSettings,
          });
          const result = await printToWindowsPrinter({ printerName: input.printerName, data: content, type: 'RAW' });
          return result;
        }
        const result = await testPrintToWindowsPrinter(input.printerName);
        return result;
      } catch (error) {
        console.error("Failed to test Windows printer:", error);
        return {
          success: false,
          message: `Test basarısız: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
        };
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

    // Get ticket design settings
    getTicketDesign: publicProcedure.query(async () => {
      try {
        const design = await db.getTicketDesign();
        return design || {
          id: 1,
          companyName: "SIRAMATIK",
          companySubtitle: "Sira Numarasi Sistemi",
          logoUrl: null,
          headerText: null,
          footerText: null,
          ticketWidth: 58,
          showQueuePosition: true,
          showDateTime: true,
          showBankInfo: true,
          customMessage1: null,
          customMessage2: null,
          customMessage3: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } catch (error) {
        console.error("Failed to get ticket design:", error);
        throw error;
      }
    }),

    // Update ticket design settings
    updateTicketDesign: publicProcedure
      .input(z.object({
        companyName: z.string().optional(),
        companySubtitle: z.string().optional(),
        logoUrl: z.string().optional(),
        headerText: z.string().optional(),
        footerText: z.string().optional(),
        ticketWidth: z.number().optional(),
        showQueuePosition: z.boolean().optional(),
        showDateTime: z.boolean().optional(),
        showBankInfo: z.boolean().optional(),
        customMessage1: z.string().optional(),
        customMessage2: z.string().optional(),
        customMessage3: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await db.updateTicketDesign(input);
          await db.logSystemEvent("ticket_design_updated", undefined, undefined, input);
          return { success: true };
        } catch (error) {
          console.error("Failed to update ticket design:", error);
          throw error;
        }
      }),

    // Get label settings
    getLabelSettings: publicProcedure
      .input(z.object({ labelId: z.number().optional() }))
      .query(async ({ input }) => {
        try {
          const labelId = input.labelId || 1;
          const settings = await db.getLabelSettings(labelId);
          return settings || { success: false, message: "Label not found" };
        } catch (error) {
          console.error("Failed to get label settings:", error);
          throw error;
        }
      }),

    // Get all label settings
    getAllLabelSettings: publicProcedure.query(async () => {
      try {
        const settings = await db.getAllLabelSettings();
        return settings;
      } catch (error) {
        console.error("Failed to get all label settings:", error);
        throw error;
      }
    }),

    // Update label settings
    updateLabelSettings: publicProcedure
      .input(z.object({
        labelId: z.number().optional(),
        labelName: z.string().optional(),
        labelType: z.enum(["ticket", "sticker", "card"]).optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        headerText: z.string().optional(),
        headerFontSize: z.number().optional(),
        footerText: z.string().optional(),
        footerFontSize: z.number().optional(),
        queueNumberFontSize: z.number().optional(),
        bankNameFontSize: z.number().optional(),
        dateTimeFontSize: z.number().optional(),
        showQRCode: z.boolean().optional(),
        showBarcode: z.boolean().optional(),
        showDateTime: z.boolean().optional(),
        showBankInfo: z.boolean().optional(),
        showQueuePosition: z.boolean().optional(),
        showWaitingTime: z.boolean().optional(),
        backgroundColor: z.string().optional(),
        textColor: z.string().optional(),
        borderStyle: z.enum(["none", "solid", "dashed", "dotted"]).optional(),
        borderWidth: z.number().optional(),
        logoUrl: z.string().optional().nullable(),
        logoWidth: z.number().optional(),
        logoHeight: z.number().optional(),
        customMessage1: z.string().optional().nullable(),
        customMessage2: z.string().optional().nullable(),
        customMessage3: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const labelId = input.labelId || 1;
          console.log('[Router] updateLabelSettings called:', { labelId, inputKeys: Object.keys(input) });
          await db.updateLabelSettings(labelId, input);
          console.log('[Router] updateLabelSettings completed successfully');
          await db.logSystemEvent("label_settings_updated", undefined, undefined, { labelId, ...input });
          return { success: true, message: 'Etiket ayarlari basarili olarak kaydedildi' };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error("Failed to update label settings:", errorMsg);
          return { success: false, message: `Hata: ${errorMsg}` };
        }
      }),

    // Create new label settings
    createLabelSettings: publicProcedure
      .input(z.object({
        labelName: z.string(),
        labelType: z.enum(["ticket", "sticker", "card"]).optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        headerText: z.string().optional(),
        footerText: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const labelId = await db.createLabelSettings(input);
          await db.logSystemEvent("label_settings_created", undefined, undefined, { labelId, ...input });
          return { success: true, labelId };
        } catch (error) {
          console.error("Failed to create label settings:", error);
          throw error;
        }
      }),

    // Set default/active label
    setDefaultLabelSettings: publicProcedure
      .input(z.object({ labelId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await db.setDefaultLabelSettings(input.labelId);
          await db.logSystemEvent("label_set_default", undefined, undefined, { labelId: input.labelId });
          return { success: true, message: 'Varsayılan etiket güncellendi' };
        } catch (error) {
          console.error("Failed to set default label:", error);
          throw error;
        }
      }),

    // Delete label settings
    deleteLabelSettings: publicProcedure
      .input(z.object({ labelId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await db.deleteLabelSettings(input.labelId);
          await db.logSystemEvent("label_settings_deleted", undefined, undefined, { labelId: input.labelId });
          return { success: true };
        } catch (error) {
          console.error("Failed to delete label settings:", error);
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
        const metrics = await db.getBankPerformanceStats();
        return metrics;
      } catch (error) {
        console.error("Failed to get bank performance:", error);
        throw error;
      }
    }),

    getDailyStats: publicProcedure
      .input(z.object({ date: z.date() }))
      .query(async ({ input }) => {
        try {
          const stats = await db.getDailyStatsData(input.date);
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
          const stats = await db.getHourlyStatsData(input.date);
          return stats;
        } catch (error) {
          console.error("Failed to get hourly stats:", error);
          throw error;
        }
      }),

    getOperatorPerformance: publicProcedure
      .input(z.object({ startDate: z.date().optional(), endDate: z.date().optional() }))
      .query(async ({ input }) => {
        try {
          const stats = await db.getOperatorPerformanceStats(input.startDate, input.endDate);
          return stats;
        } catch (error) {
          console.error("Failed to get operator performance:", error);
          throw error;
        }
      }),

    exportOperatorPerformance: publicProcedure
      .input(z.object({ startDate: z.date().optional(), endDate: z.date().optional(), format: z.enum(["csv", "pdf"]) }))
      .query(async ({ input }) => {
        try {
          const data = await db.getOperatorPerformanceStats(input.startDate, input.endDate);
          const rows = data.flatMap((op: any) =>
            op.banks && op.banks.length > 0
              ? op.banks.map((b: any) => ({
                  "Kullanıcı": op.operatorName,
                  "Toplam Hizmet": op.totalServed,
                  "Ortalama Süre (sn)": op.avgServiceTimeMs > 0 ? Math.round(op.avgServiceTimeMs / 1000) : 0,
                  "Çalışılan Banko": `Banko ${b.bankNumber}`,
                  "O Bankodaki Hizmet": b.count,
                }))
              : [{
                  "Kullanıcı": op.operatorName,
                  "Toplam Hizmet": op.totalServed,
                  "Ortalama Süre (sn)": op.avgServiceTimeMs > 0 ? Math.round(op.avgServiceTimeMs / 1000) : 0,
                  "Çalışılan Banko": "-",
                  "O Bankodaki Hizmet": 0,
                }]
          );
          const columns = ["Kullanıcı", "Toplam Hizmet", "Ortalama Süre (sn)", "Çalışılan Banko", "O Bankodaki Hizmet"];
          const filename = generateFilename("kullanici- performansi", input.format);

          if (input.format === "csv") {
            const csv = generateCSV({ title: "Kullanıcı Performans Raporu", filename, columns, data: rows });
            return { content: csv, filename, type: "text/csv" };
          } else {
            const pdf = await generatePDF({ title: "Kullanıcı Performans Raporu", filename, columns, data: rows });
            return { content: pdf.toString("base64"), filename, type: "application/pdf" };
          }
        } catch (error) {
          console.error("Failed to export operator performance:", error);
          throw error;
        }
      }),
  }),

  weather: router({
    getCurrent: publicProcedure.query(async () => {
      try {
        const config = await db.getSystemConfig();
        const city = config?.weatherCity || "";
        if (!city) return null;
        const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=tr`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const current = data?.current_condition?.[0];
        if (!current) return null;
        return {
          temp: current.temp_C,
          desc: current.weatherDesc?.[0]?.value || "",
          code: current.weatherCode || "",
          icon: current.weatherIconUrl?.[0]?.value || "",
          humidity: current.humidity,
          windSpeed: current.windspeedKmph,
        };
      } catch {
        return null;
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
