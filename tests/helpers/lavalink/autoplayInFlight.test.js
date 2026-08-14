const assert = require("node:assert/strict");
const test = require("node:test");

const { getAutoplayInFlight, runSharedAutoplayTask } = require("../../../helpers/lavalink/autoplay");

test("autoplay callers join one in-flight lookup and the entry is cleared afterwards", async () => {
  let resolveTask;
  let calls = 0;
  const taskFactory = () => {
    calls += 1;
    return new Promise((resolve) => {
      resolveTask = resolve;
    });
  };

  const first = runSharedAutoplayTask("autoplay-shared-test", taskFactory);
  const second = runSharedAutoplayTask("autoplay-shared-test", taskFactory);
  assert.equal(first, second);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(calls, 1);

  resolveTask(true);
  assert.equal(await first, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(getAutoplayInFlight("autoplay-shared-test"), null);
});

test("a failed prefetch is cleared so queue-end recovery can retry", async () => {
  await assert.rejects(
    runSharedAutoplayTask("autoplay-retry-test", async () => {
      throw new Error("provider timeout");
    }),
    /provider timeout/
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(getAutoplayInFlight("autoplay-retry-test"), null);

  assert.equal(await runSharedAutoplayTask("autoplay-retry-test", async () => true), true);
});
