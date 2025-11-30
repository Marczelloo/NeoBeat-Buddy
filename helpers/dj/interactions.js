const { lavalinkPlay } = require("../lavalink/index");
const Log = require("../logs/log");
const djProposals = require("./proposals");
const djStore = require("./store");
const { buildProposalEmbed, disableComponents } = require("./ui");

async function handleProposalInteraction(interaction) {
  const parts = interaction.customId.split("|");
  if (parts.length < 5) {
    await interaction.reply({ content: "Invalid DJ action.", ephemeral: true });
    return;
  }

  const [, type, guildId, proposalId, action] = parts;
  if (guildId !== interaction.guildId || type !== "proposal") {
    await interaction.reply({ content: "This action no longer applies.", ephemeral: true });
    return;
  }

  const config = djStore.getGuildConfig(guildId);
  if (!djStore.hasDjPermissions(interaction.member, config)) {
    const mention = djStore.getDjRoleMention(config);
    await interaction.reply({ content: "Only " + mention + " can manage suggestions.", ephemeral: true });
    return;
  }

  const proposal = djProposals.getProposal(guildId, proposalId);
  if (!proposal) {
    await interaction.reply({ content: "This suggestion has already been handled.", ephemeral: true });
    return;
  }

  const channel = proposal.channelId
    ? await interaction.client.channels.fetch(proposal.channelId).catch(() => null)
    : interaction.channel;

  let message = null;
  if (channel && proposal.messageId) {
    message = await channel.messages.fetch(proposal.messageId).catch(() => null);
  }

  const updateMessage = async (statusLabel) => {
    if (!message) return;

    const embed = buildProposalEmbed(proposal, { statusLabel });
    const disabled = disableComponents(message.components);

    await message.edit({ embeds: [embed], components: disabled }).catch(() => null);
  };

  if (action === "approve") {
    try {
      // Verify the voice channel is still valid, or use DJ's current voice channel
      let voiceChannelId = proposal.voiceChannelId;

      // Check if original voice channel still exists and has members
      const originalVoiceChannel = await interaction.client.channels.fetch(voiceChannelId).catch(() => null);

      // If original channel doesn't exist or DJ is in a different channel, use DJ's channel
      const djVoiceChannel = interaction.member.voice?.channel;

      if (!originalVoiceChannel || (djVoiceChannel && djVoiceChannel.id !== voiceChannelId)) {
        if (djVoiceChannel) {
          voiceChannelId = djVoiceChannel.id;
        } else if (!originalVoiceChannel) {
          await interaction.reply({
            content: "The original voice channel is no longer available. Please join a voice channel first.",
            ephemeral: true,
          });
          return;
        }
      }

      await lavalinkPlay({
        guildId,
        voiceId: voiceChannelId,
        textId: proposal.textChannelId ?? interaction.channelId,
        query: proposal.query,
        requester: proposal.requester,
        prepend: proposal.prepend,
      });

      djProposals.resolveProposal(guildId, proposalId, "approved");
      const statusLabel = `Approved by ${interaction.member.displayName}`;
      await updateMessage(statusLabel);
      await interaction.reply({ content: "Suggestion approved.", ephemeral: true });
    } catch (error) {
      Log.error("Failed to approve suggestion", error, "guild=" + guildId, "proposal=" + proposalId);
      await interaction.reply({
        content: "Failed to queue the suggestion: " + (error?.message ?? "Unknown error"),
        ephemeral: true,
      });
    }

    return;
  }

  if (action === "reject") {
    djProposals.resolveProposal(guildId, proposalId, "rejected");
    const statusLabel = `Rejected by ${interaction.member.displayName}`;
    await updateMessage(statusLabel);
    await interaction.reply({ content: "Suggestion rejected.", ephemeral: true });
    return;
  }

  await interaction.reply({ content: "Unknown DJ action.", ephemeral: true });
}

module.exports = {
  handleProposalInteraction,
};
