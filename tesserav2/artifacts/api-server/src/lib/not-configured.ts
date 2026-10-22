export class NotConfiguredError extends Error {
  readonly code = "not-configured" as const;

  constructor(message = "not-configured") {
    super(message);
    this.name = "NotConfiguredError";
  }
}
