export class ConnectorError extends Error {
  constructor(store, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "ConnectorError";
    this.store = store;
    this.status = options.status ?? 502;
    this.retryable = options.retryable ?? false;
  }
}
