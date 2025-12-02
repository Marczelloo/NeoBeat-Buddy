const { EmbedBuilder } = require("discord.js");
const Log = require("../helpers/logs/log");

module.exports = {
  name: "voiceStateUpdate",
  async execute(oldState, newState) {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    // Ignore bots
    const member = newState.member || oldState.member;
    if (member?.user?.bot) return;

    try {
      const logsCommand = require("../commands/utility/logs");
      const config = logsCommand.getGuildLogsConfig(guild.id);

      if (!config?.enabled || !config?.categories?.voice || !config?.channels?.voice) return;

      const channel = await guild.channels.fetch(config.channels.voice).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setAuthor({
          name: member?.user?.tag || "Unknown User",
          iconURL: member?.user?.displayAvatarURL() || undefined,
        })
        .setFooter({ text: `User ID: ${member?.id || "Unknown"}` })
        .setTimestamp();

      let action = null;

      // Join
      if (!oldState.channel && newState.channel) {
        action = "join";
        embed
          .setColor(0x57f287)
          .setTitle("🎤 Joined Voice Channel")
          .addFields(
            { name: "Member", value: `<@${member.id}>`, inline: true },
            { name: "Channel", value: `<#${newState.channel.id}>`, inline: true }
          );
      }
      // Leave
      else if (oldState.channel && !newState.channel) {
        action = "leave";
        embed
          .setColor(0xed4245)
          .setTitle("🚪 Left Voice Channel")
          .addFields(
            { name: "Member", value: `<@${member.id}>`, inline: true },
            { name: "Channel", value: `<#${oldState.channel.id}>`, inline: true }
          );
      }
      // Move
      else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        action = "move";
        embed
          .setColor(0x5865f2)
          .setTitle("🔀 Moved Voice Channels")
          .addFields(
            { name: "Member", value: `<@${member.id}>`, inline: true },
            { name: "From", value: `<#${oldState.channel.id}>`, inline: true },
            { name: "To", value: `<#${newState.channel.id}>`, inline: true }
          );
      }
      // Mute/Unmute (server mute)
      else if (oldState.serverMute !== newState.serverMute) {
        action = "mute";
        embed
          .setColor(newState.serverMute ? 0xed4245 : 0x57f287)
          .setTitle(newState.serverMute ? "🔇 Server Muted" : "🔊 Server Unmuted")
          .addFields(
            { name: "Member", value: `<@${member.id}>`, inline: true },
            { name: "Channel", value: `<#${newState.channel?.id || oldState.channel?.id}>`, inline: true }
          );
      }
      // Deafen/Undeafen (server deafen)
      else if (oldState.serverDeaf !== newState.serverDeaf) {
        action = "deafen";
        embed
          .setColor(newState.serverDeaf ? 0xed4245 : 0x57f287)
          .setTitle(newState.serverDeaf ? "🔕 Server Deafened" : "🔔 Server Undeafened")
          .addFields(
            { name: "Member", value: `<@${member.id}>`, inline: true },
            { name: "Channel", value: `<#${newState.channel?.id || oldState.channel?.id}>`, inline: true }
          );
      }
      // Stream start/stop
      else if (oldState.streaming !== newState.streaming) {
        action = "stream";
        embed
          .setColor(newState.streaming ? 0xeb459e : 0x99aab5)
          .setTitle(newState.streaming ? "📺 Started Streaming" : "📺 Stopped Streaming")
          .addFields(
            { name: "Member", value: `<@${member.id}>`, inline: true },
            { name: "Channel", value: `<#${newState.channel?.id}>`, inline: true }
          );
      }
      // Camera on/off
      else if (oldState.selfVideo !== newState.selfVideo) {
        action = "camera";
        embed
          .setColor(newState.selfVideo ? 0x57f287 : 0x99aab5)
          .setTitle(newState.selfVideo ? "📹 Camera On" : "📹 Camera Off")
          .addFields(
            { name: "Member", value: `<@${member.id}>`, inline: true },
            { name: "Channel", value: `<#${newState.channel?.id}>`, inline: true }
          );
      }

      // Only send if there was an action
      if (action) {
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      Log.error("Failed to log voice state update", error);
    }
  },
};
