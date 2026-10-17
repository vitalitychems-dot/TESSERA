let _actualPort: number | null = null;

export function parseConfiguredPort(rawPort: string | undefined): number {
  if (rawPort === undefined || rawPort.trim() === "") {
    throw new Error("PORT environment variable is required but was not provided.");
  }
  const port = Number(rawPort.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid PORT value: ${JSON.stringify(rawPort)}. PORT must be an integer between 1 and 65535.`);
  }
  return port;
}

export function setActualPort(port: number): void {
  _actualPort = port;
}

export function getActualPort(): number | null {
  return _actualPort;
}
