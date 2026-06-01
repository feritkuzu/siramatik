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
