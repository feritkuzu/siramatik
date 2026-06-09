import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { InsertUser, users, systemConfig, banks, queueEntries, systemLogs, soundSettings, ticketDesign, Bank, QueueEntry, SystemConfig, SoundSettings, InsertSoundSettings, TicketDesign, InsertTicketDesign } from "../drizzle/schema";

let _db: SqlJsDatabase | null = null;
let _sqlJs: any = null;
let _dbInitPromise: Promise<void> | null = null;
const DB_PATH = join(import.meta.dirname, "..", "siramatik.db");

// Initialize sql.js and load or create database
export async function getDb(): Promise<SqlJsDatabase | null> {
  if (!_db && !_dbInitPromise) {
    _dbInitPromise = (async () => {
      try {
        if (!_sqlJs) {
          _sqlJs = await initSqlJs();
        }

        if (existsSync(DB_PATH)) {
          const buffer = readFileSync(DB_PATH);
          _db = new _sqlJs.Database(buffer);
          console.log("[Database] Loaded existing database");
          await runMigrations();
        } else {
          _db = new _sqlJs.Database();
          console.log("[Database] Created new database");
          await initializeSchema();
        }
      } catch (error) {
        console.error("[Database] Failed to initialize:", error);
      }
    })();
  }
  if (_dbInitPromise) await _dbInitPromise;
  if (!_db) console.error("[Database] CRITICAL: _db is null after initialization!");
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
        windows_printer_name TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS ticket_design (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        company_name TEXT DEFAULT 'SIRAMATIK' NOT NULL,
        company_subtitle TEXT DEFAULT 'Sıra Numarası Sistemi' NOT NULL,
        logo_url TEXT,
        header_text TEXT,
        footer_text TEXT,
        ticket_width INTEGER DEFAULT 58 NOT NULL,
        show_queue_position INTEGER DEFAULT 1 NOT NULL,
        show_datetime INTEGER DEFAULT 1 NOT NULL,
        show_bank_info INTEGER DEFAULT 1 NOT NULL,
        custom_message_1 TEXT,
        custom_message_2 TEXT,
        custom_message_3 TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS label_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        label_name TEXT DEFAULT 'Varsayılan Etiket' NOT NULL,
        label_type TEXT DEFAULT 'ticket' NOT NULL,
        width INTEGER DEFAULT 58 NOT NULL,
        height INTEGER DEFAULT 30 NOT NULL,
        header_text TEXT,
        header_font_size INTEGER DEFAULT 12 NOT NULL,
        footer_text TEXT,
        footer_font_size INTEGER DEFAULT 10 NOT NULL,
        queue_number_font_size INTEGER DEFAULT 24 NOT NULL,
        bank_name_font_size INTEGER DEFAULT 12 NOT NULL,
        datetime_font_size INTEGER DEFAULT 9 NOT NULL,
        show_qr_code INTEGER DEFAULT 0 NOT NULL,
        show_barcode INTEGER DEFAULT 0 NOT NULL,
        show_datetime INTEGER DEFAULT 1 NOT NULL,
        show_bank_info INTEGER DEFAULT 1 NOT NULL,
        show_queue_position INTEGER DEFAULT 1 NOT NULL,
        show_waiting_time INTEGER DEFAULT 0 NOT NULL,
        background_color TEXT DEFAULT 'white' NOT NULL,
        text_color TEXT DEFAULT 'black' NOT NULL,
        border_style TEXT DEFAULT 'solid' NOT NULL,
        border_width INTEGER DEFAULT 1 NOT NULL,
        logo_url TEXT,
        logo_width INTEGER DEFAULT 40 NOT NULL,
        logo_height INTEGER DEFAULT 20 NOT NULL,
        custom_message_1 TEXT,
        custom_message_2 TEXT,
        custom_message_3 TEXT,
        is_active INTEGER DEFAULT 1 NOT NULL,
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
    
    // Initialize default label settings if not exists
    try {
      const existingLabel = executeQuery("SELECT * FROM label_settings WHERE id = 1");
      if (existingLabel.length === 0) {
        const now = Date.now();
        executeUpdate(
          `INSERT INTO label_settings (id, label_name, label_type, width, height, header_text, header_font_size, footer_text, footer_font_size, queue_number_font_size, bank_name_font_size, datetime_font_size, show_qr_code, show_barcode, show_datetime, show_bank_info, show_queue_position, show_waiting_time, background_color, text_color, border_style, border_width, logo_width, logo_height, is_active, created_at, updated_at)
           VALUES (1, 'Varsayılan Etiket', 'ticket', 58, 30, 'Başlık', 12, 'Alt Metin', 10, 24, 12, 9, 0, 0, 1, 1, 1, 0, 'white', 'black', 'solid', 1, 40, 20, 1, ?, ?)`,
          [now, now]
        );
        console.log("[Database] Default label settings created");
      }
    } catch (e) {
      console.error("[Database] Failed to initialize default label settings:", e);
    }
    
    console.log("[Database] Schema initialized");
  } catch (error) {
    console.error("[Database] Failed to initialize schema:", error);
  }
}

