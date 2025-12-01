const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const Log = require("../helpers/logs/log");

module.exports = {
  name: "guildMemberUpdate",
  async execute(oldMember, newMember) {
    if (newMember.user.bot) return;

    try {
      const logsCommand = require("../commands/utility/logs");
      const config = logsCommand.getGuildLogsConfig(newMember.guild.id);

      if (!config?.enabled || !config?.categories?.server || !config?.channels?.server) return;

      const channel = await newMember.guild.channels.fetch(config.channels.server).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setAuthor({
          name: newMember.user.tag,
          iconURL: newMember.user.displayAvatarURL(),
        })
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();

      let shouldSend = false;

      // Nickname change
      if (oldMember.nickname !== newMember.nickname) {
        shouldSend = true;
        embed
          .setColor(0x5865f2)
          .setTitle("📝 Nickname Changed")
          .addFields(
            { name: "Member", value: `<@${newMember.id}>`, inline: true },
            { name: "Before", value: oldMember.nickname || "*None*", inline: true },
            { name: "After", value: newMember.nickname || "*None*", inline: true }
          );
      }
      // Role changes
      else if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        shouldSend = true;
        const addedRoles = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
        const removedRoles = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));

        if (addedRoles.size > 0) {
          embed
            .setColor(0x57f287)
            .setTitle("➕ Role Added")
            .addFields(
              { name: "Member", value: `<@${newMember.id}>`, inline: true },
              { name: "Role", value: addedRoles.map((r) => `<@&${r.id}>`).join(", "), inline: true }
            );

          // Try to get who added the role
          try {
            const auditLogs = await newMember.guild.fetchAuditLogs({
              type: AuditLogEvent.MemberRoleUpdate,
              limit: 1,
            });
            const roleLog = auditLogs.entries.first();
            if (roleLog && roleLog.target?.id === newMember.id && Date.now() - roleLog.createdTimestamp < 5000) {
              embed.addFields({ name: "Added By", value: `<@${roleLog.executor.id}>`, inline: true });
            }
          } catch {
            // No permission
          }
        } else if (removedRoles.size > 0) {
          embed
            .setColor(0xed4245)
            .setTitle("➖ Role Removed")
            .addFields(
              { name: "Member", value: `<@${newMember.id}>`, inline: true },
              { name: "Role", value: removedRoles.map((r) => `<@&${r.id}>`).join(", "), inline: true }
            );

          // Try to get who removed the role
          try {
            const auditLogs = await newMember.guild.fetchAuditLogs({
              type: AuditLogEvent.MemberRoleUpdate,
              limit: 1,
            });
            const roleLog = auditLogs.entries.first();
            if (roleLog && roleLog.target?.id === newMember.id && Date.now() - roleLog.createdTimestamp < 5000) {
              embed.addFields({ name: "Removed By", value: `<@${roleLog.executor.id}>`, inline: true });
            }
          } catch {
            // No permission
          }
        }
      }
      // Timeout
      else if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
        shouldSend = true;
        if (newMember.communicationDisabledUntilTimestamp) {
          embed
            .setColor(0xed4245)
            .setTitle("⏱️ Member Timed Out")
            .addFields(
              { name: "Member", value: `<@${newMember.id}>`, inline: true },
              {
                name: "Until",
                value: `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:R>`,
                inline: true,
              }
            );
        } else {
          embed
            .setColor(0x57f287)
            .setTitle("⏱️ Timeout Removed")
            .addFields({ name: "Member", value: `<@${newMember.id}>`, inline: true });
        }
      }
      // Avatar change (server-specific)
      else if (oldMember.avatar !== newMember.avatar) {
        shouldSend = true;
        embed
          .setColor(0x5865f2)
          .setTitle("🖼️ Server Avatar Changed")
          .addFields({ name: "Member", value: `<@${newMember.id}>`, inline: true })
          .setThumbnail(newMember.displayAvatarURL({ size: 256 }));
      }

      if (shouldSend) {
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      Log.error("Failed to log member update", error);
    }
  },
};
