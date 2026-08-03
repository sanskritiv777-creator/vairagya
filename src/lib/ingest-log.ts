/**
 * Ingestion logger.
 *
 * Every step of the Android transaction pipeline (SMS permission, inbox
 * scan, parse, dedupe, database write, notification capture) logs here.
 * Logs go to the console (visible via `adb logcat` / Chrome remote
 * inspect) and to a small in-memory ring buffer so the app can show a
 * debug trail without any extra plumbing.
 */
export type IngestLogEntry = {
  at: string;
  scope: "sms" | "notification" | "db" | "parse" | "perm" | "insights";
  message: string;
  data?: unknown;
};

const BUFFER_LIMIT = 200;
const buffer: IngestLogEntry[] = [];
const listeners = new Set<(entries: IngestLogEntry[]) => void>();

export function ilog(scope: IngestLogEntry["scope"], message: string, data?: unknown) {
  const entry: IngestLogEntry = { at: new Date().toISOString(), scope, message, data };
  buffer.unshift(entry);
  if (buffer.length > BUFFER_LIMIT) buffer.length = BUFFER_LIMIT;
  // eslint-disable-next-line no-console
  console.info(`[vairagya:${scope}] ${message}`, data ?? "");
  listeners.forEach((fn) => fn([...buffer]));
}

export function getIngestLog(): IngestLogEntry[] {
  return [...buffer];
}

export function subscribeIngestLog(fn: (entries: IngestLogEntry[]) => void): () => void {
  listeners.add(fn);
  fn([...buffer]);
  return () => listeners.delete(fn);
}
