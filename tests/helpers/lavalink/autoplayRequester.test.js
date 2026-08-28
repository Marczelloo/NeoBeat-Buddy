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
    let replacementOptions = null;
    let replacementPlayer = null;
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
        fetchAutoplayV3Track: async (reference, _guildId, options = {}) => {
          assert.ok(reference === player.currentTrack || reference === replacementPlayer?.currentTrack);
          if (reference === replacementPlayer?.currentTrack) replacementOptions = options;
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

    const { queueAutoplayTrack, replaceQueuedAutoplayTrack } = require(modulePath);
    const added = await queueAutoplayTrack(player, player.currentTrack, "text-channel-id");

    assert.equal(added, true);
    assert.equal(queuedTracks.length, 1);
    assert.equal(queuedTracks[0].info.requester, "bot-id");
    assert.equal(queuedTracks[0].info.requesterTag, "MewBot");
    assert.equal(queuedTracks[0].info.autoplayed, true);
    assert.equal(queuedTracks[0].userData.autoplay, true);

    const rejectedTrack = {
      track: "old-encoded",
      info: { title: "Rejected Pick", author: "Artist", length: 120000, autoplayed: true },
      userData: { autoplay: true, activityQueueId: "queued-auto" },
    };
    replacementPlayer = {
      ...player,
      currentTrack: { info: { title: "Current", author: "Anchor" } },
      queue: [rejectedTrack],
    };
    const replacement = await replaceQueuedAutoplayTrack(replacementPlayer, {
      rejectedTrack,
      expectedQueueItemId: "queued-auto",
    });

    assert.equal(replacement.success, true);
    assert.equal(replacementPlayer.queue.length, 1);
    assert.equal(replacementPlayer.queue[0].info.title, "Next Song");
    assert.equal(replacementPlayer.queue[0].info.autoplayed, true);
    assert.equal(replacementPlayer.queue[0].userData.autoplayReplacementOf.title, "Rejected Pick");
    assert.deepEqual(replacementOptions.blockedTracks, [rejectedTrack]);
    assert.equal(replacementOptions.selectionIntent.mode, "replace");
  });

  test("leaves the queue alone when the rejected pick moves while a replacement is resolving", async () => {
    const modulePath = require.resolve("../../../helpers/lavalink/autoplay");
    const rejectedTrack = {
      track: "old-encoded",
      info: { title: "Rejected Pick", author: "Artist", length: 120000, autoplayed: true },
      userData: { autoplay: true, activityQueueId: "queued-auto" },
    };
    const survivingTrack = {
      track: "manual-encoded",
      info: { title: "Manual Pick", author: "Someone" },
      userData: { activityQueueId: "queued-manual" },
    };
    const player = {
      guildId: "guild-stale",
      currentTrack: { info: { title: "Current", author: "Anchor" } },
      queue: [rejectedTrack],
    };

    require.cache[require.resolve("../../../helpers/lavalink/autoplayV3")] = {
      id: require.resolve("../../../helpers/lavalink/autoplayV3"),
      filename: require.resolve("../../../helpers/lavalink/autoplayV3"),
      loaded: true,
      exports: {
        // The track is skipped, or someone clears the queue, while the
        // provider request is still open. The replacement must not land on
        // whatever now occupies that index.
        fetchAutoplayV3Track: async () => {
          player.queue = [survivingTrack];
          return { track: "new-encoded", info: { title: "Next Song", author: "Artist" }, userData: {} };
        },
      },
    };
    require.cache[require.resolve("../../../helpers/lavalink/autoplayExposure")] = {
      id: require.resolve("../../../helpers/lavalink/autoplayExposure"),
      filename: require.resolve("../../../helpers/lavalink/autoplayExposure"),
      loaded: true,
      exports: { recordAutoplayExposure: async () => {} },
    };
    delete require.cache[modulePath];

    const { replaceQueuedAutoplayTrack } = require(modulePath);
    const result = await replaceQueuedAutoplayTrack(player, {
      rejectedTrack,
      expectedQueueItemId: "queued-auto",
    });

    assert.equal(result.success, false);
    assert.equal(result.stale, true);
    assert.deepEqual(player.queue, [survivingTrack]);
  });
});
