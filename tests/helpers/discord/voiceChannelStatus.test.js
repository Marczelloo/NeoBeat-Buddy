const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  buildTrackStatus,
  clearVoiceChannelStatusCache,
  handleRawGatewayPacket,
  restoreVoiceChannelStatus,
  setVoiceChannelStatus,
  updateTrackVoiceChannelStatus,
} = require("../../../helpers/discord/voiceChannelStatus");

describe("Voice channel track status", () => {
  it("keeps the existing channel status as a prefix", () => {
    assert.strictEqual(buildTrackStatus("Chill zone", { info: { title: "Kuki Cieple Dranie" } }), "Chill zone | Kuki Cieple Dranie");
    assert.strictEqual(buildTrackStatus("", { info: { title: "Kuki Cieple Dranie" } }), "Kuki Cieple Dranie");
  });

  it("updates the title and restores the original status after playback", async () => {
    const calls = [];
    const client = {
      rest: {
        put: async (route, payload) => calls.push({ route, payload }),
      },
      channels: { cache: new Map() },
    };
    const player = { guildId: "guild-1", voiceChannel: "voice-1" };

    clearVoiceChannelStatusCache("voice-1");
    handleRawGatewayPacket({
      t: "CHANNEL_INFO",
      d: { channels: [{ id: "voice-1", status: "Chill zone" }] },
    });

    await updateTrackVoiceChannelStatus(client, player, { info: { title: "Kuki Cieple Dranie" } });
    await restoreVoiceChannelStatus(client, "voice-1");

    assert.deepStrictEqual(calls.map((call) => call.route), [
      "/channels/voice-1/voice-status",
      "/channels/voice-1/voice-status",
    ]);
    assert.deepStrictEqual(calls[0].payload.body, { status: "Chill zone | Kuki Cieple Dranie" });
    assert.deepStrictEqual(calls[1].payload.body, { status: "Chill zone" });
  });

  it("handles clearing a status when there was no original text", async () => {
    const calls = [];
    const client = { rest: { put: async (_route, payload) => calls.push(payload.body) } };

    clearVoiceChannelStatusCache("voice-2");
    handleRawGatewayPacket({ t: "CHANNEL_INFO", d: { channels: [{ id: "voice-2", status: null }] } });
    await setVoiceChannelStatus(client, "voice-2", "Track title");
    await restoreVoiceChannelStatus(client, "voice-2");

    assert.deepStrictEqual(calls, [{ status: "Track title" }, { status: null }]);
  });
});
