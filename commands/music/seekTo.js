const { SlashCommandBuilder } = require("discord.js");
const { errorEmbed, successEmbed } = require("../../helpers/embeds");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { lavalinkSeekTo, lavalinkGetDuration } = require("../../helpers/lavalink/index");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("seekto")
    .addStringOption((option) =>
      option
        .setName("position")
        .setDescription("Position to seek to (in seconds or in mm:ss/hh:mm:ss format)")
        .setRequired(true)
    )
    .setDescription("Seek to a specific position in the current track"),

  async execute(interaction) {
    Log.info(
      "⏩ /seekto command",
      `user=${interaction.user.tag}`,
      `guild=${interaction.guild.name}`,
      `id=${interaction.guild.id}`
    );

    await interaction.deferReply({ ephemeral: true });

    const voiceGuard = await requireSharedVoice(interaction);
    if (!voiceGuard.ok) return interaction.editReply(voiceGuard.response);

    const djGuard = requireDj(interaction, { action: "seek within the track" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const position = interaction.options.getString("position");
    if (!position) return interaction.editReply({ embeds: [errorEmbed("You must specify a position to seek to.")] });

    const isValidPosition =
      /^\d+$/.test(position) || /^\d{1,2}:\d{1,2}$/.test(position) || /^\d{1,2}:\d{1,2}:\d{1,2}$/.test(position);
    if (!isValidPosition)
      return interaction.editReply({
        embeds: [errorEmbed("Invalid position format. Use seconds (e.g. 90) or timestamp (e.g. 3:00 or 1:30:45).")],
      });

    const positionInMs = /^\d+$/.test(position)
      ? parseInt(position) * 1000
      : (() => {
          const parts = position.split(":").map(Number);
          let seconds = 0;
          if (parts.length === 3) {
            seconds += parts[0] * 3600; // hours
            seconds += parts[1] * 60; // minutes
            seconds += parts[2]; // seconds
          } else if (parts.length === 2) {
            seconds += parts[0] * 60; // minutes
            seconds += parts[1]; // seconds
          }
          return seconds * 1000;
        })();

    if (isNaN(positionInMs) || positionInMs < 0) {
      return interaction.editReply({
        embeds: [errorEmbed("Invalid position value. It must be a positive number.")],
      });
    }

    const duration = await lavalinkGetDuration(interaction.guild.id);
    if (duration === null) {
      return interaction.editReply({ embeds: [errorEmbed("Failed to retrieve track duration.")] });
    }

    if (positionInMs > duration) {
      return interaction.editReply({
        embeds: [errorEmbed(`Invalid position. The track duration is only ${Math.floor(duration / 1000)} seconds.`)],
      });
    }

    const success = await lavalinkSeekTo(interaction.guild.id, positionInMs);
    if (success) {
      // Format the position for display
      const totalSeconds = Math.floor(positionInMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      let formattedPosition;
      if (hours > 0) {
        formattedPosition = `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      } else {
        formattedPosition = `${minutes}:${String(seconds).padStart(2, "0")}`;
      }

      return interaction.editReply({ embeds: [successEmbed(`Seeking to ${formattedPosition}...`)] });
    }

    return interaction.editReply({ embeds: [errorEmbed("Failed to seek to the specified position.")] });
  },
};