async function runMigrations(): Promise<void> {
  if (!_db) return;
  try {
    // Create bank_operators table if not exists
    const stmt1 = _db.prepare(`CREATE TABLE IF NOT EXISTS bank_operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    stmt1.step();
    stmt1.free();

    // Add assigned_operator_id column to banks if not exists
    const colInfo = executeQuery("PRAGMA table_info(banks)");
    const hasCol = colInfo.some((c: any) => c.name === "assigned_operator_id");
    if (!hasCol) {
      try {
        const stmt2 = _db.prepare("ALTER TABLE banks ADD COLUMN assigned_operator_id INTEGER");
        stmt2.step();
        stmt2.free();
        console.log("[Database] Added assigned_operator_id column to banks");
      } catch (e) {
        console.error("[Database] Failed to add column:", e);
      }
    }

    // Add ip_address column to banks if not exists (banko bilgisayar IP'si)
    const colInfo3 = executeQuery("PRAGMA table_info(banks)");
    const hasIpCol = colInfo3.some((c: any) => c.name === "ip_address");
    if (!hasIpCol) {
      try {
        const stmt3 = _db.prepare("ALTER TABLE banks ADD COLUMN ip_address TEXT");
        stmt3.step();
        stmt3.free();
        console.log("[Database] Added ip_address column to banks");
      } catch (e) {
        console.error("[Database] Failed to add ip_address column:", e);
      }
    }

    // Add system settings columns to system_config if not exists
    const sysCols = executeQuery("PRAGMA table_info(system_config)");
    const sysColNames = sysCols.map((c: any) => c.name);
    if (!sysColNames.includes("system_name")) {
      try {
        const stmt = _db.prepare("ALTER TABLE system_config ADD COLUMN system_name TEXT DEFAULT 'SIRAMATİK'");
        stmt.step(); stmt.free();
        console.log("[Database] Added system_name column");
      } catch (e) { console.error("[Database] Failed to add system_name:", e); }
    }
    if (!sysColNames.includes("queue_prefix")) {
      try {
        const stmt = _db.prepare("ALTER TABLE system_config ADD COLUMN queue_prefix TEXT DEFAULT ''");
        stmt.step(); stmt.free();
        console.log("[Database] Added queue_prefix column");
      } catch (e) { console.error("[Database] Failed to add queue_prefix:", e); }
    }
    if (!sysColNames.includes("max_queue_number")) {
      try {
        const stmt = _db.prepare("ALTER TABLE system_config ADD COLUMN max_queue_number INTEGER DEFAULT 0");
        stmt.step(); stmt.free();
        console.log("[Database] Added max_queue_number column");
      } catch (e) { console.error("[Database] Failed to add max_queue_number:", e); }
    }
    if (!sysColNames.includes("business_hours_start")) {
      try {
        const stmt = _db.prepare("ALTER TABLE system_config ADD COLUMN business_hours_start TEXT DEFAULT '09:00'");
        stmt.step(); stmt.free();
        console.log("[Database] Added business_hours_start column");
      } catch (e) { console.error("[Database] Failed to add business_hours_start:", e); }
    }
    if (!sysColNames.includes("business_hours_end")) {
      try {
        const stmt = _db.prepare("ALTER TABLE system_config ADD COLUMN business_hours_end TEXT DEFAULT '18:00'");
        stmt.step(); stmt.free();
        console.log("[Database] Added business_hours_end column");
      } catch (e) { console.error("[Database] Failed to add business_hours_end:", e); }
    }
    if (!sysColNames.includes("kiosk_message")) {
      try {
        const stmt = _db.prepare("ALTER TABLE system_config ADD COLUMN kiosk_message TEXT DEFAULT ''");
        stmt.step(); stmt.free();
        console.log("[Database] Added kiosk_message column");
      } catch (e) { console.error("[Database] Failed to add kiosk_message:", e); }
    }

    if (!sysColNames.includes("kiosk_mode")) {
      try {
        const stmt = _db.prepare("ALTER TABLE system_config ADD COLUMN kiosk_mode TEXT DEFAULT 'touch'");
        stmt.step(); stmt.free();
        console.log("[Database] Added kiosk_mode column");
      } catch (e) { console.error("[Database] Failed to add kiosk_mode:", e); }
    }

    saveDb();
  } catch (error) {
    console.error("[Database] Migration error:", error);
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
    let config = await getSystemConfig();
    if (!config) {
      const now = Date.now();
      executeUpdate(
        `INSERT INTO system_config (total_banks, current_queue_number, is_system_active, created_at, updated_at) VALUES (?, 0, 1, ?, ?)`,
        [3, now, now]
      );
      config = await getSystemConfig();
    }
    
    const newNumber = (config?.currentQueueNumber || 0) + 1;
    executeUpdate("UPDATE system_config SET current_queue_number = ? WHERE id = 1", [newNumber]);
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
    const rows = executeQuery(
      "SELECT * FROM queue_entries WHERE status = 'waiting' ORDER BY created_at ASC"
    );
    return rows.map(mapQueueEntry) as QueueEntry[];
  } catch (error) {
    console.error("[Database] Failed to get waiting queue:", error);
    return [];
  }
}

function mapQueueEntry(row: any): any {
  if (!row) return row;
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    phoneNumber: row.phone_number,
    priorityType: row.priority_type,
    isPriority: row.is_priority === 1,
    status: row.status,
    calledAt: row.called_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    serviceTimeMs: row.service_time_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getNextWaitingEntry(): Promise<QueueEntry | null> {
  try {
    const result = executeQuery(
      "SELECT * FROM queue_entries WHERE status = 'waiting' ORDER BY created_at ASC LIMIT 1"
    );
    return result[0] ? (mapQueueEntry(result[0]) as QueueEntry) : null;
  } catch (error) {
    console.error("[Database] Failed to get next waiting entry:", error);
    return null;
  }
}

export async function getQueueEntryById(entryId: number): Promise<any | null> {
  try {
    const result = executeQuery("SELECT * FROM queue_entries WHERE id = ?", [entryId]);
    return result[0] ? mapQueueEntry(result[0]) : null;
  } catch (error) {
    console.error("[Database] Failed to get queue entry:", error);
    return null;
  }
}

export async function callNextCustomer(bankId: number): Promise<any | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const entry = await getNextWaitingEntry();
    if (!entry) return null;

    const now = Date.now();

    executeUpdate(
      "UPDATE queue_entries SET status = 'called', called_at = ?, updated_at = ? WHERE id = ?",
      [now, now, entry.id]
    );

    executeUpdate(
      "UPDATE banks SET is_occupied = 1, current_queue_entry_id = ?, updated_at = ? WHERE id = ?",
      [entry.id, now, bankId]
    );

    return {
      id: entry.id,
      ticketNumber: entry.ticketNumber,
      phoneNumber: entry.phoneNumber,
      priorityType: entry.priorityType,
      calledAt: now,
    };
  } catch (error) {
    console.error("[Database] Failed to call next customer:", error);
    return null;
  }
}

export async function completeService(bankId: number, entryId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const now = Date.now();
    const entry = await getQueueEntryById(entryId);

    executeUpdate(
      `UPDATE queue_entries SET status = 'completed', completed_at = ?, service_time_ms = ?, updated_at = ? WHERE id = ?`,
      [now, entry ? now - (entry.calledAt || now) : 0, now, entryId]
    );

    executeUpdate(
      `UPDATE banks SET is_occupied = 0, current_queue_entry_id = NULL, total_served = total_served + 1, updated_at = ? WHERE id = ?`,
      [now, bankId]
    );
  } catch (error) {
    console.error("[Database] Failed to complete service:", error);
    throw error;
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

function mapBankRow(row: any): any {
  if (!row) return row;
  return {
    id: row.id,
    bankNumber: row.bank_number,
    isActive: row.is_active === 1,
    isOccupied: row.is_occupied === 1,
    currentQueueEntryId: row.current_queue_entry_id,
    assignedOperatorId: row.assigned_operator_id,
    totalServed: row.total_served,
    ipAddress: row.ip_address || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBankById(bankId: number): Promise<Bank | null> {
  try {
    const result = executeQuery("SELECT * FROM banks WHERE id = ?", [bankId]);
    return result[0] ? (mapBankRow(result[0]) as Bank) : null;
  } catch (error) {
    console.error("[Database] Failed to get bank:", error);
    return null;
  }
}

export async function getAllBanks(): Promise<Bank[]> {
  try {
    const rows = executeQuery("SELECT * FROM banks ORDER BY bank_number ASC");
    return rows.map(mapBankRow) as Bank[];
  } catch (error) {
    console.error("[Database] Failed to get all banks:", error);
    return [];
  }
}

export async function getAvailableBank(): Promise<Bank | null> {
  try {
    const result = executeQuery(
      "SELECT * FROM banks WHERE is_active = 1 AND is_occupied = 0 ORDER BY bank_number ASC LIMIT 1"
    );
    return result[0] ? (mapBankRow(result[0]) as Bank) : null;
  } catch (error) {
    console.error("[Database] Failed to get available bank:", error);
    return null;
  }
}

export async function updateBankStatus(bankId: number, isActive: boolean, entryId: number | null): Promise<void> {
  try {
    const now = Date.now();
    if (!isActive) {
      // Banko kapatılınca kullanıcıyı da kaldır
      executeUpdate(
        "UPDATE banks SET is_active = 0, current_queue_entry_id = ?, assigned_operator_id = NULL, updated_at = ? WHERE id = ?",
        [entryId, now, bankId]
      );
    } else {
      executeUpdate(
        "UPDATE banks SET is_active = 1, current_queue_entry_id = ?, updated_at = ? WHERE id = ?",
        [entryId, now, bankId]
      );
    }
  } catch (error) {
    console.error("[Database] Failed to update bank status:", error);
    throw error;
  }
}

// ============ Bank Operator Functions ============

export async function getAllBankOperators(): Promise<any[]> {
  try {
    await getDb();
    return executeQuery("SELECT * FROM bank_operators ORDER BY name ASC");
  } catch (error) {
    console.error("[Database] Failed to get bank operators:", error);
    return [];
  }
}

export async function createBankOperator(name: string): Promise<any> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not initialized");
    const now = Date.now();
    const affected = executeUpdate(
      "INSERT INTO bank_operators (name, created_at, updated_at) VALUES (?, ?, ?)",
      [name.trim(), now, now]
    );
    console.log(`[Database] createBankOperator affected=${affected}`);
    const result = executeQuery("SELECT * FROM bank_operators ORDER BY id DESC LIMIT 1");
    console.log(`[Database] createBankOperator result=`, JSON.stringify(result[0]));
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create bank operator:", error);
    throw error;
  }
}

export async function updateBankOperator(id: number, name: string): Promise<any> {
  try {
    await getDb();
    executeUpdate("UPDATE bank_operators SET name = ?, updated_at = ? WHERE id = ?", [name.trim(), Date.now(), id]);
    const result = executeQuery("SELECT * FROM bank_operators WHERE id = ?", [id]);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to update bank operator:", error);
    throw error;
  }
}

export async function deleteBankOperator(id: number): Promise<void> {
  try {
    await getDb();
    executeUpdate("DELETE FROM bank_operators WHERE id = ?", [id]);
    executeUpdate("UPDATE banks SET assigned_operator_id = NULL WHERE assigned_operator_id = ?", [id]);
  } catch (error) {
    console.error("[Database] Failed to delete bank operator:", error);
    throw error;
  }
}

export async function assignOperatorToBank(bankId: number, operatorId: number | null): Promise<void> {
  try {
    await getDb();
    const now = Date.now();
    executeUpdate(
      "UPDATE banks SET assigned_operator_id = ?, updated_at = ? WHERE id = ?",
      [operatorId, now, bankId]
    );
  } catch (error) {
    console.error("[Database] Failed to assign operator to bank:", error);
    throw error;
  }
}

export async function updateBankIpAddress(bankId: number, ipAddress: string): Promise<void> {
  try {
    await getDb();
    executeUpdate(
      "UPDATE banks SET ip_address = ?, updated_at = ? WHERE id = ?",
      [ipAddress, Date.now(), bankId]
    );
  } catch (error) {
    console.error("[Database] Failed to update bank IP address:", error);
    throw error;
  }
}

// ============ System Config Functions ============

export async function getSystemConfig(): Promise<SystemConfig | null> {
  try {
    await getDb();
    const result = executeQuery("SELECT * FROM system_config WHERE id = 1");
    if (!result[0]) return null;
    return {
      id: result[0].id,
      totalBanks: result[0].total_banks,
      currentQueueNumber: result[0].current_queue_number,
      isSystemActive: result[0].is_system_active,
      systemName: result[0].system_name || "SIRAMATİK",
      queuePrefix: result[0].queue_prefix || "",
      maxQueueNumber: result[0].max_queue_number || 0,
      businessHoursStart: result[0].business_hours_start || "09:00",
      businessHoursEnd: result[0].business_hours_end || "18:00",
      kioskMessage: result[0].kiosk_message || "",
      kioskMode: result[0].kiosk_mode || "touch",
      createdAt: result[0].created_at,
      updatedAt: result[0].updated_at,
    } as SystemConfig;
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
    if (config.systemName !== undefined) {
      updates.push("system_name = ?");
      values.push(config.systemName);
    }
    if (config.queuePrefix !== undefined) {
      updates.push("queue_prefix = ?");
      values.push(config.queuePrefix);
    }
    if (config.maxQueueNumber !== undefined) {
      updates.push("max_queue_number = ?");
      values.push(config.maxQueueNumber);
    }
    if (config.businessHoursStart !== undefined) {
      updates.push("business_hours_start = ?");
      values.push(config.businessHoursStart);
    }
    if (config.businessHoursEnd !== undefined) {
      updates.push("business_hours_end = ?");
      values.push(config.businessHoursEnd);
    }
    if (config.kioskMessage !== undefined) {
      updates.push("kiosk_message = ?");
      values.push(config.kioskMessage);
    }
    if (config.kioskMode !== undefined) {
      updates.push("kiosk_mode = ?");
      values.push(config.kioskMode);
    }

    updates.push("updated_at = ?");
    values.push(now);

    if (updates.length > 0) {
      await getDb();
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

    // If no banks exist, create them
    if (existingBanks.length === 0) {
      for (let i = 1; i <= count; i++) {
        executeUpdate(
          `INSERT INTO banks (bank_number, is_active, is_occupied, current_queue_entry_id, total_served, created_at, updated_at)
           VALUES (?, 0, 0, NULL, 0, ?, ?)`,
          [i, now, now]
        );
      }
    } else if (existingBanks.length < count) {
      // Add new banks if count increased
      const startNumber = existingBanks.length + 1;
      for (let i = startNumber; i <= count; i++) {
        executeUpdate(
          `INSERT INTO banks (bank_number, is_active, is_occupied, current_queue_entry_id, total_served, created_at, updated_at)
           VALUES (?, 0, 0, NULL, 0, ?, ?)`,
          [i, now, now]
        );
      }
    } else if (existingBanks.length > count) {
      // Remove extra banks if count decreased
      const banksToDelete = existingBanks.slice(count);
      for (const bank of banksToDelete) {
        executeUpdate("DELETE FROM banks WHERE id = ?", [bank.id]);
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
      windowsPrinterName: row.windows_printer_name,
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
  windowsPrinterName?: string;
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
    if (settings.windowsPrinterName !== undefined) {
      updates.push("windows_printer_name = ?");
      values.push(settings.windowsPrinterName);
    }

    values.push(Date.now());
    values.push(1);
    const result = executeUpdate(`UPDATE printer_settings SET ${updates.join(", ")} WHERE id = ?`, values);
    if (result === 0) {
      const now = Date.now();
      executeUpdate(
        `INSERT INTO printer_settings (is_enabled, vendor_id, product_id, printer_type, windows_printer_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [1, 1155, 14147, 'escpos', settings.windowsPrinterName ?? null, now, now]
      );
    }
    saveDb();
  } catch (error) {
    console.error("[Database] Failed to update printer settings:", error);
    throw error;
  }
}


