const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const Log = require("../helpers/logs/log");

module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    if (member.user.bot) return;

    try {
      const logsCommand = require("../commands/utility/logs");
      const config = logsCommand.getGuildLogsConfig(member.guild.id);

      if (!config?.enabled || !config?.categories?.server || !config?.channels?.server) return;

      const channel = await member.guild.channels.fetch(config.channels.server).catch(() => null);
      if (!channel) return;

      // Calculate how long they were in the server
      const joinedAt = member.joinedTimestamp;
      let timeInServer = "Unknown";
      if (joinedAt) {
        const duration = Date.now() - joinedAt;
        const days = Math.floor(duration / (1000 * 60 * 60 * 24));
        const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        timeInServer = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
      }

      // Try to determine if it was a kick
      let wasKicked = false;
      let kickedBy = null;
      let kickReason = null;

      try {
        const auditLogs = await member.guild.fetchAuditLogs({
          type: AuditLogEvent.MemberKick,
          limit: 1,
        });
        const kickLog = auditLogs.entries.first();
        if (kickLog && kickLog.target?.id === member.id && Date.now() - kickLog.createdTimestamp < 5000) {
          wasKicked = true;
          kickedBy = kickLog.executor;
          kickReason = kickLog.reason;
        }
      } catch {
        // No permission to view audit logs
      }

      const embed = new EmbedBuilder()
        .setColor(wasKicked ? 0xed4245 : 0xfee75c)
        .setAuthor({
          name: member.user.tag,
          iconURL: member.user.displayAvatarURL(),
        })
        .setTitle(wasKicked ? "👢 Member Kicked" : "👋 Member Left")
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "Member", value: `<@${member.id}>`, inline: true },
          { name: "Time in Server", value: timeInServer, inline: true },
          { name: "Member Count", value: `${member.guild.memberCount}`, inline: true }
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

      if (joinedAt) {
        embed.addFields({
          name: "Joined",
          value: `<t:${Math.floor(joinedAt / 1000)}:R>`,
          inline: true,
        });
      }

      if (member.roles.cache.size > 1) {
        const roles = member.roles.cache
          .filter((r) => r.id !== member.guild.id)
          .map((r) => `<@&${r.id}>`)
          .slice(0, 10)
          .join(", ");
        if (roles) {
          embed.addFields({ name: "Roles", value: roles, inline: false });
        }
      }

      if (wasKicked) {
        if (kickedBy) {
          embed.addFields({ name: "Kicked By", value: `<@${kickedBy.id}>`, inline: true });
        }
        if (kickReason) {
          embed.addFields({ name: "Reason", value: kickReason, inline: true });
        }
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      Log.error("Failed to log member remove", error);
    }
  },
};
