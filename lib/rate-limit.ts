// Server-only in-memory fixed-window rate limiter.
type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const MAX_KEYS = 10_000;
const entries = new Map<string, RateLimitEntry>();

function evictExpired(now: number) {
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(key);
  }
}

function makeRoom(now: number) {
  evictExpired(now);
  while (entries.size >= MAX_KEYS) {
    const oldestKey = entries.keys().next().value;
    if (oldestKey === undefined) return;
    entries.delete(oldestKey);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSeconds: number } {
  if (process.env.RATE_LIMIT_DISABLED === "true") return { ok: true, retryAfterSeconds: 0 };

  let entry = entries.get(key);
  if (!entry || entry.resetAt <= now) {
    if (!entry) makeRoom(now);
    entry = { count: 0, resetAt: now + windowMs };
    entries.set(key, entry);
  }

  entry.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return { ok: entry.count <= limit, retryAfterSeconds };
}

export function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "local";
}
