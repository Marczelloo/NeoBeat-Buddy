const { EmbedBuilder } = require("discord.js");
const Log = require("../helpers/logs/log");

module.exports = {
  name: "messageUpdate",
  async execute(oldMessage, newMessage) {
    // Handle partial messages - try to fetch if needed
    if (newMessage.partial) {
      try {
        await newMessage.fetch();
      } catch {
        return; // Can't fetch, skip logging
      }
    }

    // Ignore DMs, bot messages, and non-content changes (e.g., embed updates)
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    if (!oldMessage.content && !newMessage.content) return;

    try {
      const logsCommand = require("../commands/utility/logs");
      const config = logsCommand.getGuildLogsConfig(newMessage.guild.id);

      if (!config?.enabled || !config?.categories?.message || !config?.channels?.message) return;

      const channel = await newMessage.guild.channels.fetch(config.channels.message).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setAuthor({
          name: newMessage.author?.tag || "Unknown User",
          iconURL: newMessage.author?.displayAvatarURL() || undefined,
        })
        .setTitle("✏️ Message Edited")
        .addFields(
          { name: "Channel", value: `<#${newMessage.channel.id}>`, inline: true },
          { name: "Author", value: newMessage.author ? `<@${newMessage.author.id}>` : "Unknown", inline: true },
          { name: "Jump to Message", value: `[Click here](${newMessage.url})`, inline: true }
        )
        .setFooter({ text: `Message ID: ${newMessage.id}` })
        .setTimestamp();

      // Handle old content
      const oldContent = oldMessage.content || "*Content not cached*";
      const newContent = newMessage.content || "*Empty*";

      embed.addFields(
        { name: "Before", value: oldContent.slice(0, 1024), inline: false },
        { name: "After", value: newContent.slice(0, 1024), inline: false }
      );

      await channel.send({ embeds: [embed] });
    } catch (error) {
      Log.error("Failed to log message update", error);
    }
  },
};
