const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const announcer = require("../../helpers/announcements/announcer");
const { updateGuildState, getGuildState } = require("../../helpers/guildState");
const userPrefs = require("../../helpers/users/preferences");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure bot settings for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((group) =>
      group
        .setName("announcements")
        .setDescription("Configure update announcements")
        .addSubcommand((sub) =>
          sub
            .setName("channel")
            .setDescription("Set the channel for update announcements")
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("Channel to send announcements to")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true)
            )
        )
        .addSubcommand((sub) => sub.setName("enable").setDescription("Enable update announcements for this server"))
        .addSubcommand((sub) => sub.setName("disable").setDescription("Disable update announcements for this server"))
        .addSubcommand((sub) => sub.setName("status").setDescription("View current announcement settings"))
        .addSubcommand((sub) =>
          sub.setName("reset").setDescription("Reset announcement state (for testing - will resend announcement)")
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("source")
        .setDescription("Configure default music search source")
        .addSubcommand((sub) =>
          sub
            .setName("server")
            .setDescription("Set the default search source for this server")
            .addStringOption((option) =>
              option
                .setName("source")
                .setDescription("Default music search source for the server")
                .setRequired(true)
                .addChoices(
                  { name: "🎼 Deezer (FLAC Quality)", value: "deezer" },
                  { name: "▶️ YouTube", value: "youtube" },
                  { name: "🎧 Spotify", value: "spotify" }
                )
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("me")
            .setDescription("Set your personal default search source (overrides server default)")
            .addStringOption((option) =>
              option
                .setName("source")
                .setDescription("Your personal default music search source")
                .setRequired(true)
                .addChoices(
                  { name: "🌐 Use Server Default", value: "server" },
                  { name: "🎼 Deezer (FLAC Quality)", value: "deezer" },
                  { name: "▶️ YouTube", value: "youtube" },
                  { name: "🎧 Spotify", value: "spotify" }
                )
            )
        )
        .addSubcommand((sub) => sub.setName("status").setDescription("View current search source settings"))
    ),

  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === "announcements") {
      return handleAnnouncements(interaction, subcommand);
    }

    if (subcommandGroup === "source") {
      return handleSource(interaction, subcommand);
    }

    await interaction.reply({
      content: "❌ Unknown setup command.",
      ephemeral: true,
    });
  },
};

