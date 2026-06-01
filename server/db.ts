import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { InsertUser, users, systemConfig, banks, queueEntries, systemLogs, soundSettings, Bank, QueueEntry, SystemConfig, SoundSettings, InsertSoundSettings } from "../drizzle/schema";

let _db: SqlJsDatabase | null = null;
let _sqlJs: any = null;
const DB_PATH = "siramatik.db";

// Initialize sql.js and load or create database
export async function getDb(): Promise<SqlJsDatabase | null> {
  if (!_db) {
    try {
      if (!_sqlJs) {
        _sqlJs = await initSqlJs();
      }

      if (existsSync(DB_PATH)) {
        const buffer = readFileSync(DB_PATH);
        _db = new _sqlJs.Database(buffer);
        console.log("[Database] Loaded existing database");
      } else {
        _db = new _sqlJs.Database();
        console.log("[Database] Created new database");
        
        // Initialize schema
        await initializeSchema();
      }
    } catch (error) {
      console.error("[Database] Failed to initialize:", error);
      return null;
    }
  }
  return _db;
}

// Initialize database schema
async function initializeSchema(): Promise<void> {
  if (!_db) return;
  
  try {
    // Create tables
    const tables = [
      `CREATE TABLE IF NOT EXISTS banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        bank_number INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1 NOT NULL,
        is_occupied INTEGER DEFAULT 0 NOT NULL,
        current_queue_entry_id INTEGER,
        total_served INTEGER DEFAULT 0 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS queue_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        ticket_number INTEGER NOT NULL,
        phone_number TEXT,
        priority_type TEXT DEFAULT 'none' NOT NULL,
        is_priority INTEGER DEFAULT 0 NOT NULL,
        status TEXT DEFAULT 'waiting' NOT NULL,
        called_at INTEGER,
        started_at INTEGER,
        completed_at INTEGER,
        service_time_ms INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sound_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        sound_type TEXT DEFAULT 'chime' NOT NULL,
        sound_volume INTEGER DEFAULT 70 NOT NULL,
        is_enabled INTEGER DEFAULT 1 NOT NULL,
        animation_type TEXT DEFAULT 'pulse' NOT NULL,
        animation_speed TEXT DEFAULT 'normal' NOT NULL,
        custom_sound_url TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        total_banks INTEGER DEFAULT 5 NOT NULL,
        current_queue_number INTEGER DEFAULT 0 NOT NULL,
        is_system_active INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        event_type TEXT NOT NULL,
        bank_id INTEGER,
        queue_entry_id INTEGER,
        metadata TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        openId TEXT NOT NULL,
        name TEXT,
        email TEXT,
        loginMethod TEXT,
        role TEXT DEFAULT 'user' NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        lastSignedIn INTEGER NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS users_openId_unique ON users (openId)`,
      `CREATE TABLE IF NOT EXISTS printer_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        is_enabled INTEGER DEFAULT 1 NOT NULL,
        vendor_id INTEGER DEFAULT 1155 NOT NULL,
        product_id INTEGER DEFAULT 14147 NOT NULL,
        printer_type TEXT DEFAULT 'escpos' NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    ];

    for (const sql of tables) {
      try {
        const stmt = _db.prepare(sql);
        stmt.step();
        stmt.free();
      } catch (e) {
        // Table might already exist, continue
      }
    }
    
    saveDb();
    console.log("[Database] Schema initialized");
  } catch (error) {
    console.error("[Database] Failed to initialize schema:", error);
  }
}

// Save database to disk
export function saveDb() {
  if (!_db) return;
  try {
    const data = _db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  } catch (error) {
    console.error("[Database] Failed to save:", error);
  }
}

// Execute SQL query
function executeQuery(sql: string, params: any[] = []): any[] {
  const db = _db;
  if (!db) return [];
  
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (error) {
    console.error("[Database] Query error:", sql, error);
    return [];
  }
}

// Execute update/insert/delete
function executeUpdate(sql: string, params: any[] = []): number {
  const db = _db;
  if (!db) return 0;
  
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    saveDb();
    return db.getRowsModified();
  } catch (error) {
    console.error("[Database] Update error:", sql, error);
    return 0;
  }
}

// ============ Queue Functions ============

export async function incrementQueueNumber(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  try {
    const config = await getSystemConfig();
    const newNumber = (config?.currentQueueNumber || 0) + 1;
    
    executeUpdate(
      "UPDATE system_config SET current_queue_number = ? WHERE id = 1",
      [newNumber]
    );
    
    return newNumber;
  } catch (error) {
    console.error("[Database] Failed to increment queue number:", error);
    throw error;
  }
}

export async function createQueueEntry(ticketNumber: number, priorityType: string, phoneNumber?: string): Promise<QueueEntry> {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  try {
    const now = Date.now();
    executeUpdate(
      `INSERT INTO queue_entries (ticket_number, phone_number, priority_type, is_priority, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'waiting', ?, ?)`,
      [ticketNumber, phoneNumber || null, priorityType, priorityType !== 'none' ? 1 : 0, now, now]
    );

    const result = executeQuery(
      "SELECT * FROM queue_entries WHERE ticket_number = ? ORDER BY id DESC LIMIT 1",
      [ticketNumber]
    );
    
    // Update phone_number if provided
    if (phoneNumber && result && result.length > 0) {
      const entryId = result[0].id;
      executeUpdate(
        "UPDATE queue_entries SET phone_number = ? WHERE id = ?",
        [phoneNumber, entryId]
      );
    }

    return result[0] as QueueEntry;
  } catch (error) {
    console.error("[Database] Failed to create queue entry:", error);
    throw error;
  }
}

export async function getWaitingQueue(): Promise<QueueEntry[]> {
  try {
    return executeQuery(
      "SELECT * FROM queue_entries WHERE status = 'waiting' ORDER BY created_at ASC"
    ) as QueueEntry[];
  } catch (error) {
    console.error("[Database] Failed to get waiting queue:", error);
    return [];
  }
}

export async function getNextWaitingEntry(): Promise<QueueEntry | null> {
  try {
    const result = executeQuery(
      "SELECT * FROM queue_entries WHERE status = 'waiting' ORDER BY created_at ASC LIMIT 1"
    );
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get next waiting entry:", error);
    return null;
  }
}

export async function updateQueueEntryStatus(entryId: number, status: string): Promise<void> {
  try {
    const now = Date.now();
    executeUpdate(
      "UPDATE queue_entries SET status = ?, updated_at = ? WHERE id = ?",
      [status, now, entryId]
    );
  } catch (error) {
    console.error("[Database] Failed to update queue entry status:", error);
    throw error;
  }
}

export async function calculateEstimatedWaitTime(ticketNumber: number): Promise<number> {
  try {
    const waitingQueue = await getWaitingQueue();
    const position = waitingQueue.findIndex(e => e.ticketNumber === ticketNumber);
    
    if (position === -1) return 0;
    
    // Assume 5 minutes per customer
    return position * 5 * 60 * 1000;
  } catch (error) {
    console.error("[Database] Failed to calculate wait time:", error);
    return 0;
  }
}

export async function resetQueue(): Promise<void> {
  try {
    const now = Date.now();
    executeUpdate(
      "UPDATE queue_entries SET status = 'cancelled', updated_at = ? WHERE status = 'waiting'",
      [now]
    );
    
    executeUpdate("UPDATE banks SET is_occupied = 0, current_queue_entry_id = NULL");
  } catch (error) {
    console.error("[Database] Failed to reset queue:", error);
    throw error;
  }
}

export async function getAllQueueEntries(): Promise<QueueEntry[]> {
  try {
    return executeQuery("SELECT * FROM queue_entries ORDER BY created_at DESC") as QueueEntry[];
  } catch (error) {
    console.error("[Database] Failed to get all queue entries:", error);
    return [];
  }
}

// ============ Bank Functions ============

export async function getAllBanks(): Promise<Bank[]> {
  try {
    return executeQuery("SELECT * FROM banks ORDER BY bank_number ASC") as Bank[];
  } catch (error) {
    console.error("[Database] Failed to get all banks:", error);
    return [];
  }
}

export async function getBankById(bankId: number): Promise<Bank | null> {
  try {
    const result = executeQuery("SELECT * FROM banks WHERE id = ?", [bankId]);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get bank:", error);
    return null;
  }
}

export async function getAvailableBank(): Promise<Bank | null> {
  try {
    const result = executeQuery(
      "SELECT * FROM banks WHERE is_active = 1 AND is_occupied = 0 ORDER BY bank_number ASC LIMIT 1"
    );
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get available bank:", error);
    return null;
  }
}

export async function updateBankStatus(bankId: number, isActive: boolean, entryId: number | null): Promise<void> {
  try {
    const now = Date.now();
    executeUpdate(
      "UPDATE banks SET is_active = ?, current_queue_entry_id = ?, updated_at = ? WHERE id = ?",
      [isActive ? 1 : 0, entryId, now, bankId]
    );
  } catch (error) {
    console.error("[Database] Failed to update bank status:", error);
    throw error;
  }
}

// ============ System Config Functions ============

export async function getSystemConfig(): Promise<SystemConfig | null> {
  try {
    await getDb();
    const result = executeQuery("SELECT * FROM system_config WHERE id = 1");
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get system config:", error);
    return null;
  }
}

export async function updateSystemConfig(config: Partial<SystemConfig>): Promise<void> {
  try {
    const now = Date.now();
    const updates: string[] = [];
    const values: any[] = [];

    if (config.totalBanks !== undefined) {
      updates.push("total_banks = ?");
      values.push(config.totalBanks);
    }
    if (config.currentQueueNumber !== undefined) {
      updates.push("current_queue_number = ?");
      values.push(config.currentQueueNumber);
    }
    if (config.isSystemActive !== undefined) {
      updates.push("is_system_active = ?");
      values.push(config.isSystemActive ? 1 : 0);
    }

    updates.push("updated_at = ?");
    values.push(now);

    if (updates.length > 0) {
      executeUpdate(
        `UPDATE system_config SET ${updates.join(", ")} WHERE id = 1`,
        values
      );
    }
  } catch (error) {
    console.error("[Database] Failed to update system config:", error);
    throw error;
  }
}

export async function initializeSystem(bankCount: number): Promise<void> {
  try {
    // Ensure database is initialized
    await getDb();
    const now = Date.now();
    
    // Create or update system config
    const config = await getSystemConfig();
    if (!config) {
      executeUpdate(
        `INSERT INTO system_config (total_banks, current_queue_number, is_system_active, created_at, updated_at)
         VALUES (?, 0, 1, ?, ?)`,
        [bankCount, now, now]
      );
    } else {
      await updateSystemConfig({ totalBanks: bankCount, isSystemActive: true });
    }

    // Initialize banks
    await initializeBanks(bankCount);
  } catch (error) {
    console.error("[Database] Failed to initialize system:", error);
    throw error;
  }
}

export async function initializeBanks(count: number): Promise<void> {
  try {
    const existingBanks = await getAllBanks();
    const now = Date.now();

    if (existingBanks.length === 0) {
      for (let i = 1; i <= count; i++) {
        executeUpdate(
          `INSERT INTO banks (bank_number, is_active, is_occupied, current_queue_entry_id, total_served, created_at, updated_at)
           VALUES (?, 1, 0, NULL, 0, ?, ?)`,
          [i, now, now]
        );
      }
    }
  } catch (error) {
    console.error("[Database] Failed to initialize banks:", error);
    throw error;
  }
}

// ============ Sound Settings Functions ============

export async function getSoundSettings(): Promise<SoundSettings | null> {
  try {
    const result = executeQuery("SELECT * FROM sound_settings WHERE id = 1");
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get sound settings:", error);
    return null;
  }
}

export async function updateSoundSettings(settings: Partial<SoundSettings>): Promise<void> {
  try {
    const now = Date.now();
    const existing = await getSoundSettings();

    if (!existing) {
      executeUpdate(
        `INSERT INTO sound_settings (sound_type, sound_volume, is_enabled, animation_type, animation_speed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          settings.soundType || "chime",
          settings.soundVolume ?? 70,
          settings.isEnabled ?? true ? 1 : 0,
          settings.animationType || "pulse",
          settings.animationSpeed || "normal",
          now,
          now,
        ]
      );
    } else {
      const updates: string[] = [];
      const values: any[] = [];

      if (settings.soundType !== undefined) {
        updates.push("sound_type = ?");
        values.push(settings.soundType);
      }
      if (settings.soundVolume !== undefined) {
        updates.push("sound_volume = ?");
        values.push(settings.soundVolume);
      }
      if (settings.isEnabled !== undefined) {
        updates.push("is_enabled = ?");
        values.push(settings.isEnabled ? 1 : 0);
      }
      if (settings.animationType !== undefined) {
        updates.push("animation_type = ?");
        values.push(settings.animationType);
      }
      if (settings.animationSpeed !== undefined) {
        updates.push("animation_speed = ?");
        values.push(settings.animationSpeed);
      }

      updates.push("updated_at = ?");
      values.push(now);

      if (updates.length > 0) {
        executeUpdate(
          `UPDATE sound_settings SET ${updates.join(", ")} WHERE id = 1`,
          values
        );
      }
    }
  } catch (error) {
    console.error("[Database] Failed to update sound settings:", error);
    throw error;
  }
}

