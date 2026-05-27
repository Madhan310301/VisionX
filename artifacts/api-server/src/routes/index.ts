import { Router, type IRouter } from "express";
import healthRouter from "./health";
import brailleRouter from "./braille";
import ttsRouter from "./tts";
import scansRouter from "./scans";

const router: IRouter = Router();

router.use(healthRouter);
router.use(brailleRouter);
router.use(ttsRouter);
router.use(scansRouter);

export default router;
