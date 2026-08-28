const assert = require("node:assert/strict");
const test = require("node:test");

const LOGS_PATH = require.resolve("../../../commands/utility/logs");
const TICKET_PATH = require.resolve("../../../commands/utility/ticket");

/* Both command modules persist immediately — `updateGuildLogsConfig` awaits a
   write and `setGuildConfig` queues one — so requiring the real ones here would
   write test guilds into helpers/data. They are stubbed instead, which also
   makes the log-access assertions deterministic. */
const logsState = { config: {} };
const ticketState = { config: {}, tickets: [] };

require.cache[LOGS_PATH] = {
  id: LOGS_PATH,
  filename: LOGS_PATH,
  loaded: true,
  exports: {
    getGuildLogsConfig: (guildId) => logsState.config[guildId] || null,
    updateGuildLogsConfig: async (guildId, config) => {
      logsState.config[guildId] = { ...logsState.config[guildId], ...config };
    },
  },
};

require.cache[TICKET_PATH] = {
  id: TICKET_PATH,
  filename: TICKET_PATH,
  loaded: true,
  exports: {
    getGuildConfig: (guildId) => ticketState.config[guildId] || null,
    setGuildConfig: (guildId, config) => {
      ticketState.config[guildId] = config;
    },
    getGuildTickets: (guildId, status = null) =>
      ticketState.tickets.filter((ticket) => ticket.guildId === guildId && (!status || ticket.status === status)),
  },
};

const { readGuildSettings, applyGuildSettings, EQ_BAND_COUNT } = require("../../../helpers/dashboard/settings");
const djStore = require("../../../helpers/dj/store");
const { resetGuildState, getGuildState } = require("../../../helpers/guildState");
const { getEqualizerState, clearEqualizerState } = require("../../../helpers/lavalink/equalizerStore");

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

/* A client whose category and log channels record every permission edit, so a
   test can assert the overwrite actually reached Discord rather than only the
   stored list. `failFor` makes one role's edit throw. */
function fakeLoggingClient({ failFor = null } = {}) {
  const edits = [];
  const makeChannel = (id) => ({
    id,
    permissionOverwrites: {
      edit: async (roleId, update) => {
        if (roleId === failFor) throw new Error("Missing Permissions");
        edits.push({ channelId: id, roleId, view: update.ViewChannel });
      },
    },
  });

  const channels = new Map([
    ["cat", makeChannel("cat")],
    ["ch-message", makeChannel("ch-message")],
    ["ch-voice", makeChannel("ch-voice")],
    ["ch-server", makeChannel("ch-server")],
    ["ch-bot", makeChannel("ch-bot")],
  ]);

  return {
    edits,
    client: {
      guilds: {
        cache: new Map([[GUILD, {
          id: GUILD,
          channels: { cache: channels, fetch: async (id) => channels.get(id) || null },
          roles: { cache: new Map() },
        }]]),
      },
    },
  };
}

function seedLogs(overrides = {}) {
  logsState.config[GUILD] = {
    enabled: true,
    categoryId: "cat",
    channels: { message: "ch-message", voice: "ch-voice", server: "ch-server", bot: "ch-bot" },
    accessRoles: [],
    categories: { message: true, voice: true, server: true, bot: true },
    ...overrides,
  };
  return logsState.config[GUILD];
}

test.beforeEach(() => {
  logsState.config = {};
  ticketState.config = {};
  ticketState.tickets = [];
  clearEqualizerState(GUILD);
  resetGuildState(GUILD);
});

/* ------------------------------------------------------------- existing --- */

test("settings read back the current store values and the picker options", () => {
  djStore.setGuildConfig(GUILD, { enabled: false, roleId: null, skipMode: "vote", voteThreshold: 0.5, strictMode: false });

  const settings = readGuildSettings(fakeClient(), GUILD);
  assert.equal(settings.source.defaultSource, "deezer");
  assert.equal(settings.player.autoplay, false);
  assert.equal(settings.dj.skipMode, "vote");
  assert.deepEqual(settings.options.channels, [{ id: "c1", name: "music" }]);
  assert.deepEqual(settings.options.roles, [{ id: "r1", name: "DJ" }]);
});

