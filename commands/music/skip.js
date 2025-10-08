const { SlashCommandBuilder } = require("discord.js");
const skipVotes = require("../../helpers/dj/skipVotes");
const djStore = require("../../helpers/dj/store");
const { errorEmbed, successEmbed } = require("../../helpers/embeds");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { lavalinkSkip, createPoru } = require("../../helpers/lavalink/index");
const { recordSkip } = require("../../helpers/lavalink/smartAutoplay");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip the currently playing song"),

  async execute(interaction) {
    Log.info("/skip command used by " + interaction.user.tag + " in guild " + interaction.guild.name);

    await interaction.deferReply({ ephemeral: true });

    const guard = await requireSharedVoice(interaction);
    if (!guard.ok) return interaction.editReply(guard.response);

    const config = djStore.getGuildConfig(interaction.guild.id);
    const isDj = djStore.hasDjPermissions(interaction.member, config);

    const poru = createPoru(interaction.client);
    const player = poru.players.get(interaction.guild.id);

    if (!config.enabled || isDj) {
      const skipped = await lavalinkSkip(interaction.guild.id);
      if (skipped) {
        if (player?.currentTrack) recordSkip(interaction.guild.id, player.currentTrack, "command_skip");
        skipVotes.clear(interaction.guild.id);
        return interaction.editReply({ embeds: [successEmbed("Song skipped.")] });
      }

      return interaction.editReply({ embeds: [errorEmbed("No music is currently playing.")] });
    }

    const settings = djStore.getSkipSettings(interaction.guild.id);

    if (!player || (!player.currentTrack && player.queue.length === 0)) {
      return interaction.editReply({ embeds: [errorEmbed("Nothing is playing right now.")] });
    }

    const voiceChannel =
      interaction.guild.channels.cache.get(player.voiceChannel) ??
      (await interaction.guild.channels.fetch(player.voiceChannel).catch(() => null));

    if (!voiceChannel) {
      return interaction.editReply({ embeds: [errorEmbed("Could not determine the active voice channel.")] });
    }

    const listeners = voiceChannel.members.filter((member) => !member.user.bot);
    const eligibleCount = listeners.size;

    if (settings.mode === "dj") {
      const mention = djStore.getDjRoleMention(config);
      return interaction.editReply({
        embeds: [errorEmbed("Only " + mention + " can skip tracks while DJ mode is active.")],
      });
    }

    if (settings.mode === "hybrid" && isDj) {
      const skipped = await lavalinkSkip(interaction.guild.id);
      if (skipped) {
        if (player?.currentTrack) recordSkip(interaction.guild.id, player.currentTrack, "command_skip");
        skipVotes.clear(interaction.guild.id);
        return interaction.editReply({ embeds: [successEmbed("Song skipped.")] });
      }

      return interaction.editReply({ embeds: [errorEmbed("No music is currently playing.")] });
    }

    if (eligibleCount <= 1) {
      const skipped = await lavalinkSkip(interaction.guild.id);
      if (skipped) {
        if (player?.currentTrack) recordSkip(interaction.guild.id, player.currentTrack, "command_skip");
        skipVotes.clear(interaction.guild.id);
        return interaction.editReply({ embeds: [successEmbed("Song skipped.")] });
      }

      return interaction.editReply({ embeds: [errorEmbed("No music is currently playing.")] });
    }

    const result = skipVotes.registerVote({
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      voiceChannelId: voiceChannel.id,
      eligibleCount,
      threshold: settings.threshold,
    });

    if (result.status === "duplicate") {
      const mention = djStore.getDjRoleMention(config);
      return interaction.editReply({
        embeds: [
          errorEmbed(
            `You already voted. Votes: ${result.votes}/${result.required}.\nTip: ${mention} can skip instantly.`
          ),
        ],
      });
    }

    if (result.status === "passed") {
      const skipped = await lavalinkSkip(interaction.guild.id);
      skipVotes.clear(interaction.guild.id);

      if (skipped) {
        if (player?.currentTrack) recordSkip(interaction.guild.id, player.currentTrack, "command_skip");
        return interaction.editReply({ embeds: [successEmbed("Vote passed. Song skipped.")] });
      }

      return interaction.editReply({ embeds: [errorEmbed("No music is currently playing.")] });
    }

    return interaction.editReply({
      embeds: [successEmbed("Vote recorded. Votes: " + result.votes + "/" + result.required + ".")],
    });
  },
};
