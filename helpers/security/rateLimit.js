const buckets = new Map();

function consumeRateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const previous = buckets.get(key);
  const bucket = !previous || previous.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : previous;
  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > 10_000) {
    for (const [candidateKey, candidate] of buckets) {
      if (candidate.resetAt <= now) buckets.delete(candidateKey);
    }
  }

  return { allowed: bucket.count <= limit, retryAfterMs: Math.max(0, bucket.resetAt - now) };
}

module.exports = { consumeRateLimit };
