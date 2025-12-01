const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const Log = require("../helpers/logs/log");

module.exports = {
  name: "guildBanAdd",
  async execute(ban) {
    try {
      const logsCommand = require("../commands/utility/logs");
      const config = logsCommand.getGuildLogsConfig(ban.guild.id);

      if (!config?.enabled || !config?.categories?.server || !config?.channels?.server) return;

      const channel = await ban.guild.channels.fetch(config.channels.server).catch(() => null);
      if (!channel) return;

      // Try to get ban details from audit log
      let executor = null;
      let reason = ban.reason;

      try {
        const auditLogs = await ban.guild.fetchAuditLogs({
          type: AuditLogEvent.MemberBanAdd,
          limit: 1,
        });
        const banLog = auditLogs.entries.first();
        if (banLog && banLog.target?.id === ban.user.id && Date.now() - banLog.createdTimestamp < 5000) {
          executor = banLog.executor;
          reason = banLog.reason || reason;
        }
      } catch {
        // No permission
      }

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setAuthor({
          name: ban.user.tag,
          iconURL: ban.user.displayAvatarURL(),
        })
        .setTitle("🔨 Member Banned")
        .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
        .addFields({ name: "User", value: `<@${ban.user.id}>`, inline: true })
        .setFooter({ text: `User ID: ${ban.user.id}` })
        .setTimestamp();

      if (executor) {
        embed.addFields({ name: "Banned By", value: `<@${executor.id}>`, inline: true });
      }

      if (reason) {
        embed.addFields({ name: "Reason", value: reason, inline: false });
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      Log.error("Failed to log ban add", error);
    }
  },
};
