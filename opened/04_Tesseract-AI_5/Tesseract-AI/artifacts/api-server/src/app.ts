import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

interface AppError {
  status?: number;
  statusCode?: number;
  message?: string;
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: { id: unknown; method: string; url: string; startTime?: number }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: { statusCode: number }) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

type TimedRequest = Request & { _startAt: number };

app.use((req: Request, res: Response, next: NextFunction) => {
  (req as TimedRequest)._startAt = Date.now();
  res.on("finish", () => {
    const elapsed = Date.now() - (req as TimedRequest)._startAt;
    logger.info({ method: req.method, url: req.url?.split("?")[0], statusCode: res.statusCode, elapsedMs: elapsed }, "Request complete");
  });
  next();
});

app.use("/api", router);
app.use("/workspace-api/api", router);

app.use((err: AppError, req: Request, res: Response, _next: NextFunction) => {
  const elapsed = Date.now() - ((req as TimedRequest)._startAt ?? Date.now());
  const statusCode = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? "Internal Server Error";
  logger.error({ err, statusCode, elapsedMs: elapsed, method: req.method, url: req.url }, "Request error");
  res.status(statusCode).json({ error: message });
});

export default app;
