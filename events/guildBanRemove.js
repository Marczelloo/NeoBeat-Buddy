const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const Log = require("../helpers/logs/log");

module.exports = {
  name: "guildBanRemove",
  async execute(ban) {
    try {
      const logsCommand = require("../commands/utility/logs");
      const config = logsCommand.getGuildLogsConfig(ban.guild.id);

      if (!config?.enabled || !config?.categories?.server || !config?.channels?.server) return;

      const channel = await ban.guild.channels.fetch(config.channels.server).catch(() => null);
      if (!channel) return;

      // Try to get unban details from audit log
      let executor = null;

      try {
        const auditLogs = await ban.guild.fetchAuditLogs({
          type: AuditLogEvent.MemberBanRemove,
          limit: 1,
        });
        const unbanLog = auditLogs.entries.first();
        if (unbanLog && unbanLog.target?.id === ban.user.id && Date.now() - unbanLog.createdTimestamp < 5000) {
          executor = unbanLog.executor;
        }
      } catch {
        // No permission
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setAuthor({
          name: ban.user.tag,
          iconURL: ban.user.displayAvatarURL(),
        })
        .setTitle("🔓 Member Unbanned")
        .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
        .addFields({ name: "User", value: `<@${ban.user.id}>`, inline: true })
        .setFooter({ text: `User ID: ${ban.user.id}` })
        .setTimestamp();

      if (executor) {
        embed.addFields({ name: "Unbanned By", value: `<@${executor.id}>`, inline: true });
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      Log.error("Failed to log ban remove", error);
    }
  },
};
