import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scansTable = pgTable("scans", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  mode: text("mode", { enum: ["camera", "upload", "video"] }).notNull(),
  rawText: text("raw_text").notNull(),
  correctedText: text("corrected_text").notNull(),
  confidence: real("confidence").notNull(),
  lineCount: integer("line_count"),
  exportedAt: timestamp("exported_at"),
});

export const insertScanSchema = createInsertSchema(scansTable).omit({ id: true, createdAt: true, exportedAt: true });
export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scansTable.$inferSelect;
