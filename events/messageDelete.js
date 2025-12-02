const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const Log = require("../helpers/logs/log");

module.exports = {
  name: "messageDelete",
  async execute(message) {
    // Handle partial messages
    if (message.partial) {
      try {
        // Can't fetch deleted messages, so we work with what we have
      } catch {
        return;
      }
    }

    // Ignore DMs and bot messages
    if (!message.guild || message.author?.bot) return;

    try {
      const logsCommand = require("../commands/utility/logs");
      const config = logsCommand.getGuildLogsConfig(message.guild.id);

      if (!config?.enabled || !config?.categories?.message || !config?.channels?.message) return;

      const channel = await message.guild.channels.fetch(config.channels.message).catch(() => null);
      if (!channel) return;

      // Try to get who deleted the message from audit logs
      let executor = null;
      try {
        const auditLogs = await message.guild.fetchAuditLogs({
          type: AuditLogEvent.MessageDelete,
          limit: 1,
        });
        const auditEntry = auditLogs.entries.first();
        if (
          auditEntry &&
          auditEntry.target?.id === message.author?.id &&
          Date.now() - auditEntry.createdTimestamp < 5000
        ) {
          executor = auditEntry.executor;
        }
      } catch {
        // No permission to view audit logs
      }

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setAuthor({
          name: message.author?.tag || "Unknown User",
          iconURL: message.author?.displayAvatarURL() || undefined,
        })
        .setTitle("🗑️ Message Deleted")
        .addFields(
          { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
          { name: "Author", value: message.author ? `<@${message.author.id}>` : "Unknown", inline: true }
        )
        .setFooter({ text: `Message ID: ${message.id}` })
        .setTimestamp();

      if (message.content) {
        embed.setDescription(message.content.slice(0, 4000));
      } else if (message.embeds?.length > 0) {
        embed.setDescription("*Message contained embeds*");
      } else if (message.attachments?.size > 0) {
        embed.setDescription("*Message contained attachments*");
      } else {
        embed.setDescription("*Message content not cached*");
      }

      if (executor && executor.id !== message.author?.id) {
        embed.addFields({ name: "Deleted By", value: `<@${executor.id}>`, inline: true });
      }

      if (message.attachments?.size > 0) {
        const attachmentList = message.attachments.map((a) => `[${a.name}](${a.url})`).join("\n");
        embed.addFields({
          name: "Attachments",
          value: attachmentList.slice(0, 1024),
          inline: false,
        });
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      Log.error("Failed to log message delete", error);
    }
  },
};
