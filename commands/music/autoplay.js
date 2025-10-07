const { SlashCommandBuilder } = require("discord.js");
const { refreshNowPlayingMessage } = require("../../helpers/buttons");
const { successEmbed } = require("../../helpers/embeds");
const { updateGuildState } = require("../../helpers/guildState");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { getPlayer } = require("../../helpers/lavalink");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Toggle autoplay mode (automatically queues related tracks)")
    .addBooleanOption((option) =>
      option.setName("enable").setDescription("Enable or disable autoplay mode").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const voiceGuard = await requireSharedVoice(interaction);
    if (!voiceGuard.ok) return interaction.editReply(voiceGuard.response);

    const djGuard = requireDj(interaction, { action: "clear the queue" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const guildId = interaction.guild.id;
    const enable = interaction.options.getBoolean("enable", true);

    updateGuildState(guildId, { autoplay: enable });

    const status = enable ? "enabled" : "disabled";

    const player = getPlayer(guildId);
    if (player) await refreshNowPlayingMessage(interaction.client, guildId, player);

    return interaction.editReply({
      embeds: [
        successEmbed(
          `Autoplay ${status}`,
          enable ? "I'll automatically queue related tracks when the queue ends." : "Autoplay has been turned off."
        ),
      ],
    });
  },
};
