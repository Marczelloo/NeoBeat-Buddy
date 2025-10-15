const { SlashCommandBuilder } = require("discord.js");
const {
  buildPanelEmbed,
  buildPanelComponents,
  updatePanelState,
  deletePreviousPanel,
  resetInactivityTimer,
} = require("../../helpers/equalizer/panel");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { getPlayer } = require("../../helpers/lavalink");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("eqpanel")
    .setDescription("Open the interactive equalizer mixer panel (DJ only)"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const voiceGuard = await requireSharedVoice(interaction);
    if (!voiceGuard.ok) return interaction.editReply(voiceGuard.response);

    const djGuard = requireDj(interaction, { action: "use the EQ panel" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const player = getPlayer(interaction.guild.id);
    if (!player) {
      return interaction.editReply({
        content: "❌ No active player. Play some music first!",
      });
    }

    const guildId = interaction.guild.id;

    // Delete previous panel if it exists (keeps chat clean)
    await deletePreviousPanel(guildId, interaction.client);

    // Create new panel
    const embed = buildPanelEmbed(guildId);
    const components = buildPanelComponents(guildId);

    const panelMessage = await interaction.channel.send({
      embeds: [embed],
      components,
    });

    // Update state and start inactivity timer
    updatePanelState(guildId, {
      messageId: panelMessage.id,
      channelId: interaction.channel.id,
      selectedBandIndex: 0,
      lastInteractionUserId: interaction.user.id,
    });

    resetInactivityTimer(guildId, interaction.client);

    return interaction.editReply({
      content: "✅ Mixer panel created! It will auto-delete after 10 minutes of inactivity.",
    });
  },
};
