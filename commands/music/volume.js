const { SlashCommandBuilder } = require("discord.js");
const { refreshNowPlayingMessage } = require("../../helpers/buttons");
const { errorEmbed, successEmbed } = require("../../helpers/embeds");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { lavalinkSetVolume, createPoru } = require("../../helpers/lavalink/index");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set the playback volume (0-100)")
    .addIntegerOption((option) =>
      option
        .setName("level")
        .setDescription("The volume level to set")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),

  async execute(interaction) {
    Log.info(
      "🔊 /volume command",
      `user=${interaction.user.tag}`,
      `guild=${interaction.guild.name}`,
      `id=${interaction.guild.id}`
    );

    await interaction.deferReply({ ephemeral: true });

    const voiceGuard = await requireSharedVoice(interaction);
    if (!voiceGuard.ok) return interaction.editReply(voiceGuard.response);

    const djGuard = requireDj(interaction, { action: "change the volume" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const volume = interaction.options.getInteger("level");
    const success = await lavalinkSetVolume(interaction.guild.id, volume);

    if (success) {
      const poru = createPoru(interaction.client);
      const player = poru.players.get(interaction.guild.id);
      await refreshNowPlayingMessage(interaction.client, interaction.guild.id, player);
      return interaction.editReply({ embeds: [successEmbed(`Volume set to ${volume}.`)] });
    }

    return interaction.editReply({ embeds: [errorEmbed("Failed to set volume.")] });
  },
};
