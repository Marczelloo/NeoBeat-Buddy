const assert = require("node:assert/strict");
const test = require("node:test");
const { describeEmbedOptions, sendDashboardEmbed, LIMITS } = require("../../../helpers/dashboard/embed");

const GUILD = "100000000000000001";
const CHANNEL = "200000000000000001";
const LOCKED = "200000000000000002";
const VOICE = "200000000000000003";

function fakeClient({ sendFails = false } = {}) {
  const sent = [];
  const makeChannel = (id, type, canPost) => ({
    id,
    name: `channel-${id.slice(-1)}`,
    type,
    permissionsFor: () => ({ has: () => canPost }),
    send: async (payload) => {
      if (sendFails) throw new Error("Missing Permissions");
      sent.push(payload);
      return { id: "900000000000000001", url: "https://discord.com/channels/1/2/3" };
    },
  });

  const channels = new Map([
    [CHANNEL, makeChannel(CHANNEL, 0, true)],
    [LOCKED, makeChannel(LOCKED, 0, false)],
    [VOICE, makeChannel(VOICE, 2, true)],
  ]);

  return {
    sent,
    client: {
      guilds: {
        cache: new Map([[GUILD, {
          id: GUILD,
          members: { me: { id: "bot" } },
          channels: { cache: channels },
        }]]),
      },
    },
  };
}

const valid = { channelId: CHANNEL, title: "Rules", description: "Be kind." };

test("the options list every text channel and say where MewBit cannot post", () => {
  const { client } = fakeClient();
  const options = describeEmbedOptions(client, GUILD);

  // Reported rather than hidden: a missing channel is a mystery, a disabled one
  // is an instruction.
  assert.deepEqual(
    options.channels.map((channel) => [channel.id, channel.canPost]),
    [[CHANNEL, true], [LOCKED, false]]
  );
  assert.equal(options.limits.description, LIMITS.description);
  assert.match(options.defaultColor, /^#[0-9A-F]{6}$/);
});

test("a valid embed reaches the channel", async () => {
  const { client, sent } = fakeClient();
  const result = await sendDashboardEmbed(client, GUILD, { ...valid, footer: "MewBit", timestamp: true });

  assert.equal(sent.length, 1);
  assert.equal(result.channelName, "channel-1");
  const embed = sent[0].embeds[0].toJSON();
  assert.equal(embed.title, "Rules");
  assert.equal(embed.footer.text, "MewBit");
  assert.ok(embed.timestamp);
});

test("a channel from another server cannot be posted through this one", async () => {
  // The channel is resolved from this guild's own cache, so access to one
  // server never becomes a way to post into another.
  const { client } = fakeClient();
  await assert.rejects(
    () => sendDashboardEmbed(client, GUILD, { ...valid, channelId: "999000000000000009" }),
    (error) => error.statusCode === 400
  );
});

test("a voice channel is refused", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => sendDashboardEmbed(client, GUILD, { ...valid, channelId: VOICE }),
    (error) => error.statusCode === 400
  );
});

test("a channel MewBit cannot post in is refused before Discord is called", async () => {
  const { client, sent } = fakeClient();
  await assert.rejects(
    () => sendDashboardEmbed(client, GUILD, { ...valid, channelId: LOCKED }),
    (error) => error.statusCode === 400 && /Send Messages/.test(error.message)
  );
  assert.equal(sent.length, 0);
});

test("title and description are required", async () => {
  const { client } = fakeClient();
  for (const patch of [{ title: "" }, { description: "   " }]) {
    await assert.rejects(
      () => sendDashboardEmbed(client, GUILD, { ...valid, ...patch }),
      (error) => error.statusCode === 400
    );
  }
});

test("text longer than Discord allows is refused with the limit named", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => sendDashboardEmbed(client, GUILD, { ...valid, description: "x".repeat(LIMITS.description + 1) }),
    (error) => error.statusCode === 400 && error.message.includes(String(LIMITS.description))
  );
});

test("only http and https image URLs are accepted", async () => {
  const { client } = fakeClient();
  for (const image of ["javascript:alert(1)", "file:///etc/passwd", "not a url"]) {
    await assert.rejects(
      () => sendDashboardEmbed(client, GUILD, { ...valid, image }),
      (error) => error.statusCode === 400
    );
  }

  const ok = await sendDashboardEmbed(client, GUILD, { ...valid, image: "https://example.test/a.png" });
  assert.ok(ok.url);
});

test("a malformed colour is refused rather than silently defaulted", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => sendDashboardEmbed(client, GUILD, { ...valid, color: "red" }),
    (error) => error.statusCode === 400
  );
});

test("Discord refusing the send is reported as an upstream failure, not a bad request", async () => {
  const { client } = fakeClient({ sendFails: true });
  await assert.rejects(
    () => sendDashboardEmbed(client, GUILD, valid),
    (error) => error.statusCode === 502
  );
});
