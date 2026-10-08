import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const pinoInstance = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});

class Logger {
  public log(message: string): void {
    pinoInstance.info({ source: "express" }, message);
  }

  public debug(category: string, message: string): void {
    pinoInstance.debug({ category }, message);
  }

  public info(category: string, message: string): void {
    pinoInstance.info({ category }, message);
  }

  public warn(category: string, message: string, data?: unknown): void {
    pinoInstance.warn({ category, data }, message);
  }

  public error(category: string, message: string, data?: unknown): void {
    pinoInstance.error({ category, data }, message);
  }

  public flush(): void {
    pinoInstance.flush();
  }
}

const logger = new Logger();
export { logger };
export default logger;
