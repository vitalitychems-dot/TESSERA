import pino from "pino";

export const LOGGER_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-mesh-lane-token']",
  "headers['x-mesh-lane-token']",
  "res.headers['set-cookie']",
];

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: LOGGER_REDACT_PATHS,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
