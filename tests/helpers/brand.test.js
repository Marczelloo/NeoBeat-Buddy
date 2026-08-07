const assert = require("node:assert");
const { describe, it } = require("node:test");

const { BRAND, getPresenceLines, sanitizePresenceName } = require("../../helpers/brand");

describe("MewBit presence rotation", () => {
  it("contains a large varied pool of branded descriptions", () => {
    assert.ok(BRAND.presence.length >= 150);
    assert.strictEqual(new Set(BRAND.presence).size, BRAND.presence.length);
    assert.ok(BRAND.presence.every((line) => line.length > 0 && line.length <= 100));
  });

  it("adds safe personalized lines from cached server members", () => {
    const client = {
      guilds: {
        cache: new Map([
          [
            "guild-1",
            {
              members: {
                cache: new Map([
                  ["bot", { id: "bot", user: { id: "bot", bot: true }, displayName: "MewBit" }],
                  ["user", { id: "user", user: { id: "user", username: "Ala" }, displayName: "Ala @everyone" }],
                ]),
              },
            },
          ],
        ]),
      },
    };

    const lines = getPresenceLines(client);
    assert.ok(lines.length > BRAND.presence.length);
    assert.ok(lines.some((line) => line.includes("Ala")));
    assert.ok(!lines.some((line) => line.includes("@everyone")));
    assert.strictEqual(sanitizePresenceName("`@everyone` _Ala_"), "Ala");
  });
});
