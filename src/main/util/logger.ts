import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { desktopLogsDir } from './paths';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatLine(level: LogLevel, source: string, message: string, extra?: unknown): string {
  const ts = new Date().toISOString();
  let line = `[${ts}] [${level.toUpperCase()}] [${source}] ${message}`;
  if (extra !== undefined) {
    try {
      line += ' ' + (typeof extra === 'string' ? extra : JSON.stringify(extra));
    } catch {
      line += ' [unserialisable extra]';
    }
  }
  return line;
}

export interface Logger {
  debug(message: string, extra?: unknown): void;
  info(message: string, extra?: unknown): void;
  warn(message: string, extra?: unknown): void;
  error(message: string, extra?: unknown): void;
}

let minLevel: LogLevel = 'info';
let logFilePath: string | null = null;

function ensureLogFile(): string {
  if (logFilePath) return logFilePath;
  const dir = desktopLogsDir();
  mkdirSync(dir, { recursive: true });
  logFilePath = join(dir, `desktop-${todayStamp()}.log`);
  return logFilePath;
}

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function createLogger(source: string): Logger {
  function emit(level: LogLevel, message: string, extra?: unknown): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
    const line = formatLine(level, source, message, extra);
    // Mirror to stdout/stderr so dev runs surface logs in terminal.
    if (level === 'error' || level === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
    try {
      appendFileSync(ensureLogFile(), line + '\n', 'utf8');
    } catch {
      // Last-resort: swallow file errors so a broken disk doesn't crash main.
    }
  }
  return {
    debug: (m, e) => emit('debug', m, e),
    info: (m, e) => emit('info', m, e),
    warn: (m, e) => emit('warn', m, e),
    error: (m, e) => emit('error', m, e),
  };
}