test("applying player settings writes through guildState", async () => {
  await applyGuildSettings(GUILD, { player: { playerChannel: "100000000000000001", autoplay: true, radio247: true } });
  const state = getGuildState(GUILD);
  assert.equal(state.playerChannel, "100000000000000001");
  assert.equal(state.autoplay, true);
  assert.equal(state.radio247, true);
});

test("a null player channel clears the setting", async () => {
  await applyGuildSettings(GUILD, { player: { playerChannel: "100000000000000001" } });
  await applyGuildSettings(GUILD, { player: { playerChannel: null } });
  assert.equal(getGuildState(GUILD).playerChannel, null);
});

test("an unknown search source is rejected with 400", async () => {
  await assert.rejects(
    () => applyGuildSettings(GUILD, { source: { defaultSource: "napster" } }),
    (error) => error.statusCode === 400
  );
});

test("every supported search source is accepted", async () => {
  for (const source of ["deezer", "youtube", "spotify", "soundcloud"]) {
    await applyGuildSettings(GUILD, { source: { defaultSource: source } });
    assert.equal(getGuildState(GUILD).defaultSource, source);
  }
});

test("an unknown skip mode is rejected with 400", async () => {
  await assert.rejects(
    () => applyGuildSettings(GUILD, { dj: { skipMode: "coinflip" } }),
    (error) => error.statusCode === 400
  );
});

test("the vote threshold is rejected outside 0.1 to 1.0", async () => {
  for (const value of [0, 1.5, "half"]) {
    await assert.rejects(
      () => applyGuildSettings(GUILD, { dj: { voteThreshold: value } }),
      (error) => error.statusCode === 400
    );
  }
});

test("DJ settings write through djStore", async () => {
  await applyGuildSettings(GUILD, {
    dj: { enabled: true, roleId: "200000000000000002", skipMode: "hybrid", voteThreshold: 0.75, strictMode: true },
  });
  const config = djStore.getGuildConfig(GUILD);
  assert.equal(config.enabled, true);
  assert.equal(config.roleId, "200000000000000002");
  assert.equal(config.skipMode, "hybrid");
  assert.equal(config.voteThreshold, 0.75);
  assert.equal(config.strictMode, true);
});

test("announcement settings write through guildState", async () => {
  await applyGuildSettings(GUILD, {
    announcements: { announcementChannel: "100000000000000001", announcementsEnabled: false },
  });
  const state = getGuildState(GUILD);
  assert.equal(state.announcementChannel, "100000000000000001");
  assert.equal(state.announcementsEnabled, false);
});

test("applying settings returns the full refreshed shape and a warnings list", async () => {
  const result = await applyGuildSettings(GUILD, { player: { autoplay: true } }, fakeClient());
  assert.equal(result.settings.player.autoplay, true);
  assert.ok(result.settings.options);
  assert.deepEqual(result.warnings, []);
});

test("an unknown section is ignored rather than throwing", async () => {
  await assert.doesNotReject(() => applyGuildSettings(GUILD, { nonsense: { x: 1 } }));
});

/* ----------------------------------------------------------------- logs --- */

test("logs read as unconfigured until /logs setup has created the channels", () => {
  const settings = readGuildSettings(fakeClient(), GUILD);
  assert.equal(settings.logs.configured, false);
  assert.equal(settings.logs.enabled, false);
  assert.deepEqual(settings.logs.accessRoles, []);
  assert.deepEqual(Object.keys(settings.logs.categories).sort(), ["bot", "message", "server", "voice"]);
});

test("a logs patch is refused while logging has never been set up", async () => {
  await assert.rejects(
    () => applyGuildSettings(GUILD, { logs: { enabled: true } }, fakeClient()),
    (error) => error.statusCode === 400 && /logs setup/.test(error.message)
  );
});

