function withTimeout(task, timeoutMs, label = "operation") {
  const timeout = Number(timeoutMs);
  if (!Number.isFinite(timeout) || timeout <= 0) return Promise.resolve(task);

  let timer = null;
  const timeoutError = new Error(`${label} timed out after ${timeout}ms`);
  timeoutError.code = "RESOLVE_TIMEOUT";

  return Promise.race([
    Promise.resolve(task),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(timeoutError), timeout);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

module.exports = { withTimeout };
