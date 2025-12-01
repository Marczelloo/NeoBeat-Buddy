const { EmbedBuilder } = require("discord.js");
const Log = require("../helpers/logs/log");

module.exports = {
  name: "guildMemberAdd",
  async execute(member) {
    if (member.user.bot) return;

    try {
      const logsCommand = require("../commands/utility/logs");
      const config = logsCommand.getGuildLogsConfig(member.guild.id);

      if (!config?.enabled || !config?.categories?.server || !config?.channels?.server) return;

      const channel = await member.guild.channels.fetch(config.channels.server).catch(() => null);
      if (!channel) return;

      const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
      const isNewAccount = accountAge < 7;

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setAuthor({
          name: member.user.tag,
          iconURL: member.user.displayAvatarURL(),
        })
        .setTitle("👋 Member Joined")
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "Member", value: `<@${member.id}>`, inline: true },
          { name: "Account Age", value: `${accountAge} days${isNewAccount ? " ⚠️" : ""}`, inline: true },
          { name: "Member Count", value: `${member.guild.memberCount}`, inline: true },
          { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

      if (isNewAccount) {
        embed.setDescription("⚠️ **New Account Warning:** This account is less than 7 days old.");
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      Log.error("Failed to log member join", error);
    }
  },
};
