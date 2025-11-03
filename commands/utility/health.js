const os = require("os");
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const health = require("../../helpers/monitoring/health");

const COLORS = {
  healthy: 0x00ff00,
  warning: 0xffa500,
  critical: 0xff0000,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("health")
    .setDescription("View bot health and system metrics (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) => subcommand.setName("status").setDescription("View overall health status"))
    .addSubcommand((subcommand) => subcommand.setName("metrics").setDescription("View detailed system metrics"))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("errors")
        .setDescription("View recent errors")
        .addIntegerOption((option) =>
          option.setName("limit").setDescription("Number of errors to show (default: 5)").setMinValue(1).setMaxValue(20)
        )
    )
    .addSubcommand((subcommand) => subcommand.setName("reset").setDescription("Reset health metrics")),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "status") {
      await handleStatus(interaction);
    } else if (subcommand === "metrics") {
      await handleMetrics(interaction);
    } else if (subcommand === "errors") {
      await handleErrors(interaction);
    } else if (subcommand === "reset") {
      await handleReset(interaction);
    }
  },
};

async function handleStatus(interaction) {
  const healthStatus = health.getHealthStatus();
  const metrics = health.getMetrics();

  const color = healthStatus.healthy ? COLORS.healthy : COLORS.critical;

  const embed = new EmbedBuilder().setTitle("🏥 Bot Health Status").setColor(color).setTimestamp();

  // Overall status
  const statusEmoji = healthStatus.healthy ? "✅" : "❌";
  const statusText = healthStatus.healthy ? "Healthy" : "Issues Detected";

  embed.addFields({
    name: `${statusEmoji} Overall Status`,
    value: `**${statusText}**`,
    inline: false,
  });

  // Issues
  if (healthStatus.issues.length > 0) {
    embed.addFields({
      name: "⚠️ Issues",
      value: healthStatus.issues.map((issue) => `• ${issue}`).join("\n"),
      inline: false,
    });
  }

  // Quick metrics
  const quickMetrics = [
    `⏱️ Uptime: **${metrics.uptime}**`,
    `💾 Memory: **${metrics.performance.lastMemoryUsage?.heapUsed || "N/A"} MB**`,
    `🔗 Lavalink: **${metrics.lavalink.connected ? "Connected" : "Disconnected"}**`,
    `📊 Commands: **${metrics.commands.successful}/${metrics.commands.total}** successful`,
  ].join("\n");

  embed.addFields({
    name: "📈 Quick Metrics",
    value: quickMetrics,
    inline: false,
  });

  // Recent activity
  const recentErrors = health.getRecentErrors(3);
  if (recentErrors.length > 0) {
    const errorList = recentErrors
      .map((err) => {
        const time = new Date(err.timestamp).toLocaleTimeString();
        return `\`${time}\` ${err.message.substring(0, 60)}`;
      })
      .join("\n");

    embed.addFields({
      name: "🔴 Recent Errors",
      value: errorList,
      inline: false,
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleMetrics(interaction) {
  const metrics = health.getMetrics();

  const embed = new EmbedBuilder().setTitle("📊 System Metrics").setColor(COLORS.healthy).setTimestamp();

  // System Info
  const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
  const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
  const usedMem = (totalMem - freeMem).toFixed(2);

  embed.addFields({
    name: "💻 System",
    value: [
      `Platform: **${os.platform()} ${os.arch()}**`,
      `Node: **${process.version}**`,
      `Uptime: **${metrics.uptime}**`,
    ].join("\n"),
    inline: true,
  });

  // Memory
  if (metrics.performance.lastMemoryUsage) {
    const mem = metrics.performance.lastMemoryUsage;
    embed.addFields({
      name: "💾 Memory",
      value: [
        `Heap Used: **${mem.heapUsed} MB**`,
        `Heap Total: **${mem.heapTotal} MB**`,
        `RSS: **${mem.rss} MB**`,
        `System: **${usedMem}/${totalMem} GB**`,
      ].join("\n"),
      inline: true,
    });
  }

  // CPU
  if (metrics.performance.lastCpuUsage) {
    const cpu = metrics.performance.lastCpuUsage;
    embed.addFields({
      name: "⚙️ CPU",
      value: [
        `Usage: **${cpu.usage}%**`,
        `Cores: **${cpu.cores}**`,
        `Event Loop Lag: **${metrics.performance.eventLoopLag?.toFixed(2) || "N/A"} ms**`,
      ].join("\n"),
      inline: true,
    });
  }

  // Lavalink
  embed.addFields({
    name: "🔗 Lavalink",
    value: [
      `Status: **${metrics.lavalink.connected ? "Connected ✅" : "Disconnected ❌"}**`,
      `Reconnects: **${metrics.lavalink.reconnects}**`,
      `Latency: **${metrics.lavalink.latency !== null ? `${metrics.lavalink.latency}ms` : "N/A"}**`,
    ].join("\n"),
    inline: true,
  });

  // Commands
  const commandSuccessRate =
    metrics.commands.total > 0 ? ((metrics.commands.successful / metrics.commands.total) * 100).toFixed(2) : "N/A";

  embed.addFields({
    name: "🎯 Commands",
    value: [
      `Total: **${metrics.commands.total}**`,
      `Successful: **${metrics.commands.successful}**`,
      `Failed: **${metrics.commands.failed}**`,
      `Success Rate: **${commandSuccessRate}%**`,
    ].join("\n"),
    inline: true,
  });

  // Tracks
  embed.addFields({
    name: "🎵 Tracks",
    value: [
      `Played: **${metrics.tracks.played}**`,
      `Failed: **${metrics.tracks.failed}**`,
      `Skipped: **${metrics.tracks.skipped}**`,
    ].join("\n"),
    inline: true,
  });

  // Error Summary
  embed.addFields({
    name: "⚠️ Errors & Warnings",
    value: [
      `Total Errors: **${metrics.errors.length}**`,
      `Total Warnings: **${metrics.warnings.length}**`,
      `Recent Errors: **${health.getRecentErrors(10).length}**`,
    ].join("\n"),
    inline: false,
  });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleErrors(interaction) {
  const limit = interaction.options.getInteger("limit") || 5;
  const recentErrors = health.getRecentErrors(limit);

  const embed = new EmbedBuilder().setTitle("🔴 Recent Errors").setColor(COLORS.critical).setTimestamp();

  if (recentErrors.length === 0) {
    embed.setDescription("No errors recorded! 🎉");
  } else {
    recentErrors.forEach((err, index) => {
      const time = new Date(err.timestamp).toLocaleString();
      const contextStr = err.context ? `\nContext: ${JSON.stringify(err.context)}` : "";

      embed.addFields({
        name: `Error #${index + 1} - ${time}`,
        value: `\`\`\`\n${err.message}${contextStr}\n\`\`\``,
        inline: false,
      });
    });
  }

  embed.setFooter({ text: `Showing ${recentErrors.length} most recent errors` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleReset(interaction) {
  health.resetMetrics();

  const embed = new EmbedBuilder()
    .setTitle("🔄 Metrics Reset")
    .setDescription("All health metrics have been reset successfully.")
    .setColor(COLORS.healthy)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
