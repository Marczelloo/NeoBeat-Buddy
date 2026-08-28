const assert = require("node:assert/strict");
const test = require("node:test");
const accessStore = require("../../../helpers/dashboard/access");
const {
  isGuildOwner,
  listManageableGuilds,
  assertGuildAccess,
  assertGuildOwner,
} = require("../../../helpers/dashboard/permissions");

const GUILD = "100000000000000001";
const OWNER = "200000000000000001";
const OPERATOR = "200000000000000002";
const OUTSIDER = "200000000000000003";

function fakeGuild({ id = GUILD, ownerId = OWNER, members = [OWNER, OPERATOR, OUTSIDER] } = {}) {
  return {
    id,
    name: "Test Server",
    ownerId,
    iconURL: () => null,
    members: {
      fetch: async (userId) => {
        if (!members.includes(userId)) throw new Error("Unknown Member");
        return { id: userId };
      },
    },
  };
}

function fakeClient(guilds = [fakeGuild()]) {
  return { guilds: { cache: new Map(guilds.map((guild) => [guild.id, guild])) } };
}

test.beforeEach(() => accessStore.resetGuildAccess(GUILD));

/* --------------------------------------------------------------- owner --- */

test("the server owner always has access, with no configuration at all", async () => {
  const { role } = await assertGuildAccess(fakeClient(), GUILD, OWNER);
  assert.equal(role, "owner");
  assert.equal(isGuildOwner(fakeGuild(), OWNER), true);
});

test("Administrator on its own grants nothing", async () => {
  // The whole point of the model: Administrator is handed out widely, and
  // changing how the bot behaves everywhere is a narrower thing than that.
  await assert.rejects(
    () => assertGuildAccess(fakeClient(), GUILD, OUTSIDER),
    (error) => error.statusCode === 403
  );
});

/* ------------------------------------------------------------ operator --- */

test("someone the owner has named gets access without any Discord permission", async () => {
  accessStore.setOperators(GUILD, [OPERATOR]);
  const { role } = await assertGuildAccess(fakeClient(), GUILD, OPERATOR);
  assert.equal(role, "operator");
});

test("a named operator who has left the server loses access without being pruned", async () => {
  accessStore.setOperators(GUILD, [OPERATOR]);
  const client = fakeClient([fakeGuild({ members: [OWNER] })]);

  await assert.rejects(
    () => assertGuildAccess(client, GUILD, OPERATOR),
    (error) => error.statusCode === 403
  );
});

test("removing someone from the list ends their access immediately", async () => {
  accessStore.setOperators(GUILD, [OPERATOR]);
  assert.equal((await assertGuildAccess(fakeClient(), GUILD, OPERATOR)).role, "operator");

  accessStore.setOperators(GUILD, []);
  await assert.rejects(
    () => assertGuildAccess(fakeClient(), GUILD, OPERATOR),
    (error) => error.statusCode === 403
  );
});

/* ------------------------------------------------------- the list itself --- */

test("only the owner may change who can use the dashboard", () => {
  accessStore.setOperators(GUILD, [OPERATOR]);
  const client = fakeClient();

  assert.doesNotThrow(() => assertGuildOwner(client, GUILD, OWNER));
  // An operator must not be able to promote anyone, including themselves.
  assert.throws(() => assertGuildOwner(client, GUILD, OPERATOR), (error) => error.statusCode === 403);
});

test("ownership is read from the live guild, so a transfer takes effect at once", async () => {
  const transferred = fakeClient([fakeGuild({ ownerId: OPERATOR })]);
  assert.equal((await assertGuildAccess(transferred, GUILD, OPERATOR)).role, "owner");
  await assert.rejects(
    () => assertGuildAccess(transferred, GUILD, OWNER),
    (error) => error.statusCode === 403
  );
});

/* ---------------------------------------------------------------- rail --- */

test("the rail lists only servers the visitor owns or was named on", () => {
  const other = fakeGuild({ id: "100000000000000002", ownerId: OUTSIDER });
  const client = fakeClient([fakeGuild(), other]);
  const oauthGuilds = [{ id: GUILD, name: "Test Server" }, { id: other.id, name: "Other" }];

  const owned = listManageableGuilds(client, oauthGuilds, OWNER);
  assert.deepEqual(owned.map((guild) => [guild.id, guild.role]), [[GUILD, "owner"]]);

  // Membership alone is not access, even with the guild in the OAuth list.
  assert.deepEqual(listManageableGuilds(client, oauthGuilds, OPERATOR), []);

  accessStore.setOperators(GUILD, [OPERATOR]);
  assert.deepEqual(
    listManageableGuilds(client, oauthGuilds, OPERATOR).map((guild) => [guild.id, guild.role]),
    [[GUILD, "operator"]]
  );
});

test("a server the bot has left is not listed even for its owner", () => {
  const oauthGuilds = [{ id: GUILD, name: "Test Server" }];
  assert.deepEqual(listManageableGuilds(fakeClient([]), oauthGuilds, OWNER), []);
});

test("the bot not being in the guild is a 404, not a permission refusal", async () => {
  await assert.rejects(
    () => assertGuildAccess(fakeClient([]), GUILD, OWNER),
    (error) => error.statusCode === 404
  );
});

/* ----------------------------------------------------------- change log --- */

test("the change log keeps newest first and is capped", () => {
  for (let i = 0; i < 210; i += 1) {
    accessStore.recordChange(GUILD, {
      userId: OWNER,
      username: "Owner",
      section: "player",
      field: "autoplay",
      from: "off",
      to: `on-${i}`,
    });
  }

  const log = accessStore.getChangeLog(GUILD, 50);
  assert.equal(log.length, 50);
  assert.equal(log[0].to, "on-209");
  assert.equal(log[49].to, "on-160");
});

test("the owner is never stored as an operator of their own server", () => {
  // The owner's access is implicit; listing them would make revoking look
  // possible when it is not.
  accessStore.setOperators(GUILD, [OPERATOR]);
  assert.deepEqual(accessStore.getOperators(GUILD), [OPERATOR]);
});
