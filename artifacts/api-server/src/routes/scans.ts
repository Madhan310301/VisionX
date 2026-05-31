import { Router, type IRouter } from "express";
import { desc, eq, avg, count } from "drizzle-orm";
import { db, scansTable } from "@workspace/db";
import {
  CreateScanBody,
  GetScanParams,
  DeleteScanParams,
  ListScansQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

/* ═══════════════════════════════════════════════════════════════
   Local In-Memory Telemetry Fallback
   Ensures the app runs beautifully even when Supabase is unreachable
   ═══════════════════════════════════════════════════════════════ */

interface MemoryScan {
  id: number;
  createdAt: Date;
  mode: "camera" | "upload" | "video";
  rawText: string;
  correctedText: string;
  confidence: number;
  lineCount: number | null;
  brailleSystem: string | null;
  exportedAt: Date | null;
}

const memoryScans: MemoryScan[] = [];

router.get("/scans/stats", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        totalScans: count(scansTable.id),
        avgConfidence: avg(scansTable.confidence),
      })
      .from(scansTable);

    const byModeRows = await db
      .select({ mode: scansTable.mode, cnt: count(scansTable.id) })
      .from(scansTable)
      .groupBy(scansTable.mode);

    const bySystemRows = await db
      .select({ system: scansTable.brailleSystem, cnt: count(scansTable.id) })
      .from(scansTable)
      .groupBy(scansTable.brailleSystem);

    const byMode = { camera: 0, upload: 0, video: 0 };
    for (const row of byModeRows) {
      if (row.mode === "camera") byMode.camera = Number(row.cnt);
      else if (row.mode === "upload") byMode.upload = Number(row.cnt);
      else if (row.mode === "video") byMode.video = Number(row.cnt);
    }

    const bySystem: Record<string, number> = {
      ueb_grade1: 0,
      ueb_grade2: 0,
      nemeth: 0,
      computer: 0,
      music: 0,
      unknown: 0,
    };
    for (const row of bySystemRows) {
      if (row.system) bySystem[row.system] = Number(row.cnt);
    }

    res.json({
      totalScans: Number(rows[0]?.totalScans ?? 0),
      avgConfidence: Number(rows[0]?.avgConfidence ?? 0),
      byMode,
      bySystem,
    });
  } catch (err) {
    console.warn("[Database Fallback] Supabase database is unreachable. Compiling stats in-memory instead.");
    
    const totalScans = memoryScans.length;
    const avgConfidence = totalScans > 0 
      ? memoryScans.reduce((sum, s) => sum + s.confidence, 0) / totalScans 
      : 0;

    const byMode = { camera: 0, upload: 0, video: 0 };
    const bySystem = {
      ueb_grade1: 0,
      ueb_grade2: 0,
      nemeth: 0,
      computer: 0,
      music: 0,
      unknown: 0,
    };

    for (const scan of memoryScans) {
      if (scan.mode in byMode) byMode[scan.mode]++;
      const sys = scan.brailleSystem || "unknown";
      if (sys in bySystem) bySystem[sys as keyof typeof bySystem]++;
    }

    res.json({
      totalScans,
      avgConfidence,
      byMode,
      bySystem,
    });
  }
});

router.get("/scans", async (req, res): Promise<void> => {
  const params = ListScansQueryParams.safeParse(req.query);
  const limit = params.success && params.data.limit ? params.data.limit : 50;

  try {
    const scans = await db
      .select()
      .from(scansTable)
      .orderBy(desc(scansTable.createdAt))
      .limit(limit);

    res.json(
      scans.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        exportedAt: s.exportedAt ? s.exportedAt.toISOString() : null,
      }))
    );
  } catch (err) {
    console.warn("[Database Fallback] Supabase database is unreachable. Retrieving history from memory.");
    const sorted = [...memoryScans]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    res.json(
      sorted.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        exportedAt: s.exportedAt ? s.exportedAt.toISOString() : null,
      }))
    );
  }
});

router.post("/scans", async (req, res): Promise<void> => {
  const parsed = CreateScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [scan] = await db.insert(scansTable).values(parsed.data).returning();
    res.status(201).json({
      ...scan,
      createdAt: scan.createdAt.toISOString(),
      exportedAt: scan.exportedAt ? scan.exportedAt.toISOString() : null,
    });
  } catch (err) {
    console.warn("[Database Fallback] Supabase database is unreachable. Saving new scan record in-memory.");
    const newId = memoryScans.length > 0 ? Math.max(...memoryScans.map((s) => s.id)) + 1 : 1;
    const newScan: MemoryScan = {
      id: newId,
      createdAt: new Date(),
      mode: parsed.data.mode as any,
      rawText: parsed.data.rawText,
      correctedText: parsed.data.correctedText,
      confidence: parsed.data.confidence,
      lineCount: parsed.data.lineCount ?? null,
      brailleSystem: parsed.data.brailleSystem ?? null,
      exportedAt: null,
    };
    memoryScans.push(newScan);

    res.status(201).json({
      ...newScan,
      createdAt: newScan.createdAt.toISOString(),
      exportedAt: null,
    });
  }
});

router.get("/scans/:id", async (req, res): Promise<void> => {
  const params = GetScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  try {
    const [scan] = await db.select().from(scansTable).where(eq(scansTable.id, id));
    if (!scan) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }

    res.json({
      ...scan,
      createdAt: scan.createdAt.toISOString(),
      exportedAt: scan.exportedAt ? scan.exportedAt.toISOString() : null,
    });
  } catch (err) {
    console.warn("[Database Fallback] Supabase database is unreachable. Retrieving scan record from memory.");
    const scan = memoryScans.find((s) => s.id === id);
    if (!scan) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }

    res.json({
      ...scan,
      createdAt: scan.createdAt.toISOString(),
      exportedAt: scan.exportedAt ? scan.exportedAt.toISOString() : null,
    });
  }
});

router.delete("/scans", async (req, res): Promise<void> => {
  try {
    await db.delete(scansTable);
    memoryScans.length = 0;
    res.sendStatus(204);
  } catch (err) {
    console.warn("[Database Fallback] Database unreachable. Wiping in-memory scan history.");
    memoryScans.length = 0;
    res.sendStatus(204);
  }
});

router.delete("/scans/:id", async (req, res): Promise<void> => {
  const params = DeleteScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  try {
    const [scan] = await db.delete(scansTable).where(eq(scansTable.id, id)).returning();
    if (!scan) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }

    res.sendStatus(204);
  } catch (err) {
    console.warn("[Database Fallback] Supabase database is unreachable. Deleting scan record from memory.");
    const index = memoryScans.findIndex((s) => s.id === id);
    if (index === -1) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }
    memoryScans.splice(index, 1);
    res.sendStatus(204);
  }
});

export default router;
