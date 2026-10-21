import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tesseraRouter from "./tessera";
import chatRouter from "./chat/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tesseraRouter);
router.use(chatRouter);

export default router;
