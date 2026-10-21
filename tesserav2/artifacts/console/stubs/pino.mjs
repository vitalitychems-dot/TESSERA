function logger() {}
logger.info = logger;
logger.error = logger;
logger.warn = logger;
logger.debug = logger;
logger.child = () => logger;

export default function pino() {
  return logger;
}
