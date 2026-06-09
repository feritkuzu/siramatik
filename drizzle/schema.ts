import { int, sqliteTable, text, integer, real, blob } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// System Configuration Table
export const systemConfig = sqliteTable("system_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  totalBanks: integer("total_banks").notNull().default(5),
  currentQueueNumber: integer("current_queue_number").notNull().default(0),
  isSystemActive: integer("is_system_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;

// Banks Table
export const banks = sqliteTable("banks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bankNumber: integer("bank_number").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isOccupied: integer("is_occupied", { mode: "boolean" }).notNull().default(false),
  currentQueueEntryId: integer("current_queue_entry_id"),
  totalServed: integer("total_served").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type Bank = typeof banks.$inferSelect;
export type InsertBank = typeof banks.$inferInsert;

// Queue Entries Table
export const queueEntries = sqliteTable("queue_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketNumber: integer("ticket_number").notNull(),
  phoneNumber: text("phone_number"),
  priorityType: text("priority_type", { enum: ["elderly", "disabled", "pregnant", "none"] }).notNull().default("none"),
  isPriority: integer("is_priority", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["waiting", "called", "serving", "completed", "cancelled"] }).notNull().default("waiting"),
  calledAt: integer("called_at", { mode: "timestamp" }),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  serviceTimeMs: integer("service_time_ms"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type QueueEntry = typeof queueEntries.$inferSelect;
export type InsertQueueEntry = typeof queueEntries.$inferInsert;

// System Logs Table
export const systemLogs = sqliteTable("system_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventType: text("event_type").notNull(),
  bankId: integer("bank_id"),
  queueEntryId: integer("queue_entry_id"),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = typeof systemLogs.$inferInsert;

// Sound Settings Table
export const soundSettings = sqliteTable("sound_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  soundType: text("sound_type", { enum: ["bell", "chime", "alarm", "beep", "siren", "notification", "custom"] }).notNull().default("chime"),
  soundVolume: integer("sound_volume").notNull().default(70),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  animationType: text("animation_type", { enum: ["pulse", "flash", "bounce", "shake", "rainbow", "glow"] }).notNull().default("pulse"),
  animationSpeed: text("animation_speed", { enum: ["slow", "normal", "fast"] }).notNull().default("normal"),
  customSoundUrl: text("custom_sound_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type SoundSettings = typeof soundSettings.$inferSelect;
export type InsertSoundSettings = typeof soundSettings.$inferInsert;

// Ticket Design Settings Table
export const ticketDesign = sqliteTable("ticket_design", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyName: text("company_name").notNull().default("SIRAMATIK"),
  companySubtitle: text("company_subtitle").notNull().default("Sıra Numarası Sistemi"),
  logoUrl: text("logo_url"),
  headerText: text("header_text"),
  footerText: text("footer_text"),
  ticketWidth: integer("ticket_width").notNull().default(58), // 58mm termal yazıcı
  showQueuePosition: integer("show_queue_position", { mode: "boolean" }).notNull().default(true),
  showDateTime: integer("show_datetime", { mode: "boolean" }).notNull().default(true),
  showBankInfo: integer("show_bank_info", { mode: "boolean" }).notNull().default(true),
  customMessage1: text("custom_message_1"),
  customMessage2: text("custom_message_2"),
  customMessage3: text("custom_message_3"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type TicketDesign = typeof ticketDesign.$inferSelect;
export type InsertTicketDesign = typeof ticketDesign.$inferInsert;

// Label Settings Table
export const labelSettings = sqliteTable("label_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  labelName: text("label_name").notNull().default("Varsayılan Etiket"),
  labelType: text("label_type", { enum: ["ticket", "sticker", "card"] }).notNull().default("ticket"),
  width: integer("width").notNull().default(58), // mm
  height: integer("height").notNull().default(30), // mm
  headerText: text("header_text"),
  headerFontSize: integer("header_font_size").notNull().default(12),
  footerText: text("footer_text"),
  footerFontSize: integer("footer_font_size").notNull().default(10),
  queueNumberFontSize: integer("queue_number_font_size").notNull().default(24),
  bankNameFontSize: integer("bank_name_font_size").notNull().default(12),
  dateTimeFontSize: integer("datetime_font_size").notNull().default(9),
  showQRCode: integer("show_qr_code", { mode: "boolean" }).notNull().default(false),
  showBarcode: integer("show_barcode", { mode: "boolean" }).notNull().default(false),
  showDateTime: integer("show_datetime", { mode: "boolean" }).notNull().default(true),
  showBankInfo: integer("show_bank_info", { mode: "boolean" }).notNull().default(true),
  showQueuePosition: integer("show_queue_position", { mode: "boolean" }).notNull().default(true),
  showWaitingTime: integer("show_waiting_time", { mode: "boolean" }).notNull().default(false),
  backgroundColor: text("background_color").notNull().default("white"),
  textColor: text("text_color").notNull().default("black"),
  borderStyle: text("border_style", { enum: ["none", "solid", "dashed", "dotted"] }).notNull().default("solid"),
  borderWidth: integer("border_width").notNull().default(1),
  logoUrl: text("logo_url"),
  logoWidth: integer("logo_width").notNull().default(40), // mm
  logoHeight: integer("logo_height").notNull().default(20), // mm
  customMessage1: text("custom_message_1"),
  customMessage2: text("custom_message_2"),
  customMessage3: text("custom_message_3"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type LabelSettings = typeof labelSettings.$inferSelect;
export type InsertLabelSettings = typeof labelSettings.$inferInsert;
