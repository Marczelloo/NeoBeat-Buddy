const assert = require("node:assert/strict");
const test = require("node:test");

test.describe("Lavalink autoplay queueing", () => {
  test("stores the Discord bot username as the requester label", async () => {
    const modulePath = require.resolve("../../../helpers/lavalink/autoplay");
    const relatedTrack = {
      track: "encoded",
      info: { title: "Next Song", author: "Artist", length: 120000 },
      userData: {},
    };
    const queuedTracks = [];
    const player = {
      guildId: "guild-1",
      voiceChannel: "voice-1",
      currentTrack: { info: { title: "Current" } },
      queue: {
        length: 0,
        add: async (track) => queuedTracks.push(track),
      },
      poru: {
        client: {
          guilds: {
            cache: {
              get: () => ({
                channels: {
                  cache: {
                    get: (channelId) => ({
                      members: {
                        has: (userId) => channelId === "voice-1" && userId === "bot-id",
                      },
                    }),
                  },
                },
              }),
            },
          },
          user: { id: "bot-id", username: "MewBot" },
        },
      },
    };

    require.cache[require.resolve("../../../helpers/lavalink/autoplayV3")] = {
      id: require.resolve("../../../helpers/lavalink/autoplayV3"),
      filename: require.resolve("../../../helpers/lavalink/autoplayV3"),
      loaded: true,
      exports: {
        fetchAutoplayV3Track: async (reference) => {
          assert.equal(reference, player.currentTrack);
          return relatedTrack;
        },
      },
    };
    require.cache[require.resolve("../../../helpers/lavalink/autoplayExposure")] = {
      id: require.resolve("../../../helpers/lavalink/autoplayExposure"),
      filename: require.resolve("../../../helpers/lavalink/autoplayExposure"),
      loaded: true,
      exports: {
        recordAutoplayExposure: async () => {},
      },
    };
    delete require.cache[modulePath];

    const { queueAutoplayTrack } = require(modulePath);
    const added = await queueAutoplayTrack(player, player.currentTrack, "text-channel-id");

    assert.equal(added, true);
    assert.equal(queuedTracks.length, 1);
    assert.equal(queuedTracks[0].info.requester, "bot-id");
    assert.equal(queuedTracks[0].info.requesterTag, "MewBot");
    assert.equal(queuedTracks[0].info.autoplayed, true);
    assert.equal(queuedTracks[0].userData.autoplay, true);
  });
});
