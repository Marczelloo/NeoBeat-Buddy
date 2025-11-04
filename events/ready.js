const { Events } = require("discord.js");
const announcer = require("../helpers/announcements/announcer");
const { buildControlRows } = require("../helpers/buttons");
const { playerEmbed } = require("../helpers/embeds");
const { getGuildState, updateGuildState } = require("../helpers/guildState.js");
const { createPoru } = require("../helpers/lavalink/index");
const Log = require("../helpers/logs/log");
const { formatDuration } = require("../helpers/utils");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    Log.success(`Logged in as ${client.user.tag}`);

    // Initialize announcer system
    await announcer.init();

    // Update bot status with version info
    announcer.updateBotStatus(client);

    try {
      const poru = createPoru(client);
      poru.init(client);

      poru.on("trackStartUI", async (player, track) => {
        try {
          const info = track?.info || {};

          if (!info.title) {
            Log.warning(
              "trackStartUI fired with track missing title",
              "",
              `guild=${player.guildId}`,
              `track=${track?.track?.substring(0, 20) || "unknown"}`
            );
            return;
          }

          const state = getGuildState(player.guildId) ?? {};
          const channelId = state.nowPlayingChannel ?? player.textChannel;
          if (!channelId) return;

          const channel = await client.channels.fetch(channelId).catch(() => null);
          if (!channel) return;

          if (state.nowPlayingMessage) {
            await channel.messages.delete(state.nowPlayingMessage).catch((err) => {
              if (err?.code !== 10008) Log.error("Failed to delete now-playing message", err);
            });
          }

          const duration = info.isStream ? "Live" : formatDuration(info.length ?? 0);
          const position = info.isStream ? "Live" : formatDuration(player.position ?? 0);
          const artwork = info.artworkUrl ?? info.image ?? "https://i.imgur.com/3g7nmJC.png";
          const autoplay = getGuildState(player.guildId)?.autoplay ?? false;
          const source = info.sourceName || null;
          const quality =
            player.currentTrack?.pluginInfo?.isPreview === false
              ? null
              : player.currentTrack?.pluginInfo?.quality || null;

          const embed = playerEmbed(
            info.title,
            info.uri,
            artwork,
            info.author ?? "Unknown",
            info.requesterTag ?? "Unknown",
            info.requesterAvatar ?? null,
            duration,
            position,
            info.loop,
            player.volume,
            autoplay,
            source,
            quality
          );

          const controls = buildControlRows({
            paused: player.isPaused,
            loopMode: player.loop ?? "NONE",
          });

          const message = await channel.send({ embeds: [embed], components: controls }).catch((err) => {
            Log.error("Failed to send now-playing message", err);
            return null;
          });
          if (!message) return;

          updateGuildState(player.guildId, {
            nowPlayingMessage: message.id,
            nowPlayingChannel: channel.id,
            nowPlayingRequesterTag: info.requesterTag ?? "Unknown",
            nowPlayingRequesterAvatar: info.requesterAvatar ?? null,
          });
        } catch (error) {
          Log.error("Error in trackStartUI handler", error);
        }
      });

      poru.on("trackEnd", async (player) => {
        const state = getGuildState(player.guildId);
        const channelId = state?.nowPlayingChannel;
        const messageId = state?.nowPlayingMessage;
        if (!channelId || !messageId) return;

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) return;

        await channel.messages.delete(messageId).catch((err) => {
          if (err?.code !== 10008) Log.error("Failed to delete now-playing message on track end", err);
        });

        updateGuildState(player.guildId, {
          nowPlayingMessage: null,
        });
      });

      poru.on("queueEnd", async (player) => {
        const state = getGuildState(player.guildId);
        const channelId = state?.nowPlayingChannel;
        const messageId = state?.nowPlayingMessage;

        // Check if 24/7 radio mode is enabled
        if (state?.radio247) {
          Log.info("📻 24/7 mode queuing", `guild=${player.guildId}`);

          // Import autoplay function dynamically to avoid circular deps
          const { queueAutoplayTrack } = require("../helpers/lavalink/autoplay");
          const { playbackState } = require("../helpers/lavalink/state");

          const pbState = playbackState.get(player.guildId);
          const lastTrack = pbState?.history?.[pbState.history.length - 1];

          if (lastTrack) {
            await queueAutoplayTrack(player, lastTrack, channelId);
          } else {
            Log.warning("⚠️ 24/7 active but no history", `guild=${player.guildId}`);
          }
          return;
        }

        if (!channelId || !messageId) return;

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) return;

        await channel.messages.delete(messageId).catch((err) => {
          if (err?.code !== 10008) Log.error("Failed to delete now-playing message on queue end", err);
        });

        updateGuildState(player.guildId, {
          nowPlayingMessage: null,
        });
      });

      // Send version announcements to all guilds
      Log.info("📢 Checking for version announcements...");
      let announcementsSent = 0;
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          const wasAnnounced = await announcer.sendAnnouncement(client, guildId, null);
          if (wasAnnounced) {
            announcementsSent++;
          }
        } catch (err) {
          Log.error(`Failed to send announcement to guild ${guild.name} (${guildId})`, err);
        }
      }
      if (announcementsSent > 0) {
        Log.success(`Sent version announcements to ${announcementsSent} guild(s)`);
      } else {
        Log.info("✅ No new announcements to send");
      }
    } catch (err) {
      Log.error("Failed to initialize Poru in ready event", err);
    }
  },
};
