const { SlashCommandBuilder } = require("discord.js");
const {
  buildPanelEmbed,
  buildPanelComponents,
  updatePanelState,
  getPanelState,
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
    const state = getPanelState(guildId);

    if (state?.messageId && state?.channelId) {
      try {
        const channel = await interaction.client.channels.fetch(state.channelId);
        const message = await channel.messages.fetch(state.messageId);

        const embed = buildPanelEmbed(guildId);
        const components = buildPanelComponents(guildId);

        await message.edit({ embeds: [embed], components });

        return interaction.editReply({
          content: `✅ Refreshed [existing mixer panel](https://discord.com/channels/${guildId}/${state.channelId}/${state.messageId})`,
        });
      } catch (err) {
        // Panel message was deleted, create new one
      }
    }

    const embed = buildPanelEmbed(guildId);
    const components = buildPanelComponents(guildId);

    const panelMessage = await interaction.channel.send({
      embeds: [embed],
      components,
    });

    updatePanelState(guildId, {
      messageId: panelMessage.id,
      channelId: interaction.channel.id,
      selectedBandIndex: 0,
      lastInteractionUserId: interaction.user.id,
    });

    return interaction.editReply({
      content: "✅ Mixer panel created! Use the controls below to adjust the equalizer.",
    });
  },
};
