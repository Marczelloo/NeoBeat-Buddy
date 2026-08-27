const assert = require("node:assert/strict");
const test = require("node:test");
const {
  hasAdminFromOauthGuild,
  listManageableGuilds,
  assertGuildAdmin,
} = require("../../../helpers/dashboard/permissions");

const ADMIN = "8";
const NOT_ADMIN = "2048";

function fakeClient(guilds) {
  return { guilds: { cache: new Map(guilds.map((guild) => [guild.id, guild])) } };
}

test("the Administrator bit grants access", () => {
  assert.equal(hasAdminFromOauthGuild({ permissions: ADMIN }), true);
});

test("a non-administrator permission set does not grant access", () => {
  assert.equal(hasAdminFromOauthGuild({ permissions: NOT_ADMIN }), false);
});

test("guild ownership grants access regardless of the permission bits", () => {
  assert.equal(hasAdminFromOauthGuild({ permissions: NOT_ADMIN, owner: true }), true);
});

test("a malformed permissions value is denied rather than throwing", () => {
  assert.equal(hasAdminFromOauthGuild({ permissions: "not-a-number" }), false);
  assert.equal(hasAdminFromOauthGuild({}), false);
  assert.equal(hasAdminFromOauthGuild(null), false);
});

test("the guild list is the intersection of administered guilds and bot guilds", () => {
  const client = fakeClient([
    { id: "1", name: "Live One", iconURL: () => "icon-1" },
    { id: "3", name: "Live Three", iconURL: () => null },
  ]);
  const result = listManageableGuilds(client, [
    { id: "1", name: "Admin Here", permissions: ADMIN },
    { id: "2", name: "Admin But Bot Absent", permissions: ADMIN },
    { id: "3", name: "Not Admin", permissions: NOT_ADMIN },
  ]);
  assert.deepEqual(result.map((guild) => guild.id), ["1"]);
  assert.equal(result[0].name, "Live One");
  assert.equal(result[0].icon, "icon-1");
});

test("assertGuildAdmin returns the member when they hold Administrator", async () => {
  const member = { id: "u1", permissions: { has: () => true } };
  const client = fakeClient([{ id: "g1", ownerId: "other", members: { fetch: async () => member } }]);
  assert.equal(await assertGuildAdmin(client, "g1", "u1"), member);
});

test("assertGuildAdmin accepts the guild owner without the Administrator bit", async () => {
  const member = { id: "u1", permissions: { has: () => false } };
  const client = fakeClient([{ id: "g1", ownerId: "u1", members: { fetch: async () => member } }]);
  assert.equal(await assertGuildAdmin(client, "g1", "u1"), member);
});

test("assertGuildAdmin rejects a non-administrator with 403", async () => {
  const member = { id: "u1", permissions: { has: () => false } };
  const client = fakeClient([{ id: "g1", ownerId: "other", members: { fetch: async () => member } }]);
  await assert.rejects(() => assertGuildAdmin(client, "g1", "u1"), (error) => error.statusCode === 403);
});

test("assertGuildAdmin rejects with 404 when the bot is not in the guild", async () => {
  await assert.rejects(
    () => assertGuildAdmin(fakeClient([]), "missing", "u1"),
    (error) => error.statusCode === 404
  );
});

test("assertGuildAdmin rejects with 403 when the user is not a member", async () => {
  const client = fakeClient([{
    id: "g1",
    ownerId: "other",
    members: { fetch: async () => { throw new Error("Unknown Member"); } },
  }]);
  await assert.rejects(() => assertGuildAdmin(client, "g1", "u1"), (error) => error.statusCode === 403);
});
