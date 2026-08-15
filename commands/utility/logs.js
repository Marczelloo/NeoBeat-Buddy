const fs = require("node:fs/promises");
const path = require("node:path");
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require("discord.js");
const Log = require("../../helpers/logs/log");

const DATA_FILE = path.join(__dirname, "../../helpers/data/serverLogs.json");

// In-memory cache
let logsConfig = {};

// Load config from file
async function loadConfig() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    logsConfig = JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") {
      Log.error("Failed to load server logs config", err);
    }
    logsConfig = {};
  }
}

// Save config to file
async function saveConfig() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(logsConfig, null, 2), "utf-8");
  } catch (err) {
    Log.error("Failed to save server logs config", err);
  }
}

// Get guild config
function getGuildLogsConfig(guildId) {
  return logsConfig[guildId] || null;
}

// Update guild config
async function updateGuildLogsConfig(guildId, config) {
  logsConfig[guildId] = { ...logsConfig[guildId], ...config };
  await saveConfig();
}

// Initialize on module load
loadConfig();

const LOG_CATEGORIES = {
  message: {
    name: "Message Logs",
    emoji: "💬",
    channelName: "message-logs",
    description: "Logs all message edits and deletions",
  },
  voice: {
    name: "Voice Logs",
    emoji: "🔊",
    channelName: "voice-logs",
    description: "Logs voice channel activity (join, leave, move, mute, deafen)",
  },
  server: {
    name: "Server Logs",
    emoji: "📋",
    channelName: "server-logs",
    description: "Logs server events (member join/leave, role changes, nickname changes)",
  },
  bot: {
    name: "Bot Logs",
    emoji: "🤖",
    channelName: "bot-logs",
    description: "Logs bot command usage and responses",
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("logs")
    .setDescription("Configure automatic server logging")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set up logging channels (creates category and channels automatically)")
        .addRoleOption((option) =>
          option
            .setName("access-role")
            .setDescription("Role that can view log channels (in addition to admins)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("enable")
        .setDescription("Enable a specific log category")
        .addStringOption((option) =>
          option
            .setName("category")
            .setDescription("Log category to enable")
            .setRequired(true)
            .addChoices(
              { name: "💬 Message Logs", value: "message" },
              { name: "🔊 Voice Logs", value: "voice" },
              { name: "📋 Server Logs", value: "server" },
              { name: "🤖 Bot Logs", value: "bot" },
              { name: "📊 All Categories", value: "all" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Disable a specific log category")
        .addStringOption((option) =>
          option
            .setName("category")
            .setDescription("Log category to disable")
            .setRequired(true)
            .addChoices(
              { name: "💬 Message Logs", value: "message" },
              { name: "🔊 Voice Logs", value: "voice" },
              { name: "📋 Server Logs", value: "server" },
              { name: "🤖 Bot Logs", value: "bot" },
              { name: "📊 All Categories", value: "all" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("access")
        .setDescription("Grant or revoke log channel access for a role")
        .addRoleOption((option) =>
          option.setName("role").setDescription("Role to grant/revoke access").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("Grant or revoke access")
            .setRequired(true)
            .addChoices({ name: "✅ Grant Access", value: "grant" }, { name: "❌ Revoke Access", value: "revoke" })
        )
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("View current logging configuration"))
    .addSubcommand((sub) => sub.setName("delete").setDescription("Delete all logging channels and disable logging")),

  // Export for use in event handlers
  getGuildLogsConfig,
  updateGuildLogsConfig,
  LOG_CATEGORIES,
  loadConfig,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "setup":
        return handleSetup(interaction);
      case "enable":
        return handleEnable(interaction);
      case "disable":
        return handleDisable(interaction);
      case "access":
        return handleAccess(interaction);
      case "status":
        return handleStatus(interaction);
      case "delete":
        return handleDelete(interaction);
      default:
        return interaction.reply({ content: "❌ Unknown subcommand.", ephemeral: true });
    }
  },
};

async function handleSetup(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const accessRole = interaction.options.getRole("access-role");
  const botMember = guild.members.me;

  try {
    // Create category with restricted permissions
    const categoryPermissions = [
      {
        id: guild.id, // @everyone
        deny: ["ViewChannel"],
      },
      {
        id: botMember.id, // Bot
        allow: ["ViewChannel", "SendMessages", "EmbedLinks", "AttachFiles", "ReadMessageHistory"],
      },
    ];

    // Add access role if provided
    if (accessRole) {
      categoryPermissions.push({
        id: accessRole.id,
        allow: ["ViewChannel", "ReadMessageHistory"],
        deny: ["SendMessages", "AddReactions"],
      });
    }

    // Create category
    const category = await guild.channels.create({
      name: "📊 Server Logs",
      type: ChannelType.GuildCategory,
      permissionOverwrites: categoryPermissions,
    });

    // Create channels for each category
    const channels = {};
    for (const [key, config] of Object.entries(LOG_CATEGORIES)) {
      const channel = await guild.channels.create({
        name: `${config.emoji}｜${config.channelName}`,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: config.description,
        permissionOverwrites: categoryPermissions,
      });
      channels[key] = channel.id;
    }

    // Save configuration
    await updateGuildLogsConfig(guild.id, {
      enabled: true,
      categoryId: category.id,
      channels,
      accessRoles: accessRole ? [accessRole.id] : [],
      categories: {
        message: true,
        voice: true,
        server: true,
        bot: true,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("✅ Logging System Setup Complete")
      .setDescription("All logging channels have been created and configured.")
      .addFields(
        { name: "📁 Category", value: `<#${category.id}>`, inline: true },
        { name: "🔒 Access", value: accessRole ? `<@&${accessRole.id}> + Admins` : "Admins only", inline: true },
        { name: "\u200b", value: "\u200b", inline: true },
        ...Object.entries(LOG_CATEGORIES).map(([key, config]) => ({
          name: `${config.emoji} ${config.name}`,
          value: `<#${channels[key]}>\n${config.description}`,
          inline: true,
        }))
      )
      .setFooter({ text: "All categories are enabled by default. Use /logs disable to turn off specific categories." })
      .setTimestamp();

    Log.info(`Logging system set up in ${guild.name} by ${interaction.user.tag}`, "logs", guild.id);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Log.error("Failed to set up logging system", error);
    await interaction.editReply({
      content: `❌ Failed to set up logging: ${error.message}\n\nMake sure the bot has **Manage Channels** permission.`,
    });
  }
}

async function handleEnable(interaction) {
  const guild = interaction.guild;
  const category = interaction.options.getString("category");
  const config = getGuildLogsConfig(guild.id);

  if (!config || !config.channels) {
    return interaction.reply({
      content: "❌ Logging is not set up. Use `/logs setup` first.",
      ephemeral: true,
    });
  }

  if (category === "all") {
    config.categories = { message: true, voice: true, server: true, bot: true };
    config.enabled = true;
  } else {
    config.categories[category] = true;
    config.enabled = true;
  }

  await updateGuildLogsConfig(guild.id, config);

  const categoryName = category === "all" ? "All categories" : LOG_CATEGORIES[category].name;

  await interaction.reply({
    content: `✅ **${categoryName}** logging enabled!`,
    ephemeral: true,
  });
}

async function handleDisable(interaction) {
  const guild = interaction.guild;
  const category = interaction.options.getString("category");
  const config = getGuildLogsConfig(guild.id);

  if (!config || !config.channels) {
    return interaction.reply({
      content: "❌ Logging is not set up. Use `/logs setup` first.",
      ephemeral: true,
    });
  }

  if (category === "all") {
    config.categories = { message: false, voice: false, server: false, bot: false };
    config.enabled = false;
  } else {
    config.categories[category] = false;
    // Check if all categories are disabled
    const anyEnabled = Object.values(config.categories).some((v) => v);
    if (!anyEnabled) config.enabled = false;
  }

  await updateGuildLogsConfig(guild.id, config);

  const categoryName = category === "all" ? "All categories" : LOG_CATEGORIES[category].name;

  await interaction.reply({
    content: `✅ **${categoryName}** logging disabled.`,
    ephemeral: true,
  });
}

async function handleAccess(interaction) {
  const guild = interaction.guild;
  const role = interaction.options.getRole("role");
  const action = interaction.options.getString("action");
  const config = getGuildLogsConfig(guild.id);

  if (!config || !config.categoryId) {
    return interaction.reply({
      content: "❌ Logging is not set up. Use `/logs setup` first.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const category = await guild.channels.fetch(config.categoryId);
    if (!category) {
      return interaction.editReply({ content: "❌ Log category not found. Please run `/logs setup` again." });
    }

    // Update permissions for category and all child channels
    const permissionUpdate =
      action === "grant"
        ? { ViewChannel: true, ReadMessageHistory: true, SendMessages: false, AddReactions: false }
        : { ViewChannel: false };

    await category.permissionOverwrites.edit(role.id, permissionUpdate);

    // Update child channels
    for (const channelId of Object.values(config.channels)) {
      try {
        const channel = await guild.channels.fetch(channelId);
        if (channel) {
          await channel.permissionOverwrites.edit(role.id, permissionUpdate);
        }
      } catch {
        // Channel might be deleted
      }
    }

    // Update stored access roles
    if (!config.accessRoles) config.accessRoles = [];
    if (action === "grant") {
      if (!config.accessRoles.includes(role.id)) {
        config.accessRoles.push(role.id);
      }
    } else {
      config.accessRoles = config.accessRoles.filter((id) => id !== role.id);
    }

    await updateGuildLogsConfig(guild.id, config);

    await interaction.editReply({
      content: `✅ ${action === "grant" ? "Granted" : "Revoked"} log access for <@&${role.id}>`,
    });
  } catch (error) {
    Log.error("Failed to update log access", error);
    await interaction.editReply({ content: `❌ Failed to update access: ${error.message}` });
  }
}

async function handleStatus(interaction) {
  const guild = interaction.guild;
  const config = getGuildLogsConfig(guild.id);

  if (!config || !config.channels) {
    return interaction.reply({
      content: "❌ Logging is not set up for this server. Use `/logs setup` to configure.",
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(config.enabled ? 0x5865f2 : 0x99aab5)
    .setTitle("📊 Server Logging Status")
    .addFields(
      {
        name: "Overall Status",
        value: config.enabled ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      },
      {
        name: "Category",
        value: config.categoryId ? `<#${config.categoryId}>` : "Not found",
        inline: true,
      },
      {
        name: "Access Roles",
        value:
          config.accessRoles && config.accessRoles.length > 0
            ? config.accessRoles.map((id) => `<@&${id}>`).join(", ")
            : "Admins only",
        inline: true,
      }
    );

  // Add category status
  const categoryStatus = Object.entries(LOG_CATEGORIES)
    .map(([key, cat]) => {
      const enabled = config.categories?.[key] ?? false;
      const channelId = config.channels?.[key];
      return `${enabled ? "✅" : "❌"} ${cat.emoji} **${cat.name}**${channelId ? ` → <#${channelId}>` : ""}`;
    })
    .join("\n");

  embed.addFields({ name: "Log Categories", value: categoryStatus, inline: false });
  embed.setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDelete(interaction) {
  const guild = interaction.guild;
  const config = getGuildLogsConfig(guild.id);

  if (!config || !config.categoryId) {
    return interaction.reply({
      content: "❌ Logging is not set up for this server.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Delete all log channels
    for (const channelId of Object.values(config.channels || {})) {
      try {
        const channel = await guild.channels.fetch(channelId);
        if (channel) await channel.delete("Logging system removed");
      } catch {
        // Channel might already be deleted
      }
    }

    // Delete category
    try {
      const category = await guild.channels.fetch(config.categoryId);
      if (category) await category.delete("Logging system removed");
    } catch {
      // Category might already be deleted
    }

    // Clear config
    delete logsConfig[guild.id];
    await saveConfig();

    Log.info(`Logging system removed in ${guild.name} by ${interaction.user.tag}`, "logs", guild.id);

    await interaction.editReply({
      content: "✅ Logging system has been completely removed. All log channels have been deleted.",
    });
  } catch (error) {
    Log.error("Failed to delete logging system", error);
    await interaction.editReply({ content: `❌ Failed to delete logging system: ${error.message}` });
  }
}
