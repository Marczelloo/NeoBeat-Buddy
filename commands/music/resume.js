const { SlashCommandBuilder } = require("discord.js");
const { refreshNowPlayingMessage } = require("../../helpers/buttons");
const { errorEmbed, successEmbed } = require("../../helpers/embeds");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { lavalinkResume, createPoru } = require("../../helpers/lavalink/index");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume the currently paused song"),

  async execute(interaction) {
    Log.info(`/resume command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

    await interaction.deferReply({ ephemeral: true });

    const voiceGuard = await requireSharedVoice(interaction);
    if (!voiceGuard.ok) return interaction.editReply(voiceGuard.response);

    const djGuard = requireDj(interaction, { action: "resume the music" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const resumed = await lavalinkResume(interaction.guild.id);
    if (resumed) {
      const poru = createPoru(interaction.client);
      const player = poru.players.get(interaction.guild.id);
      await refreshNowPlayingMessage(interaction.client, interaction.guild.id, player);
      return interaction.editReply({ embeds: [successEmbed("Music resumed.")] });
    }

    return interaction.editReply({ embeds: [errorEmbed("No music is currently paused.")] });
  },
};
