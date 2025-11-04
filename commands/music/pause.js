const { SlashCommandBuilder } = require("discord.js");
const { refreshNowPlayingMessage } = require("../../helpers/buttons");
const { errorEmbed, successEmbed } = require("../../helpers/embeds");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { lavalinkPause, createPoru } = require("../../helpers/lavalink/index");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause the currently playing song"),

  async execute(interaction) {
    Log.info(
      "⏸️ /pause command",
      `user=${interaction.user.tag}`,
      `guild=${interaction.guild.name}`,
      `id=${interaction.guild.id}`
    );

    await interaction.deferReply({ ephemeral: true });

    const voiceGuard = await requireSharedVoice(interaction);
    if (!voiceGuard.ok) return interaction.editReply(voiceGuard.response);

    const djGuard = requireDj(interaction, { action: "pause the music" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const paused = await lavalinkPause(interaction.guild.id);
    if (paused) {
      const poru = createPoru(interaction.client);
      const player = poru.players.get(interaction.guild.id);
      await refreshNowPlayingMessage(interaction.client, interaction.guild.id, player);
      return interaction.editReply({ embeds: [successEmbed("Music paused.")] });
    }

    return interaction.editReply({ embeds: [errorEmbed("No music is currently playing.")] });
  },
};
