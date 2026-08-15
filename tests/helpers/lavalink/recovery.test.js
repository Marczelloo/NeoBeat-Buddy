const assert = require("node:assert");
const { describe, it } = require("node:test");

const { RECOVERY_MAX_AGE_MS, isFreshSnapshot } = require("../../../helpers/lavalink/recovery");

describe("Player recovery snapshots", () => {
  it("accepts recent unexpected-disconnect state but rejects stale snapshots", () => {
    const now = Date.now();
    assert.strictEqual(isFreshSnapshot({ savedAt: now - 1_000 }, now), true);
    assert.strictEqual(isFreshSnapshot({ savedAt: now - RECOVERY_MAX_AGE_MS - 1 }, now), false);
    assert.strictEqual(isFreshSnapshot({ savedAt: now + 1_000 }, now), false);
  });
});