test("log categories and channels write through the command's own store", async () => {
  seedLogs();
  const { settings } = await applyGuildSettings(
    GUILD,
    { logs: { categories: { voice: false }, channels: { message: "300000000000000003" } } },
    fakeClient()
  );

  assert.equal(settings.logs.categories.voice, false);
  assert.equal(settings.logs.categories.message, true);
  assert.equal(settings.logs.channels.message, "300000000000000003");
  assert.equal(logsState.config[GUILD].channels.message, "300000000000000003");
});

test("turning every category off also turns logging off, matching /logs disable", async () => {
  seedLogs();
  const { settings } = await applyGuildSettings(
    GUILD,
    { logs: { categories: { message: false, voice: false, server: false, bot: false } } },
    fakeClient()
  );

  assert.equal(settings.logs.enabled, false);
  assert.equal(logsState.config[GUILD].enabled, false);
});

test("clearing a log channel is refused rather than silently disabling that category", async () => {
  seedLogs();
  await assert.rejects(
    () => applyGuildSettings(GUILD, { logs: { channels: { message: null } } }, fakeClient()),
    (error) => error.statusCode === 400
  );
});

test("granting log access edits the category and every log channel", async () => {
  seedLogs();
  const { edits, client } = fakeLoggingClient();

  const { settings } = await applyGuildSettings(GUILD, { logs: { accessRoles: ["400000000000000004"] } }, client);

  assert.deepEqual(settings.logs.accessRoles, ["400000000000000004"]);
  // The category plus four channels.
  assert.equal(edits.length, 5);
  assert.ok(edits.every((edit) => edit.roleId === "400000000000000004" && edit.view === true));
});

test("revoking log access clears the stored role and flips the overwrite", async () => {
  seedLogs({ accessRoles: ["400000000000000004"] });
  const { edits, client } = fakeLoggingClient();

  const { settings } = await applyGuildSettings(GUILD, { logs: { accessRoles: [] } }, client);

  assert.deepEqual(settings.logs.accessRoles, []);
  assert.ok(edits.every((edit) => edit.view === false));
});

test("a role Discord refuses is warned about and never recorded as having access", async () => {
  // The stored list has to stay truthful: claiming access that Discord did not
  // grant is worse than reporting the failure.
  seedLogs();
  const { client } = fakeLoggingClient({ failFor: "400000000000000004" });

  const { settings, warnings } = await applyGuildSettings(
    GUILD,
    { logs: { accessRoles: ["400000000000000004"] } },
    client
  );

  assert.deepEqual(settings.logs.accessRoles, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Could not grant log access/);
});

test("an unchanged access list touches no Discord permissions at all", async () => {
  seedLogs({ accessRoles: ["400000000000000004"] });
  const { edits, client } = fakeLoggingClient();

  await applyGuildSettings(GUILD, { logs: { accessRoles: ["400000000000000004"] } }, client);

  assert.equal(edits.length, 0);
});

/* -------------------------------------------------------------- tickets --- */

test("ticket settings write through the command's store and report the open count", async () => {
  ticketState.tickets = [
    { guildId: GUILD, status: "open" },
    { guildId: GUILD, status: "closed" },
    { guildId: "another", status: "open" },
  ];

  const { settings } = await applyGuildSettings(
    GUILD,
    { tickets: { channelId: "100000000000000001", roleId: "200000000000000002", enabled: true } },
    fakeClient()
  );

  assert.equal(settings.tickets.enabled, true);
  assert.equal(settings.tickets.channelId, "100000000000000001");
  assert.equal(settings.tickets.roleId, "200000000000000002");
  assert.equal(settings.tickets.openCount, 1);
  assert.equal(settings.tickets.totalCount, 2);
  assert.deepEqual(ticketState.config[GUILD], {
    channelId: "100000000000000001",
    roleId: "200000000000000002",
    enabled: true,
  });
});

