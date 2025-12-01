const { EmbedBuilder } = require("discord.js");
const Log = require("../helpers/logs/log");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    // Ignore DMs and bot messages
    if (!message.guild || message.author.bot) return;

    try {
      const logsCommand = require("../commands/utility/logs");
      const config = logsCommand.getGuildLogsConfig(message.guild.id);

      if (!config?.enabled || !config?.categories?.message || !config?.channels?.message) return;

      const channel = await message.guild.channels.fetch(config.channels.message).catch(() => null);
      if (!channel) return;

      // Don't log messages in log channels themselves
      if (Object.values(config.channels).includes(message.channel.id)) return;

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTitle("💬 Message Sent")
        .addFields(
          { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
          { name: "Author", value: `<@${message.author.id}>`, inline: true },
          { name: "Jump to Message", value: `[Click here](${message.url})`, inline: true }
        )
        .setFooter({ text: `Message ID: ${message.id}` })
        .setTimestamp();

      // Add content if present
      if (message.content) {
        embed.setDescription(message.content.slice(0, 4000));
      }

      // Add attachments info
      if (message.attachments.size > 0) {
        const attachmentList = message.attachments.map((a) => `[${a.name}](${a.url})`).join("\n");
        embed.addFields({
          name: `📎 Attachments (${message.attachments.size})`,
          value: attachmentList.slice(0, 1024),
          inline: false,
        });
      }

      // Add stickers info
      if (message.stickers.size > 0) {
        const stickerList = message.stickers.map((s) => s.name).join(", ");
        embed.addFields({
          name: "🎨 Stickers",
          value: stickerList.slice(0, 1024),
          inline: false,
        });
      }

      // Add reply info
      if (message.reference?.messageId) {
        embed.addFields({
          name: "↩️ Reply To",
          value: `[Original Message](https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.reference.messageId})`,
          inline: false,
        });
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      Log.error("Failed to log message create", error);
    }
  },
};
