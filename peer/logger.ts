type LogObj = Record<string, unknown>;
type LogHandler = (_obj: LogObj) => void;
type LogSink = {
  "DEBUG": LogHandler;
  "INFO": LogHandler;
  "WARN": LogHandler;
  "ERROR": LogHandler;
};

export const DEFAULT_LOG_SINK: LogSink = {
  DEBUG: console.debug,
  INFO: console.info,
  WARN: console.warn,
  ERROR: console.error,
};

// inspired by toml format, https://toml.io/en/
// the main difference is that the fields are appended on the same line
// to optimize readability in console.
export const PRETTY_LOG_SINK: LogSink = {
  DEBUG: (o) => console.debug(pretty(o)),
  INFO: (o) => console.info(pretty(o)),
  WARN: (o) => console.warn(pretty(o)),
  ERROR: (o) => console.error(pretty(o)),
};

export function flatten(
  obj: LogObj,
  pairs: Record<string, string[]>,
  parentKey = "root",
  visited = new Set<LogObj>(),
) {
  const sep = ".";
  if (visited.has(obj)) return; // Stop if already visited
  visited.add(obj);

  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      const newKey = parentKey + sep + key;
      flatten(obj[key] as LogObj, pairs, newKey, visited);
    } else {
      const p = pairs[parentKey] || [];
      p.push(`${key}=${obj[key]}`);
      pairs[parentKey] = p;
    }
  }
}

export function pretty(obj: LogObj) {
  const pairs: Record<string, string[]> = {};
  flatten(obj, pairs);

  const lines: string[] = [];
  for (const k in pairs) {
    lines.push(`[${k}] ${pairs[k].join(" ")}`);
  }
  return lines.join("\n");
}

export class Logger {
  private readonly obj: LogObj;
  private readonly sink: LogSink;
  constructor(public readonly name: string, obj?: LogObj, sink?: LogSink) {
    if (!obj) obj = {};
    if (!sink) sink = DEFAULT_LOG_SINK;
    this.sink = sink;
    this.obj = { ...obj, name };
  }

  private log(
    handler: LogHandler,
    message: string,
    obj?: LogObj,
  ): void {
    const o = obj || {};
    handler({
      ts: Date.now(),
      message,
      ...this.obj,
      ...o,
    });
  }

  debug(message: string, obj?: LogObj): void {
    this.log(this.sink.DEBUG, message, obj);
  }

  info(message: string, obj?: LogObj): void {
    this.log(this.sink.INFO, message, obj);
  }

  warn(message: string, obj?: LogObj): void {
    this.log(this.sink.WARN, message, obj);
  }

  error(message: string, obj?: LogObj): void {
    this.log(this.sink.ERROR, message, obj);
  }

  sub(name: string, obj?: LogObj): Logger {
    if (!obj) obj = {};
    return new Logger(
      this.name + "." + name,
      { ...this.obj, ...obj },
      this.sink,
    );
  }
}
