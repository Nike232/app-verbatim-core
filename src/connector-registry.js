export class ConnectorDefinitionError extends TypeError {
  constructor(message) {
    super(message);
    this.name = "ConnectorDefinitionError";
  }
}

export class ConnectorNotFoundError extends Error {
  constructor(source) {
    super(`No connector is registered for store: ${source?.store ?? "unknown"}`);
    this.name = "ConnectorNotFoundError";
    this.source = source;
  }
}

export class ConnectorRegistry {
  #connectors = new Map();

  constructor(connectors = []) {
    for (const connector of connectors) this.register(connector);
  }

  register(connector) {
    validateConnector(connector);
    if (this.#connectors.has(connector.id)) throw new ConnectorDefinitionError(`Connector id already registered: ${connector.id}`);
    this.#connectors.set(connector.id, Object.freeze({ ...connector }));
    return this;
  }

  unregister(id) {
    return this.#connectors.delete(id);
  }

  get(id) {
    return this.#connectors.get(id) ?? null;
  }

  resolve(source) {
    for (const connector of this.#connectors.values()) {
      if (connector.supports(source)) return connector;
    }
    throw new ConnectorNotFoundError(source);
  }

  list() {
    return [...this.#connectors.values()].map(({ id, name, version }) => ({ id, name, version }));
  }
}

export function defineConnector(connector) {
  validateConnector(connector);
  return Object.freeze({ ...connector });
}

function validateConnector(connector) {
  if (!connector || typeof connector !== "object") throw new ConnectorDefinitionError("A connector must be an object.");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(connector.id ?? "")) throw new ConnectorDefinitionError("Connector id must use lowercase letters, numbers, and hyphens.");
  if (typeof connector.name !== "string" || !connector.name.trim()) throw new ConnectorDefinitionError("Connector name is required.");
  if (typeof connector.supports !== "function") throw new ConnectorDefinitionError("Connector supports(source) must be a function.");
  if (typeof connector.fetch !== "function") throw new ConnectorDefinitionError("Connector fetch(source, options) must be a function.");
}
