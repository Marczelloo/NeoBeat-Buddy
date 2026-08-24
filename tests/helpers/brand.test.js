const assert = require("node:assert");
const { describe, it } = require("node:test");

const { BRAND, getPresenceLines, pickPresenceLine, sanitizePresenceName } = require("../../helpers/brand");

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
    assert.ok(!lines.some((line) => /\/play|\/autoplay|\/lyrics|\/queue|\/help/i.test(line)));
    assert.strictEqual(sanitizePresenceName("`@everyone` _Ala_"), "Ala");
  });

  it("randomly picks statuses without repeating the previous status", () => {
    const pool = Array.from({ length: 30 }, (_, index) => `status-${index + 1}`);
    const randomValues = [0.9, 0.1, 0.5, 0.25, 0.75];
    let randomIndex = 0;
    let previous = null;
    let recent = [];

    for (let turn = 0; turn < 40; turn += 1) {
      const line = pickPresenceLine(pool, recent, () => randomValues[randomIndex++ % randomValues.length]);

      assert.notEqual(line, previous);
      assert.equal(recent.includes(line), false);

      previous = line;
      recent.unshift(line);
      recent = recent.slice(0, 12);
    }
  });

  it("prevents two statuses from alternating indefinitely", () => {
    const pool = ["alpha", "beta", "gamma"];
    const randomValues = [0.9, 0.1, 0.5, 0.25, 0.75];
    let randomIndex = 0;
    let recent = [];

    for (let turn = 0; turn < 30; turn += 1) {
      const line = pickPresenceLine(pool, recent, () => randomValues[randomIndex++ % randomValues.length]);

      if (turn >= 2) {
        assert.notEqual(line, recent[0]);
        assert.notEqual(line, recent[1]);
      }

      recent.unshift(line);
      recent = recent.slice(0, 12);
    }
  });

  it("keeps a one-line pool usable without crashing", () => {
    assert.equal(pickPresenceLine(["only"], ["only"], () => 0.99), "only");
    assert.equal(pickPresenceLine([], ["anything"]), "");
  });
});
