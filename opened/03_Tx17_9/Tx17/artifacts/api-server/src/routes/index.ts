import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tesseraRouter from "./tessera";
import chatRouter from "./chat/index";
import consciousnessRouter from "./consciousness";
import evolutionRouter from "./evolution";
import ethicsRouter from "./ethics";
import agiRouter from "./agi";
import financialAnalysisRouter from "./financial-analysis";
import sandboxRouter from "./sandbox";
import forumRouter from "./forum";
import twodaRouter from "./2da";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tesseraRouter);
router.use(chatRouter);
router.use(consciousnessRouter);
router.use(evolutionRouter);
router.use(ethicsRouter);
router.use(twodaRouter);
router.use(agiRouter);
router.use(financialAnalysisRouter);
router.use(sandboxRouter);
router.use(forumRouter);

export default router;
