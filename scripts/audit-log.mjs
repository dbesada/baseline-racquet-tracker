import { appendFile, rename, stat } from "node:fs/promises";

// Append-only audit log that cannot grow without limit.
//
// The eBay account-deletion callback is reachable without signing in, so every
// probe used to add a line forever. When the log reaches `maxBytes` it is
// moved to `<path>.1` (replacing the previous one) and a new log is started,
// so the two files together stay under about twice `maxBytes`. Entries given a
// `throttleKey` are written at most once per `throttleMs` for that key, which
// keeps repeated readiness probes from flooding the log.
//
// Writing never throws: a full disk or missing folder must not break the
// request being audited.
export function createAuditLog({ path, maxBytes = 1_000_000, throttleMs = 60_000, now = Date.now }) {
  const lastWritten = new Map();
  return async function audit(message, { throttleKey } = {}) {
    if (throttleKey) {
      const last = lastWritten.get(throttleKey);
      if (last !== undefined && now() - last < throttleMs) return false;
      lastWritten.set(throttleKey, now());
    }
    try {
      const size = await stat(path).then((info) => info.size, () => 0);
      if (size >= maxBytes) await rename(path, `${path}.1`);
      await appendFile(path, `${new Date(now()).toISOString()} ${message}\n`);
      return true;
    } catch {
      return false;
    }
  };
}
