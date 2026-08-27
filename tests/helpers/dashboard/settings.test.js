const assert = require("node:assert/strict");
const test = require("node:test");
const { readGuildSettings, applyGuildSettings } = require("../../../helpers/dashboard/settings");
const djStore = require("../../../helpers/dj/store");
const { resetGuildState, getGuildState } = require("../../../helpers/guildState");

const GUILD = "settings-test-guild";

function fakeClient() {
  return {
    guilds: {
      cache: new Map([[GUILD, {
        id: GUILD,
        channels: { cache: new Map([["c1", { id: "c1", name: "music", type: 0 }]]) },
        roles: { cache: new Map([["r1", { id: "r1", name: "DJ", managed: false }]]) },
      }]]),
    },
  };
}

test("settings read back the current store values and the picker options", () => {
  resetGuildState(GUILD);
  djStore.setGuildConfig(GUILD, { enabled: false, roleId: null, skipMode: "vote", voteThreshold: 0.5, strictMode: false });

  const settings = readGuildSettings(fakeClient(), GUILD);
  assert.equal(settings.source.defaultSource, "deezer");
  assert.equal(settings.player.autoplay, false);
  assert.equal(settings.dj.skipMode, "vote");
  assert.deepEqual(settings.options.channels, [{ id: "c1", name: "music" }]);
  assert.deepEqual(settings.options.roles, [{ id: "r1", name: "DJ" }]);
});

test("applying player settings writes through guildState", () => {
  resetGuildState(GUILD);
  applyGuildSettings(GUILD, { player: { playerChannel: "100000000000000001", autoplay: true, radio247: true } });
  const state = getGuildState(GUILD);
  assert.equal(state.playerChannel, "100000000000000001");
  assert.equal(state.autoplay, true);
  assert.equal(state.radio247, true);
});

test("a null player channel clears the setting", () => {
  resetGuildState(GUILD);
  applyGuildSettings(GUILD, { player: { playerChannel: "100000000000000001" } });
  applyGuildSettings(GUILD, { player: { playerChannel: null } });
  assert.equal(getGuildState(GUILD).playerChannel, null);
});

test("an unknown search source is rejected with 400", () => {
  resetGuildState(GUILD);
  assert.throws(
    () => applyGuildSettings(GUILD, { source: { defaultSource: "napster" } }),
    (error) => error.statusCode === 400
  );
});

test("every supported search source is accepted", () => {
  resetGuildState(GUILD);
  for (const source of ["deezer", "youtube", "spotify", "soundcloud"]) {
    applyGuildSettings(GUILD, { source: { defaultSource: source } });
    assert.equal(getGuildState(GUILD).defaultSource, source);
  }
});

test("an unknown skip mode is rejected with 400", () => {
  assert.throws(
    () => applyGuildSettings(GUILD, { dj: { skipMode: "coinflip" } }),
    (error) => error.statusCode === 400
  );
});

test("the vote threshold is rejected outside 0.1 to 1.0", () => {
  assert.throws(() => applyGuildSettings(GUILD, { dj: { voteThreshold: 0 } }), (error) => error.statusCode === 400);
  assert.throws(() => applyGuildSettings(GUILD, { dj: { voteThreshold: 1.5 } }), (error) => error.statusCode === 400);
  assert.throws(() => applyGuildSettings(GUILD, { dj: { voteThreshold: "half" } }), (error) => error.statusCode === 400);
});

test("DJ settings write through djStore", () => {
  applyGuildSettings(GUILD, {
    dj: { enabled: true, roleId: "200000000000000002", skipMode: "hybrid", voteThreshold: 0.75, strictMode: true },
  });
  const config = djStore.getGuildConfig(GUILD);
  assert.equal(config.enabled, true);
  assert.equal(config.roleId, "200000000000000002");
  assert.equal(config.skipMode, "hybrid");
  assert.equal(config.voteThreshold, 0.75);
  assert.equal(config.strictMode, true);
});

test("announcement settings write through guildState", () => {
  resetGuildState(GUILD);
  applyGuildSettings(GUILD, {
    announcements: { announcementChannel: "100000000000000001", announcementsEnabled: false },
  });
  const state = getGuildState(GUILD);
  assert.equal(state.announcementChannel, "100000000000000001");
  assert.equal(state.announcementsEnabled, false);
});

test("applying settings returns the full refreshed shape", () => {
  resetGuildState(GUILD);
  const result = applyGuildSettings(GUILD, { player: { autoplay: true } }, fakeClient());
  assert.equal(result.player.autoplay, true);
  assert.ok(result.options);
});

test("an unknown section is ignored rather than throwing", () => {
  resetGuildState(GUILD);
  assert.doesNotThrow(() => applyGuildSettings(GUILD, { nonsense: { x: 1 } }));
});
