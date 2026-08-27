const assert = require("node:assert/strict");
const test = require("node:test");
const { playerEmbed } = require("../../helpers/embeds");

test("player embed tolerates missing or invalid canonical URLs", () => {
  const embed = playerEmbed("No URL track", null, null, "Artist", "Listener", null, "3:00", "0:00", "NONE");
  assert.equal(embed.data.url, undefined);

  const valid = playerEmbed("Valid URL track", "https://example.com/track", null, "Artist", "Listener", null, "3:00", "0:00", "NONE");
  assert.equal(valid.data.url, "https://example.com/track");
});
