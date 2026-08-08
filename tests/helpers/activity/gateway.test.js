const test = require("node:test");
const assert = require("node:assert/strict");
const { WebSocket } = require("ws");
const { createActivityServer, isAllowedArtworkUrl } = require("../../../helpers/activity/server");

test("Activity artwork proxy only accepts known HTTPS media hosts", () => {
  assert.equal(isAllowedArtworkUrl("https://i.ytimg.com/vi/example/maxresdefault.jpg"), true);
  assert.equal(isAllowedArtworkUrl("https://i1.sndcdn.com/artworks-example-t500x500.jpg"), true);
  assert.equal(isAllowedArtworkUrl("https://cdn-images.dzcdn.net/images/cover/example/500x500.jpg"), true);
  assert.equal(isAllowedArtworkUrl("http://127.0.0.1:8787/private"), false);
  assert.equal(isAllowedArtworkUrl("https://example.test/not-allowed.jpg"), false);
});

function waitForListening(server) {
  if (server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
}

test("Activity gateway exposes authenticated local state over HTTP and WebSocket", async (t) => {
  const previous = {
    enabled: process.env.ACTIVITY_ENABLED,
    allowDev: process.env.ACTIVITY_ALLOW_DEV,
    port: process.env.ACTIVITY_PORT,
    devGuild: process.env.ACTIVITY_DEV_GUILD_ID,
  };

  process.env.ACTIVITY_ENABLED = "true";
  process.env.ACTIVITY_ALLOW_DEV = "true";
  process.env.ACTIVITY_PORT = "0";
  process.env.ACTIVITY_DEV_GUILD_ID = "activity-test-guild";

  const client = { guilds: { cache: new Map() } };
  const gateway = createActivityServer(client);
  const server = gateway.start();
  t.after(() => {
    gateway.stop();
    for (const [key, value] of Object.entries(previous)) {
      const envKey = { enabled: "ACTIVITY_ENABLED", allowDev: "ACTIVITY_ALLOW_DEV", port: "ACTIVITY_PORT", devGuild: "ACTIVITY_DEV_GUILD_ID" }[key];
      if (value === undefined) delete process.env[envKey];
      else process.env[envKey] = value;
    }
  });

  await waitForListening(server);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const health = await fetch(`${baseUrl}/api/activity/health`).then((response) => response.json());
  const state = await fetch(`${baseUrl}/api/activity/state?guildId=activity-test-guild`).then((response) => response.json());
  const blockedArtworkResponse = await fetch(`${baseUrl}/api/activity/artwork?url=${encodeURIComponent("http://127.0.0.1/private.jpg")}`);
  const blockedArtwork = await blockedArtworkResponse.json();

  assert.equal(health.ok, true);
  assert.equal(state.ok, true);
  assert.equal(state.state.guild.id, "activity-test-guild");
  assert.equal(state.state.player.currentTrack, null);
  assert.equal(blockedArtworkResponse.status, 400);
  assert.match(blockedArtwork.error, /not allowed/i);

  const messages = [];
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/activity/ws`);
    const timeout = setTimeout(() => reject(new Error("Activity WebSocket handshake timed out.")), 2000);
    socket.on("open", () => socket.send(JSON.stringify({ type: "auth", guildId: "activity-test-guild" })));
    socket.on("message", (raw) => {
      const payload = JSON.parse(raw.toString());
      messages.push(payload.type);
      if (payload.type === "state") {
        clearTimeout(timeout);
        socket.close();
        resolve();
      }
    });
    socket.on("error", reject);
  });

  assert.deepEqual(messages, ["ready", "state"]);
});
