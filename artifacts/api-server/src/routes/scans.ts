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

router.get("/scans/stats", async (_req, res): Promise<void> => {
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
});

router.get("/scans", async (req, res): Promise<void> => {
  const params = ListScansQueryParams.safeParse(req.query);
  const limit = params.success && params.data.limit ? params.data.limit : 50;

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
});

router.post("/scans", async (req, res): Promise<void> => {
  const parsed = CreateScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [scan] = await db.insert(scansTable).values(parsed.data).returning();
  res.status(201).json({
    ...scan,
    createdAt: scan.createdAt.toISOString(),
    exportedAt: scan.exportedAt ? scan.exportedAt.toISOString() : null,
  });
});

router.get("/scans/:id", async (req, res): Promise<void> => {
  const params = GetScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

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
});

router.delete("/scans/:id", async (req, res): Promise<void> => {
  const params = DeleteScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [scan] = await db.delete(scansTable).where(eq(scansTable.id, id)).returning();
  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