// ============ Logging Functions ============

export async function logSystemEvent(
  eventType: string,
  bankId?: number,
  queueEntryId?: number,
  metadata?: any
): Promise<void> {
  try {
    const now = Date.now();
    executeUpdate(
      `INSERT INTO system_logs (event_type, bank_id, queue_entry_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [eventType, bankId || null, queueEntryId || null, JSON.stringify(metadata || {}), now]
    );
  } catch (error) {
    console.error("[Database] Failed to log system event:", error);
  }
}

export async function getSystemLogs(limit: number = 100): Promise<any[]> {
  try {
    return executeQuery(
      "SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?",
      [limit]
    );
  } catch (error) {
    console.error("[Database] Failed to get system logs:", error);
    return [];
  }
}

// ============ User Functions ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  try {
    const now = Date.now();
    const existing = executeQuery("SELECT * FROM users WHERE openId = ?", [user.openId]);

    if (existing.length === 0) {
      executeUpdate(
        `INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.openId,
          user.name || null,
          user.email || null,
          user.loginMethod || null,
          user.role || "user",
          now,
          now,
          now,
        ]
      );
    } else {
      executeUpdate(
        `UPDATE users SET name = ?, email = ?, loginMethod = ?, updatedAt = ?, lastSignedIn = ? WHERE openId = ?`,
        [user.name || null, user.email || null, user.loginMethod || null, now, now, user.openId]
      );
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<any | null> {
  try {
    const result = executeQuery("SELECT * FROM users WHERE openId = ?", [openId]);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get user:", error);
    return null;
  }
}


// ============ Stats Functions ============

export async function getQueueStats(): Promise<{
  waitingCount: number;
  totalProcessed: number;
  averageServiceTime: number;
}> {
  try {
    const waiting = await getWaitingQueue();
    const completed = executeQuery(
      "SELECT * FROM queue_entries WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 100"
    );
    
    let averageServiceTime = 0;
    if (completed.length > 0) {
      const totalServiceTime = completed.reduce((sum: number, entry: any) => {
        return sum + (entry.service_time_ms || 0);
      }, 0);
      averageServiceTime = Math.round(totalServiceTime / completed.length);
    }

    return {
      waitingCount: waiting.length,
      totalProcessed: completed.length,
      averageServiceTime,
    };
  } catch (error) {
    console.error("[Database] Failed to get queue stats:", error);
    return {
      waitingCount: 0,
      totalProcessed: 0,
      averageServiceTime: 0,
    };
  }
}


// WhatsApp Notification Helper
export async function sendWhatsAppNotification(phoneNumber: string, message: string): Promise<boolean> {
  try {
    // WhatsApp API endpoint - Twilio veya benzeri hizmet kullanılabilir
    // Bu örnek için basit bir log yapıyoruz, gerçek implementasyonda API çağrısı yapılacak
    console.log(`[WhatsApp] Sending to ${phoneNumber}: ${message}`);
    
    // TODO: Gerçek WhatsApp API entegrasyonu
    // const response = await fetch('https://api.twilio.com/...', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${WHATSAPP_API_KEY}` },
    //   body: JSON.stringify({ phoneNumber, message })
    // });
    // return response.ok;
    
    return true;
  } catch (error) {
    console.error("[WhatsApp] Failed to send notification:", error);
    return false;
  }
}


// ============ System Stats Functions ============

export async function getSystemStats(startDate: Date, endDate: Date): Promise<any> {
  try {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    
    // Get all completed entries in date range
    const completed = executeQuery(
      `SELECT * FROM queue_entries 
       WHERE status = 'completed' 
       AND created_at >= ? 
       AND created_at <= ?
       ORDER BY created_at DESC`,
      [startTime, endTime]
    );
    
    // Get all banks
    const banks = executeQuery("SELECT * FROM banks");
    
    // Calculate metrics
    let totalServiceTime = 0;
    let totalWaitTime = 0;
    const bankMetrics: Record<number, any> = {};
    
    // Initialize bank metrics
    banks.forEach((bank: any) => {
      bankMetrics[bank.id] = {
        bankNumber: bank.bankNumber,
        totalServed: 0,
        totalServiceTime: 0,
        averageServiceTime: 0,
      };
    });
    
    // Process completed entries
    completed.forEach((entry: any) => {
      const serviceTime = entry.service_time_ms || 0;
      const waitTime = entry.wait_time_ms || 0;
      
      totalServiceTime += serviceTime;
      totalWaitTime += waitTime;
      
      if (entry.bank_id && bankMetrics[entry.bank_id]) {
        bankMetrics[entry.bank_id].totalServed += 1;
        bankMetrics[entry.bank_id].totalServiceTime += serviceTime;
      }
    });
    
    // Calculate averages
    Object.keys(bankMetrics).forEach((bankId: string) => {
      const metric = bankMetrics[bankId as any];
      if (metric.totalServed > 0) {
        metric.averageServiceTime = Math.round(metric.totalServiceTime / metric.totalServed);
      }
    });
    
    const averageServiceTime = completed.length > 0 ? Math.round(totalServiceTime / completed.length) : 0;
    const averageWaitTime = completed.length > 0 ? Math.round(totalWaitTime / completed.length) : 0;
    
    return {
      totalCompleted: completed.length,
      totalWaiting: (await getWaitingQueue()).length,
      averageServiceTime,
      averageWaitTime,
      bankMetrics: Object.values(bankMetrics),
      startDate,
      endDate,
    };
  } catch (error) {
    console.error("[Database] Failed to get system stats:", error);
    return {
      totalCompleted: 0,
      totalWaiting: 0,
      averageServiceTime: 0,
      averageWaitTime: 0,
      bankMetrics: [],
      startDate,
      endDate,
    };
  }
}


/**
 * Yazıcı ayarlarını al
 */
export async function getPrinterSettings(): Promise<any> {
  try {
    const result = executeQuery("SELECT * FROM printer_settings WHERE id = 1");
    if (result.length === 0) {
      return null;
    }
    
    const row = result[0];
    return {
      id: row.id,
      isEnabled: row.is_enabled === 1,
      vendorId: row.vendor_id,
      productId: row.product_id,
      printerType: row.printer_type,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    console.error("[Database] Failed to get printer settings:", error);
    return null;
  }
}

/**
 * Yazıcı ayarlarını güncelle
 */
export async function updatePrinterSettings(settings: {
  isEnabled?: boolean;
  vendorId?: number;
  productId?: number;
  printerType?: string;
}): Promise<void> {
  try {
    const db = getDb();
    const updates: string[] = [];
    const values: any[] = [];

    if (settings.isEnabled !== undefined) {
      updates.push("is_enabled = ?");
      values.push(settings.isEnabled ? 1 : 0);
    }
    if (settings.vendorId !== undefined) {
      updates.push("vendor_id = ?");
      values.push(settings.vendorId);
    }
    if (settings.productId !== undefined) {
      updates.push("product_id = ?");
      values.push(settings.productId);
    }
    if (settings.printerType !== undefined) {
      updates.push("printer_type = ?");
      values.push(settings.printerType);
    }

    updates.push("updated_at = ?");
    values.push(Date.now());
    values.push(1); // WHERE id = 1

    const query = `UPDATE printer_settings SET ${updates.join(", ")} WHERE id = ?`;
    
    executeUpdate(query, values);
    saveDb();
  } catch (error) {
    console.error("[Database] Failed to update printer settings:", error);
    throw error;
  }
}
