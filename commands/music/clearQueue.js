const { SlashCommandBuilder } = require("discord.js");
const { errorEmbed, successEmbed } = require("../../helpers/embeds");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { lavalinkClearQueue } = require("../../helpers/lavalink/index");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder().setName("clearqueue").setDescription("Clear the current queue"),

  async execute(interaction) {
    Log.info(`/clearqueue command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

    await interaction.deferReply({ ephemeral: true });

    const voiceGuard = await requireSharedVoice(interaction);
    if (!voiceGuard.ok) return interaction.editReply(voiceGuard.response);

    const djGuard = requireDj(interaction, { action: "clear the queue" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const cleared = await lavalinkClearQueue(interaction.guild.id);
    if (cleared) {
      return interaction.editReply({ embeds: [successEmbed("Queue cleared.")] });
    }

    return interaction.editReply({ embeds: [errorEmbed("The queue is already empty.")] });
  },
};