/**
 * Bilet tasarımı ayarlarını al
 */
export async function getTicketDesign(): Promise<TicketDesign | null> {
  try {
    const result = executeQuery("SELECT * FROM ticket_design WHERE id = 1");
    if (result.length === 0) {
      return null;
    }
    
    const row = result[0];
    return {
      id: row.id,
      companyName: row.company_name,
      companySubtitle: row.company_subtitle,
      logoUrl: row.logo_url,
      headerText: row.header_text,
      footerText: row.footer_text,
      ticketWidth: row.ticket_width,
      showQueuePosition: row.show_queue_position === 1,
      showDateTime: row.show_datetime === 1,
      showBankInfo: row.show_bank_info === 1,
      customMessage1: row.custom_message_1,
      customMessage2: row.custom_message_2,
      customMessage3: row.custom_message_3,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    console.error("[Database] Failed to get ticket design:", error);
    return null;
  }
}

/**
 * Bilet tasarımı ayarlarını güncelle
 */
export async function updateTicketDesign(settings: Partial<InsertTicketDesign>): Promise<void> {
  try {
    const updates: string[] = [];
    const values: any[] = [];

    if (settings.companyName !== undefined) {
      updates.push("company_name = ?");
      values.push(settings.companyName);
    }
    if (settings.companySubtitle !== undefined) {
      updates.push("company_subtitle = ?");
      values.push(settings.companySubtitle);
    }
    if (settings.logoUrl !== undefined) {
      updates.push("logo_url = ?");
      values.push(settings.logoUrl);
    }
    if (settings.headerText !== undefined) {
      updates.push("header_text = ?");
      values.push(settings.headerText);
    }
    if (settings.footerText !== undefined) {
      updates.push("footer_text = ?");
      values.push(settings.footerText);
    }
    if (settings.ticketWidth !== undefined) {
      updates.push("ticket_width = ?");
      values.push(settings.ticketWidth);
    }
    if (settings.showQueuePosition !== undefined) {
      updates.push("show_queue_position = ?");
      values.push(settings.showQueuePosition ? 1 : 0);
    }
    if (settings.showDateTime !== undefined) {
      updates.push("show_datetime = ?");
      values.push(settings.showDateTime ? 1 : 0);
    }
    if (settings.showBankInfo !== undefined) {
      updates.push("show_bank_info = ?");
      values.push(settings.showBankInfo ? 1 : 0);
    }
    if (settings.customMessage1 !== undefined) {
      updates.push("custom_message_1 = ?");
      values.push(settings.customMessage1);
    }
    if (settings.customMessage2 !== undefined) {
      updates.push("custom_message_2 = ?");
      values.push(settings.customMessage2);
    }
    if (settings.customMessage3 !== undefined) {
      updates.push("custom_message_3 = ?");
      values.push(settings.customMessage3);
    }

    updates.push("updated_at = ?");
    values.push(Date.now());

    const query = `UPDATE ticket_design SET ${updates.join(", ")} WHERE id = 1`;
    
    executeUpdate(query, values);
    saveDb();
  } catch (error) {
    console.error("[Database] Failed to update ticket design:", error);
    throw error;
  }
}

/**
 * Bilet tasarımı başlat
 */
export async function initializeTicketDesign(): Promise<void> {
  try {
    const existing = await getTicketDesign();
    if (!existing) {
      const now = Date.now();
      executeUpdate(
        `INSERT INTO ticket_design (company_name, company_subtitle, ticket_width, show_queue_position, show_datetime, show_bank_info, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["SIRAMATIK", "Sıra Numarası Sistemi", 58, 1, 1, 1, now, now]
      );
      saveDb();
    }
  } catch (error) {
    console.error("[Database] Failed to initialize ticket design:", error);
  }
}


// ============ Label Settings Functions ============

/**
 * Etiket ayarlarını al
 */
export async function getLabelSettings(labelId: number = 1): Promise<any> {
  try {
    const result = executeQuery("SELECT * FROM label_settings WHERE id = ?", [labelId]);
    if (result.length === 0) {
      // Return default label settings if not found
      return {
        id: labelId,
        labelName: "Varsayılan Etiket",
        labelType: "ticket",
        width: 58,
        height: 30,
        headerText: "Sıramatik",
        footerText: "Teşekkür ederiz",
        showQRCode: false,
        showBarcode: false,
        showDateTime: true,
        showBankInfo: true,
        backgroundColor: "#ffffff",
        textColor: "#000000",
        logoUrl: null,
        customMessage1: null,
        customMessage2: null,
        customMessage3: null,
      };
    }
    
    const row = result[0];
    return {
      id: row.id,
      labelName: row.label_name,
      labelType: row.label_type,
      width: row.width,
      height: row.height,
      headerText: row.header_text,
      headerFontSize: row.header_font_size,
      footerText: row.footer_text,
      footerFontSize: row.footer_font_size,
      queueNumberFontSize: row.queue_number_font_size,
      bankNameFontSize: row.bank_name_font_size,
      dateTimeFontSize: row.datetime_font_size,
      showQRCode: row.show_qr_code === 1,
      showBarcode: row.show_barcode === 1,
      showDateTime: row.show_datetime === 1,
      showBankInfo: row.show_bank_info === 1,
      showQueuePosition: row.show_queue_position === 1,
      showWaitingTime: row.show_waiting_time === 1,
      backgroundColor: normalizeColor(row.background_color),
      textColor: normalizeColor(row.text_color),
      borderStyle: row.border_style,
      borderWidth: row.border_width,
      logoUrl: row.logo_url,
      logoWidth: row.logo_width,
      logoHeight: row.logo_height,
      customMessage1: row.custom_message_1,
      customMessage2: row.custom_message_2,
      customMessage3: row.custom_message_3,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    console.error("[Database] Failed to get label settings:", error);
    // Return default label settings on error
    return {
      id: labelId,
      labelName: "Varsayılan Etiket",
      labelType: "thermal",
      width: 80,
      height: 120,
      headerText: "Sıramatik",
      footerText: "Teşekkür ederiz",
      showQRCode: false,
      showBarcode: false,
      showDateTime: true,
      showBankInfo: true,
      backgroundColor: "#ffffff",
      textColor: "#000000",
      logoUrl: null,
      customMessage1: null,
      customMessage2: null,
      customMessage3: null,
    };
  }
}

function normalizeColor(color: string | null | undefined): string {
  if (!color) return "#000000";
  const named: Record<string, string> = {
    white: "#ffffff",
    black: "#000000",
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    gray: "#808080",
    grey: "#808080",
    silver: "#c0c0c0",
    navy: "#000080",
    teal: "#008080",
    orange: "#ffa500",
    purple: "#800080",
    maroon: "#800000",
    lime: "#00ff00",
    aqua: "#00ffff",
    fuchsia: "#ff00ff",
  };
  const lower = color.toLowerCase();
  if (named[lower]) return named[lower];
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  return "#000000";
}

/**
 * Aktif (varsayılan) etiket ayarını al
 */
export async function getActiveLabelSettings(): Promise<any | null> {
  try {
    const result = executeQuery("SELECT * FROM label_settings WHERE is_active = 1 LIMIT 1");
    if (result.length === 0) {
      return await getLabelSettings(1);
    }
    const row = result[0];
    return {
      id: row.id,
      labelName: row.label_name,
      labelType: row.label_type,
      width: row.width,
      height: row.height,
      headerText: row.header_text,
      headerFontSize: row.header_font_size,
      footerText: row.footer_text,
      footerFontSize: row.footer_font_size,
      queueNumberFontSize: row.queue_number_font_size,
      bankNameFontSize: row.bank_name_font_size,
      dateTimeFontSize: row.datetime_font_size,
      showQRCode: row.show_qr_code === 1,
      showBarcode: row.show_barcode === 1,
      showDateTime: row.show_datetime === 1,
      showBankInfo: row.show_bank_info === 1,
      showQueuePosition: row.show_queue_position === 1,
      showWaitingTime: row.show_waiting_time === 1,
      backgroundColor: normalizeColor(row.background_color),
      textColor: normalizeColor(row.text_color),
      borderStyle: row.border_style,
      borderWidth: row.border_width,
      logoUrl: row.logo_url,
      logoWidth: row.logo_width,
      logoHeight: row.logo_height,
      customMessage1: row.custom_message_1,
      customMessage2: row.custom_message_2,
      customMessage3: row.custom_message_3,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    console.error("[Database] Failed to get active label settings:", error);
    return await getLabelSettings(1);
  }
}

/**
 * Tüm etiket ayarlarını al
 */
export async function getAllLabelSettings(): Promise<any[]> {
  try {
    const result = executeQuery("SELECT * FROM label_settings ORDER BY is_active DESC, created_at DESC");
    return result.map((row: any) => ({
      id: row.id,
      labelName: row.label_name,
      labelType: row.label_type,
      width: row.width,
      height: row.height,
      headerText: row.header_text,
      headerFontSize: row.header_font_size,
      footerText: row.footer_text,
      footerFontSize: row.footer_font_size,
      queueNumberFontSize: row.queue_number_font_size,
      bankNameFontSize: row.bank_name_font_size,
      dateTimeFontSize: row.datetime_font_size,
      showQRCode: row.show_qr_code === 1,
      showBarcode: row.show_barcode === 1,
      showDateTime: row.show_datetime === 1,
      showBankInfo: row.show_bank_info === 1,
      showQueuePosition: row.show_queue_position === 1,
      showWaitingTime: row.show_waiting_time === 1,
      backgroundColor: row.background_color,
      textColor: row.text_color,
      borderStyle: row.border_style,
      borderWidth: row.border_width,
      logoUrl: row.logo_url,
      logoWidth: row.logo_width,
      logoHeight: row.logo_height,
      customMessage1: row.custom_message_1,
      customMessage2: row.custom_message_2,
      customMessage3: row.custom_message_3,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  } catch (error) {
    console.error("[Database] Failed to get all label settings:", error);
    return [];
  }
}

/**
 * Etiket ayarlarını güncelle
 */
export async function updateLabelSettings(labelId: number, settings: any): Promise<void> {
  try {
    const updates: string[] = [];
    const values: any[] = [];

    const fields = [
      'labelName', 'labelType', 'width', 'height', 'headerText', 'headerFontSize',
      'footerText', 'footerFontSize', 'queueNumberFontSize', 'bankNameFontSize',
      'dateTimeFontSize', 'showQRCode', 'showBarcode', 'showDateTime', 'showBankInfo',
      'showQueuePosition', 'showWaitingTime', 'backgroundColor', 'textColor',
      'borderStyle', 'borderWidth', 'logoUrl', 'logoWidth', 'logoHeight',
      'customMessage1', 'customMessage2', 'customMessage3', 'isActive'
    ];

    const columnMap: Record<string, string> = {
      labelName: 'label_name',
      labelType: 'label_type',
      headerText: 'header_text',
      headerFontSize: 'header_font_size',
      footerText: 'footer_text',
      footerFontSize: 'footer_font_size',
      queueNumberFontSize: 'queue_number_font_size',
      bankNameFontSize: 'bank_name_font_size',
      dateTimeFontSize: 'datetime_font_size',
      showQRCode: 'show_qr_code',
      showBarcode: 'show_barcode',
      showDateTime: 'show_datetime',
      showBankInfo: 'show_bank_info',
      showQueuePosition: 'show_queue_position',
      showWaitingTime: 'show_waiting_time',
      backgroundColor: 'background_color',
      textColor: 'text_color',
      borderStyle: 'border_style',
      borderWidth: 'border_width',
      logoUrl: 'logo_url',
      logoWidth: 'logo_width',
      logoHeight: 'logo_height',
      customMessage1: 'custom_message_1',
      customMessage2: 'custom_message_2',
      customMessage3: 'custom_message_3',
      isActive: 'is_active',
    };

    for (const field of fields) {
      if (settings[field] !== undefined) {
        const column = columnMap[field] || field;
        const value = typeof settings[field] === 'boolean' ? (settings[field] ? 1 : 0) : settings[field];
        updates.push(`${column} = ?`);
        values.push(value);
      }
    }

    updates.push("updated_at = ?");
    values.push(Date.now());
    values.push(labelId);

    if (updates.length > 1) {
      const query = `UPDATE label_settings SET ${updates.join(", ")} WHERE id = ?`;
      console.log('[Database] Updating label settings:', { labelId, query, valuesCount: values.length });
      const result = executeUpdate(query, values);
      console.log('[Database] Label settings update result:', { rowsModified: result });
      saveDb();
      console.log('[Database] Label settings saved to disk');
    } else {
      console.warn('[Database] No fields to update for label settings');
    }
  } catch (error) {
    console.error("[Database] Failed to update label settings:", error);
    throw error;
  }
}

/**
 * Yeni etiket ayarı oluştur
 */
export async function createLabelSettings(settings: any): Promise<number> {
  try {
    const now = Date.now();
    const existingCount = executeQuery("SELECT COUNT(*) as cnt FROM label_settings");
    const hasExisting = existingCount.length > 0 && existingCount[0].cnt > 0;
    const query = `
      INSERT INTO label_settings (
        label_name, label_type, width, height, header_text, header_font_size,
        footer_text, footer_font_size, queue_number_font_size, bank_name_font_size,
        datetime_font_size, show_qr_code, show_barcode, show_datetime, show_bank_info,
        show_queue_position, show_waiting_time, background_color, text_color,
        border_style, border_width, logo_url, logo_width, logo_height,
        custom_message_1, custom_message_2, custom_message_3, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      settings.labelName || 'Yeni Etiket',
      settings.labelType || 'ticket',
      settings.width || 58,
      settings.height || 30,
      settings.headerText || null,
      settings.headerFontSize || 12,
      settings.footerText || null,
      settings.footerFontSize || 10,
      settings.queueNumberFontSize || 24,
      settings.bankNameFontSize || 12,
      settings.dateTimeFontSize || 9,
      settings.showQRCode ? 1 : 0,
      settings.showBarcode ? 1 : 0,
      settings.showDateTime !== false ? 1 : 0,
      settings.showBankInfo !== false ? 1 : 0,
      settings.showQueuePosition !== false ? 1 : 0,
      settings.showWaitingTime ? 1 : 0,
      settings.backgroundColor || 'white',
      settings.textColor || 'black',
      settings.borderStyle || 'solid',
      settings.borderWidth || 1,
      settings.logoUrl || null,
      settings.logoWidth || 40,
      settings.logoHeight || 20,
      settings.customMessage1 || null,
      settings.customMessage2 || null,
      settings.customMessage3 || null,
      (!hasExisting) ? 1 : 0,
      now,
      now,
    ];

    executeUpdate(query, values);
    saveDb();

    // Get the ID of the inserted row
    const result = executeQuery("SELECT last_insert_rowid() as id");
    return result[0]?.id || 0;
  } catch (error) {
    console.error("[Database] Failed to create label settings:", error);
    throw error;
  }
}

/**
 * Bir etiketi varsayılan yap, diğerlerini varsayılan olmaktan çıkar
 */
export async function setDefaultLabelSettings(labelId: number): Promise<void> {
  try {
    executeUpdate("UPDATE label_settings SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END, updated_at = ?", [labelId, Date.now()]);
    saveDb();
  } catch (error) {
    console.error("[Database] Failed to set default label settings:", error);
    throw error;
  }
}

/**
 * Etiket ayarını sil
 */
export async function deleteLabelSettings(labelId: number): Promise<void> {
  try {
    executeUpdate("DELETE FROM label_settings WHERE id = ?", [labelId]);
    saveDb();
  } catch (error) {
    console.error("[Database] Failed to delete label settings:", error);
    throw error;
  }
}

/**
 * Varsayılan etiket ayarlarını başlat
 */
export async function initializeLabelSettings(): Promise<void> {
  try {
    // Fix: ensure only one label is active (lowest ID wins)
    const activeLabels = executeQuery("SELECT id FROM label_settings WHERE is_active = 1 ORDER BY id");
    if (activeLabels.length > 1) {
      executeUpdate("UPDATE label_settings SET is_active = 0 WHERE id > ?", [activeLabels[0].id]);
      saveDb();
      console.log(`[Database] Fixed ${activeLabels.length - 1} extra active labels`);
    }

    const existing = await getLabelSettings(1);
    if (!existing) {
      const now = Date.now();
      executeUpdate(
        `INSERT INTO label_settings (
          id, label_name, label_type, width, height, header_font_size,
          footer_font_size, queue_number_font_size, bank_name_font_size,
          datetime_font_size, show_datetime, show_bank_info, show_queue_position,
          background_color, text_color, border_style, border_width, is_active,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          1,
          'Varsayılan Etiket',
          'ticket',
          58,
          30,
          12,
          10,
          24,
          12,
          9,
          1,
          1,
          1,
          'white',
          'black',
          'solid',
          1,
          1,
          now,
          now,
        ]
      );
      saveDb();
    }
  } catch (error) {
    console.error("[Database] Failed to initialize label settings:", error);
  }
}
