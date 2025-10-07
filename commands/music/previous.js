const { SlashCommandBuilder } = require("discord.js");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { lavalinkPrevious } = require("../../helpers/lavalink/index");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("previous")
    .setDescription("Replay the previous track or restart the current one."),

  async execute(interaction) {
    Log.info(`/previous command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

    await interaction.deferReply({ ephemeral: true });

    const voiceGuard = await requireSharedVoice(interaction);
    if (!voiceGuard.ok) return interaction.editReply(voiceGuard.response);

    const djGuard = requireDj(interaction, { action: "rewind the playback" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const result = await lavalinkPrevious(interaction.guild.id);

    switch (result?.status) {
      case "no_player":
        return interaction.editReply({ content: "Nothing is playing right now." });
      case "empty":
        return interaction.editReply({ content: "No playback history yet." });
      case "restart":
        return interaction.editReply({ content: "Restarted the current track from the beginning." });
      case "previous":
        return interaction.editReply({
          content: `Now playing the previous track: **${result.track?.info?.title ?? "Unknown"}**`,
        });
      default:
        return interaction.editReply({ content: "Could not jump to the previous track." });
    }
  },
};
