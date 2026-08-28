const assert = require("node:assert/strict");
const test = require("node:test");

const STORE_PATH = require.resolve("../../../helpers/playlists/store");

/* The real store reads and writes helpers/data/playlists.json synchronously, so
   requiring it here would put test playlists into the repo. It is replaced with
   an in-memory pair, which also lets a test assert exactly what was persisted. */
let disk = { user: {}, server: {} };

require.cache[STORE_PATH] = {
  id: STORE_PATH,
  filename: STORE_PATH,
  loaded: true,
  exports: {
    loadPlaylists: () => JSON.parse(JSON.stringify(disk)),
    savePlaylists: (data) => {
      disk = JSON.parse(JSON.stringify(data));
    },
  },
};

const {
  listServerPlaylists,
  editServerPlaylist,
  deleteServerPlaylist,
  MAX_NAME,
} = require("../../../helpers/dashboard/playlists");

const GUILD = "100000000000000001";
const OTHER = "100000000000000002";
const MAKER = "200000000000000001";

function seed() {
  disk = {
    user: {
      [MAKER]: [{ id: "u-1", name: "Personal", type: "user", tracks: [], createdBy: MAKER }],
    },
    server: {
      [GUILD]: [
        {
          id: "s-1",
          name: "Friday Night",
          type: "server",
          description: "Loud things",
          createdBy: MAKER,
          createdAt: 1_700_000_000_000,
          tracks: [
            { title: "Loser", author: "Tame Impala", duration: 210_000, source: "deezer" },
            { title: "Rosemary", author: "Deftones", duration: 411_000 },
          ],
        },
        { id: "s-2", name: "Quiet", type: "server", tracks: [], createdBy: "300000000000000003" },
      ],
      [OTHER]: [{ id: "x-1", name: "Elsewhere", type: "server", tracks: [], createdBy: MAKER }],
    },
  };
}

function fakeClient() {
  return {
    guilds: {
      cache: new Map([[GUILD, {
        id: GUILD,
        members: {
          fetch: async (userId) => {
            if (userId !== MAKER) throw new Error("Unknown Member");
            return { user: { username: "themaker" } };
          },
        },
      }]]),
    },
  };
}

test.beforeEach(seed);

test("only this server's shared playlists are listed, with their tracks", async () => {
  const playlists = await listServerPlaylists(fakeClient(), GUILD);

  assert.deepEqual(playlists.map((playlist) => playlist.name), ["Friday Night", "Quiet"]);
  assert.equal(playlists[0].trackCount, 2);
  assert.equal(playlists[0].durationMs, 621_000);
  assert.equal(playlists[0].tracks[0].title, "Loser");
});

test("a creator who has left the server is reported as unresolved, not as missing", async () => {
  // The owner needs to see exactly this: whose playlist can no longer be
  // tidied up by its author.
  const playlists = await listServerPlaylists(fakeClient(), GUILD);
  assert.equal(playlists[0].createdByName, "themaker");
  assert.equal(playlists[1].createdByName, null);
  assert.equal(playlists[1].createdBy, "300000000000000003");
});

test("personal playlists are never reachable from here", async () => {
  const playlists = await listServerPlaylists(fakeClient(), GUILD);
  assert.equal(playlists.some((playlist) => playlist.name === "Personal"), false);

  // And editing cannot reach one either, even by id.
  assert.throws(() => editServerPlaylist(GUILD, "u-1", { name: "Hijacked" }), (error) => error.statusCode === 404);
  assert.equal(disk.user[MAKER][0].name, "Personal");
});

test("a playlist from another server cannot be edited through this one", () => {
  assert.throws(() => editServerPlaylist(GUILD, "x-1", { name: "Renamed" }), (error) => error.statusCode === 404);
  assert.equal(disk.server[OTHER][0].name, "Elsewhere");
});

test("renaming persists, and the creator's own rule does not block the server's owner", () => {
  // `/playlist` refuses this because the actor did not create it. The whole
  // point of the section is that the person running the server can.
  const updated = editServerPlaylist(GUILD, "s-2", { name: "Quiet Hours", description: "Late" });

  assert.equal(updated.name, "Quiet Hours");
  assert.equal(disk.server[GUILD][1].name, "Quiet Hours");
  assert.equal(disk.server[GUILD][1].description, "Late");
});

test("a duplicate or empty name is refused", () => {
  assert.throws(() => editServerPlaylist(GUILD, "s-2", { name: "friday night" }), (error) => error.statusCode === 400);
  assert.throws(() => editServerPlaylist(GUILD, "s-2", { name: "   " }), (error) => error.statusCode === 400);
  assert.throws(
    () => editServerPlaylist(GUILD, "s-2", { name: "x".repeat(MAX_NAME + 1) }),
    (error) => error.statusCode === 400
  );
  assert.equal(disk.server[GUILD][1].name, "Quiet");
});

test("renaming a playlist to its own name is not a duplicate clash", () => {
  const updated = editServerPlaylist(GUILD, "s-1", { name: "Friday Night", description: "Still loud" });
  assert.equal(updated.name, "Friday Night");
  assert.equal(updated.description, "Still loud");
});

test("deleting removes only that playlist and reports what went", () => {
  const removed = deleteServerPlaylist(GUILD, "s-1");

  assert.deepEqual(removed, { name: "Friday Night", trackCount: 2 });
  assert.deepEqual(disk.server[GUILD].map((playlist) => playlist.id), ["s-2"]);
  assert.equal(disk.server[OTHER].length, 1);
  assert.equal(disk.user[MAKER].length, 1);
});

test("deleting one that has already gone is a 404 rather than a silent success", () => {
  deleteServerPlaylist(GUILD, "s-1");
  assert.throws(() => deleteServerPlaylist(GUILD, "s-1"), (error) => error.statusCode === 404);
});

test("a server with no shared playlists lists nothing rather than failing", async () => {
  disk.server = {};
  assert.deepEqual(await listServerPlaylists(fakeClient(), GUILD), []);
});