test("the ticket system cannot be turned on without somewhere to deliver tickets", async () => {
  await assert.rejects(
    () => applyGuildSettings(GUILD, { tickets: { enabled: true } }, fakeClient()),
    (error) => error.statusCode === 400 && /channel/.test(error.message)
  );
});

test("clearing the ticket channel while the system is on is refused", async () => {
  ticketState.config[GUILD] = { channelId: "100000000000000001", roleId: null, enabled: true };
  await assert.rejects(
    () => applyGuildSettings(GUILD, { tickets: { channelId: null } }, fakeClient()),
    (error) => error.statusCode === 400
  );
});

test("the ticket ping role can be cleared on its own", async () => {
  ticketState.config[GUILD] = { channelId: "100000000000000001", roleId: "200000000000000002", enabled: true };
  const { settings } = await applyGuildSettings(GUILD, { tickets: { roleId: null } }, fakeClient());
  assert.equal(settings.tickets.roleId, null);
  assert.equal(settings.tickets.enabled, true);
});

/* ------------------------------------------------------------ equalizer --- */

test("the equalizer reads back a flat fifteen-band default", () => {
  const settings = readGuildSettings(fakeClient(), GUILD);
  assert.equal(settings.equalizer.preset, "flat");
  assert.equal(settings.equalizer.bands.length, EQ_BAND_COUNT);
  assert.ok(settings.equalizer.bands.every((gain) => gain === 0));
  assert.ok(settings.equalizer.presets.includes("bassboost"));
});

test("an equalizer preset persists as stored state so the next session restores it", async () => {
  const { settings } = await applyGuildSettings(GUILD, { equalizer: { preset: "bassboost" } }, fakeClient());

  assert.equal(settings.equalizer.preset, "bassboost");
  assert.ok(settings.equalizer.bands.some((gain) => gain > 0));
  // playback.js reads this on player create; a dashboard change is worthless
  // if it only ever touched a live player.
  assert.equal(getEqualizerState(GUILD).preset, "bassboost");
});

test("raw bands are clamped to the safe gain range rather than rejected", async () => {
  const bands = new Array(EQ_BAND_COUNT).fill(0);
  bands[0] = 5;
  bands[1] = -5;

  const { settings } = await applyGuildSettings(GUILD, { equalizer: { bands } }, fakeClient());

  assert.equal(settings.equalizer.preset, "custom");
  assert.equal(settings.equalizer.bands[0], settings.equalizer.maxGain);
  assert.equal(settings.equalizer.bands[1], settings.equalizer.minGain);
});

test("an unknown preset and a malformed band list are both rejected with 400", async () => {
  await assert.rejects(
    () => applyGuildSettings(GUILD, { equalizer: { preset: "spaceship" } }, fakeClient()),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    () => applyGuildSettings(GUILD, { equalizer: { bands: [1, 2, 3] } }, fakeClient()),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    () => applyGuildSettings(GUILD, { equalizer: { bands: new Array(EQ_BAND_COUNT).fill("loud") } }, fakeClient()),
    (error) => error.statusCode === 400
  );
});

test("going back to flat drops the preamp the boost had added", async () => {
  await applyGuildSettings(GUILD, { equalizer: { preset: "bassboost" } }, fakeClient());
  assert.equal(getEqualizerState(GUILD).eqPreamp, true);

  await applyGuildSettings(GUILD, { equalizer: { preset: "flat" } }, fakeClient());
  const stored = getEqualizerState(GUILD);
  assert.equal(stored.eqPreamp, undefined);
  assert.equal(stored.volume, undefined);
});

/* ---------------------------------------------------------------- stats --- */

test("a server with no listening history reports zeroes rather than nulls", () => {
  const { stats } = readGuildSettings(fakeClient(), GUILD);
  assert.equal(stats.hasData, false);
  assert.equal(stats.songsPlayed, 0);
  assert.equal(stats.msPlayed, 0);
  assert.deepEqual(stats.topSources, []);
});
