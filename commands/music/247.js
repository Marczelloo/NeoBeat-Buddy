const { SlashCommandBuilder } = require("discord.js");
const { errorEmbed, successEmbed } = require("../../helpers/embeds");
const { getGuildState, updateGuildState } = require("../../helpers/guildState");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { getPlayer } = require("../../helpers/lavalink");
const { queueAutoplayTrack } = require("../../helpers/lavalink/autoplay");
const { playbackState } = require("../../helpers/lavalink/state");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("247")
    .setDescription("Toggle 24/7 radio mode - bot stays in channel and plays continuously"),

  async execute(interaction) {
    Log.info(
      "📻 /247 command",
      `user=${interaction.user.tag}`,
      `guild=${interaction.guild.name}`,
      `id=${interaction.guild.id}`
    );

    await interaction.deferReply();

    const djGuard = requireDj(interaction, { action: "toggle 24/7 mode" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const guildId = interaction.guild.id;
    const state = getGuildState(guildId);
    const player = getPlayer(guildId);

    if (!player) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            "No Active Player",
            "The bot must be in a voice channel with some listening history to enable 24/7 mode.\n\n" +
              "**To get started:**\n" +
              "1. Join a voice channel\n" +
              "2. Use `/play` to start playing music\n" +
              "3. Then use `/247` to enable 24/7 radio mode"
          ),
        ],
      });
    }

    // Check if there's any listening history to base recommendations on
    const pbState = playbackState.get(guildId);
    const hasHistory = pbState?.history && pbState.history.length > 0;

    if (!hasHistory && !player.currentTrack) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            "No Listening History",
            "24/7 radio mode needs some listening history to generate personalized recommendations.\n\n" +
              "**To get started:**\n" +
              "1. Play at least one song with `/play`\n" +
              "2. Then enable 24/7 mode with `/247`\n\n" +
              "The more you listen, the better the recommendations!"
          ),
        ],
      });
    }

    const newState = !state.radio247;

    updateGuildState(guildId, { radio247: newState });

    if (newState) {
      // Enable 24/7 mode
      Log.info("📻 24/7 mode enabled", `user=${interaction.user.tag}`, `guild=${guildId}`);

      // If queue is empty, start playing immediately
      if (player.queue.length === 0 && !player.currentTrack) {
        const pbState = playbackState.get(guildId);
        const lastTrack = pbState?.history?.[pbState.history.length - 1];

        if (lastTrack) {
          const channelId = state.nowPlayingChannel || interaction.channelId;
          await queueAutoplayTrack(player, lastTrack, channelId);
        }
      }

      return interaction.editReply({
        embeds: [
          successEmbed(
            "🔊 24/7 Radio Mode Enabled",
            "The bot will stay in the voice channel and continuously play music based on listening history. Music will auto-queue when the queue ends.\n\n" +
              "**Disable with:** `/247` or `/stop`"
          ),
        ],
      });
    } else {
      // Disable 24/7 mode
      Log.info("🔇 24/7 mode disabled", `user=${interaction.user.tag}`, `guild=${guildId}`);

      return interaction.editReply({
        embeds: [
          successEmbed(
            "🔇 24/7 Radio Mode Disabled",
            "The bot will behave normally. Use `/autoplay` if you want automatic queueing without 24/7 mode."
          ),
        ],
      });
    }
  },
};
