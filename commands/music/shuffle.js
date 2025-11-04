const { SlashCommandBuilder } = require("discord.js");
const { errorEmbed, successEmbed } = require("../../helpers/embeds");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { lavalinkShuffle } = require("../../helpers/lavalink/index");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder().setName("shuffle").setDescription("Shuffle the current queue"),

  async execute(interaction) {
    Log.info(
      "🔀 /shuffle command",
      `user=${interaction.user.tag}`,
      `guild=${interaction.guild.name}`,
      `id=${interaction.guild.id}`
    );

    await interaction.deferReply({ ephemeral: true });

    const voiceGuard = await requireSharedVoice(interaction);
    if (!voiceGuard.ok) return interaction.editReply(voiceGuard.response);

    const djGuard = requireDj(interaction, { action: "shuffle the queue" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const shuffled = await lavalinkShuffle(interaction.guild.id);
    if (shuffled) return interaction.editReply({ embeds: [successEmbed("Queue shuffled.")] });
    else return interaction.editReply({ embeds: [errorEmbed("The queue is empty.")] });
  },
};