async function handleAnnouncements(interaction, subcommand) {
  const guildId = interaction.guild.id;
  const state = getGuildState(guildId);

  switch (subcommand) {
    case "channel": {
      const channel = interaction.options.getChannel("channel");

      updateGuildState(guildId, {
        announcementChannel: channel.id,
      });

      await interaction.reply({
        content: `✅ Update announcements will now be sent to ${channel}. Checking for pending announcements...`,
        ephemeral: true,
      });

      // Try to send announcement immediately if there's a new version
      const wasSent = await announcer.sendAnnouncement(interaction.client, guildId, channel.id);

      if (wasSent) {
        await interaction.followUp({
          content: `📢 Sent version announcement to ${channel}!`,
          ephemeral: true,
        });
      }

      return;
    }

    case "enable": {
      updateGuildState(guildId, {
        announcementsEnabled: true,
      });

      const channelId = state?.announcementChannel;
      const channelInfo = channelId
        ? ` to <#${channelId}>`
        : " (no channel set - use `/setup announcements channel` first)";

      return interaction.reply({
        content: `✅ Update announcements enabled${channelInfo}`,
        ephemeral: true,
      });
    }

    case "disable": {
      updateGuildState(guildId, {
        announcementsEnabled: false,
      });

      return interaction.reply({
        content: "✅ Update announcements disabled for this server",
        ephemeral: true,
      });
    }

    case "status": {
      const { EmbedBuilder } = require("discord.js");
      const enabled = state?.announcementsEnabled !== false;
      const channelId = state?.announcementChannel;
      const lastVersion = state?.lastAnnouncedVersion || "None";
      const currentVersion = announcer.getCurrentVersion();

      const embed = new EmbedBuilder()
        .setColor(enabled ? 0x5865f2 : 0x99aab5)
        .setTitle("📢 Update Announcements Configuration")
        .addFields(
          {
            name: "Status",
            value: enabled ? "✅ Enabled" : "❌ Disabled",
            inline: true,
          },
          {
            name: "Channel",
            value: channelId ? `<#${channelId}>` : "❌ Not configured",
            inline: true,
          },
          {
            name: "Current Bot Version",
            value: `v${currentVersion}`,
            inline: true,
          },
          {
            name: "Last Announced Version",
            value: lastVersion === "None" ? "❌ None" : `v${lastVersion}`,
            inline: true,
          }
        )
        .setTimestamp();

      if (enabled && !channelId) {
        embed.setDescription(
          "⚠️ **Warning:** Announcements are enabled but no channel is configured.\nUse `/setup announcements channel` to set an announcement channel."
        );
      }

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    case "reset": {
      updateGuildState(guildId, {
        lastAnnouncedVersion: null,
      });

      const currentVersion = announcer.getCurrentVersion();

      return interaction.reply({
        content: `🔄 Announcement state reset! The current version (v${currentVersion}) will be announced again. Use \`/setup announcements channel\` to trigger it now, or it will be sent on next bot restart.`,
        ephemeral: true,
      });
    }

    default:
      return interaction.reply({
        content: "❌ Unknown announcement subcommand.",
        ephemeral: true,
      });
  }
}

async function handleSource(interaction, subcommand) {
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const state = getGuildState(guildId);

  const sourceNames = {
    deezer: "🎼 Deezer (FLAC Quality)",
    youtube: "▶️ YouTube",
    spotify: "🎧 Spotify",
    server: "🌐 Server Default",
  };

  switch (subcommand) {
    case "server": {
      const source = interaction.options.getString("source");

      updateGuildState(guildId, {
        defaultSource: source,
      });

      return interaction.reply({
        content: `✅ Server default search source set to **${sourceNames[source]}**\n\nThis will be used when no source is specified in \`/play\`. Users can override this with \`/setup source me\` or per-query.`,
        ephemeral: true,
      });
    }

    case "me": {
      const source = interaction.options.getString("source");

      if (source === "server") {
        userPrefs.setUserDefaultSource(userId, null);
        return interaction.reply({
          content: `✅ Your personal source preference has been **cleared**.\n\nYou will now use the server's default source.`,
          ephemeral: true,
        });
      }

      userPrefs.setUserDefaultSource(userId, source);

      return interaction.reply({
        content: `✅ Your personal default source set to **${sourceNames[source]}**\n\nThis overrides the server default. Use \`/setup source me\` with "Use Server Default" to clear.`,
        ephemeral: true,
      });
    }

    case "status": {
      const { EmbedBuilder } = require("discord.js");
      const serverSource = state?.defaultSource || "deezer";
      const userSource = userPrefs.getUserDefaultSource(userId);
      const effectiveSource = userSource || serverSource;

      const sourceDescriptions = {
        deezer: "🎼 **Deezer** - FLAC quality audio",
        youtube: "▶️ **YouTube** - Wide variety of content",
        spotify: "🎧 **Spotify** - High quality streaming",
      };

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎵 Music Search Source Configuration")
        .addFields(
          {
            name: "Server Default",
            value: sourceDescriptions[serverSource],
            inline: true,
          },
          {
            name: "Your Preference",
            value: userSource ? sourceDescriptions[userSource] : "🌐 Using server default",
            inline: true,
          },
          {
            name: "Effective Source",
            value: sourceDescriptions[effectiveSource],
            inline: false,
          },
          {
            name: "How it works",
            value:
              "• **Server default**: Used by all users who haven't set a personal preference\n• **Personal preference**: Overrides server default for you\n• **Per-query override**: Always takes priority (using source option in `/play`)",
            inline: false,
          }
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    // Legacy support for "default" subcommand
    case "default": {
      const source = interaction.options.getString("source");

      updateGuildState(guildId, {
        defaultSource: source,
      });

      return interaction.reply({
        content: `✅ Server default search source set to **${sourceNames[source]}**\n\nThis will be used when no source is specified in \`/play\`. Users can override this with \`/setup source me\` or per-query.`,
        ephemeral: true,
      });
    }

    default:
      return interaction.reply({
        content: "❌ Unknown source subcommand.",
        ephemeral: true,
      });
  }
}
