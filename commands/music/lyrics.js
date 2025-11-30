const { SlashCommandBuilder } = require("discord.js");
const { errorEmbed } = require("../../helpers/embeds");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { buildLyricsResponse, buildSyncedLyricsDisplay } = require("../../helpers/lavalink/lyricsFormatter");
const { getPlayer } = require("../../helpers/lavalink/players");
const { getLyricsState } = require("../../helpers/lavalink/state");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Show lyrics for the currently playing song")
    .addBooleanOption((option) =>
      option.setName("synced").setDescription("Enable live synced lyrics (if available)").setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const guard = await requireSharedVoice(interaction);
    if (!guard.ok) return interaction.editReply(guard.response);

    const player = getPlayer(interaction.guildId);

    if (!player?.currentTrack) return interaction.editReply({ embeds: [errorEmbed("No track is currently playing.")] });

    const payload = getLyricsState(interaction.guildId);

    if (!payload || (!payload.lyrics && !payload.lines))
      return interaction.editReply({ embeds: [errorEmbed("No lyrics were found for this track.")] });

    const synced = interaction.options.getBoolean("synced") ?? false;

    // Try synced lyrics if requested and available
    if (synced && payload.synced && Array.isArray(payload.lines) && payload.lines.length > 0) {
      return buildSyncedLyricsDisplay({
        interaction,
        player,
        payload,
        trackTitle: payload.track?.title ?? player.currentTrack?.info?.title ?? "Unknown track",
      });
    }

    // Fall back to static lyrics
    const text =
      payload.lyrics || (Array.isArray(payload.lines) ? payload.lines.map((entry) => entry.line).join("\n") : null);

    if (!text) return interaction.editReply({ embeds: [errorEmbed("The lyrics provider returned an empty result.")] });

    const trackTitle = payload.track?.title ?? player.currentTrack?.info?.title ?? "Unknown track";

    const { embeds, content } = buildLyricsResponse({
      text,
      provider: payload?.source,
      trackTitle,
    });

    if (!embeds.length)
      return interaction.editReply({
        embeds: [errorEmbed("The lyrics provider returned an empty result.")],
        content: null,
      });

    return interaction.editReply({
      content,
      embeds,
    });
  },
};
