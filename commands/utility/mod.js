const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mod")
    .setDescription("Moderation commands")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName("kick")
        .setDescription("Kick a member from the server")
        .addUserOption((option) => option.setName("user").setDescription("User to kick").setRequired(true))
        .addStringOption((option) =>
          option.setName("reason").setDescription("Reason for the kick").setRequired(false).setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("ban")
        .setDescription("Ban a member from the server")
        .addUserOption((option) => option.setName("user").setDescription("User to ban").setRequired(true))
        .addStringOption((option) =>
          option.setName("reason").setDescription("Reason for the ban").setRequired(false).setMaxLength(500)
        )
        .addIntegerOption((option) =>
          option
            .setName("delete-messages")
            .setDescription("Delete message history (in days)")
            .setMinValue(0)
            .setMaxValue(7)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("unban")
        .setDescription("Unban a user from the server")
        .addStringOption((option) =>
          option.setName("user-id").setDescription("User ID to unban").setRequired(true).setAutocomplete(true)
        )
        .addStringOption((option) => option.setName("reason").setDescription("Reason for the unban").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("timeout")
        .setDescription("Timeout a member (mute)")
        .addUserOption((option) => option.setName("user").setDescription("User to timeout").setRequired(true))
        .addStringOption((option) =>
          option
            .setName("duration")
            .setDescription("Timeout duration")
            .setRequired(true)
            .addChoices(
              { name: "60 seconds", value: "60" },
              { name: "5 minutes", value: "300" },
              { name: "10 minutes", value: "600" },
              { name: "1 hour", value: "3600" },
              { name: "1 day", value: "86400" },
              { name: "1 week", value: "604800" }
            )
        )
        .addStringOption((option) =>
          option.setName("reason").setDescription("Reason for the timeout").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("untimeout")
        .setDescription("Remove timeout from a member")
        .addUserOption((option) => option.setName("user").setDescription("User to untimeout").setRequired(true))
        .addStringOption((option) =>
          option.setName("reason").setDescription("Reason for removing timeout").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("purge")
        .setDescription("Delete multiple messages from the channel")
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setDescription("Number of messages to delete (1-100)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
        .addUserOption((option) =>
          option.setName("user").setDescription("Only delete messages from this user").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("slowmode")
        .setDescription("Set channel slowmode")
        .addIntegerOption((option) =>
          option
            .setName("seconds")
            .setDescription("Slowmode duration in seconds (0 to disable)")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(21600)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("lock")
        .setDescription("Lock the current channel (prevent sending messages)")
        .addStringOption((option) => option.setName("reason").setDescription("Reason for locking").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("unlock")
        .setDescription("Unlock the current channel")
        .addStringOption((option) => option.setName("reason").setDescription("Reason for unlocking").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("warn")
        .setDescription("Send a warning to a user via DM")
        .addUserOption((option) => option.setName("user").setDescription("User to warn").setRequired(true))
        .addStringOption((option) =>
          option.setName("reason").setDescription("Warning reason").setRequired(true).setMaxLength(1000)
        )
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === "user-id") {
      try {
        const bans = await interaction.guild.bans.fetch();
        const filtered = bans
          .filter(
            (ban) =>
              ban.user.id.includes(focusedOption.value) ||
              ban.user.username.toLowerCase().includes(focusedOption.value.toLowerCase())
          )
          .first(25);

        await interaction.respond(
          [...filtered.values()].map((ban) => ({
            name: `${ban.user.username} (${ban.user.id})`,
            value: ban.user.id,
          }))
        );
      } catch {
        await interaction.respond([]);
      }
    }
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "kick":
        return handleKick(interaction);
      case "ban":
        return handleBan(interaction);
      case "unban":
        return handleUnban(interaction);
      case "timeout":
        return handleTimeout(interaction);
      case "untimeout":
        return handleUntimeout(interaction);
      case "purge":
        return handlePurge(interaction);
      case "slowmode":
        return handleSlowmode(interaction);
      case "lock":
        return handleLock(interaction);
      case "unlock":
        return handleUnlock(interaction);
      case "warn":
        return handleWarn(interaction);
    }
  },
};

async function handleKick(interaction) {
  const user = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") || "No reason provided";
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.reply({ content: "❌ User not found in this server.", ephemeral: true });
  }

  if (!member.kickable) {
    return interaction.reply({
      content: "❌ I cannot kick this user. They may have higher permissions than me.",
      ephemeral: true,
    });
  }

  if (member.id === interaction.user.id) {
    return interaction.reply({ content: "❌ You cannot kick yourself.", ephemeral: true });
  }

  try {
    await member.kick(reason);

    const embed = new EmbedBuilder()
      .setColor("#ED4245")
      .setTitle("👢 Member Kicked")
      .addFields(
        { name: "User", value: `${user.tag} (${user.id})`, inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    Log.info(`${interaction.user.tag} kicked ${user.tag}: ${reason}`, "moderation", interaction.guild.id);
  } catch (error) {
    Log.error("Failed to kick user", error);
    await interaction.reply({ content: `❌ Failed to kick user: ${error.message}`, ephemeral: true });
  }
}

async function handleBan(interaction) {
  const user = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") || "No reason provided";
  const deleteMessages = interaction.options.getInteger("delete-messages") || 0;

  if (user.id === interaction.user.id) {
    return interaction.reply({ content: "❌ You cannot ban yourself.", ephemeral: true });
  }

  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (member && !member.bannable) {
    return interaction.reply({
      content: "❌ I cannot ban this user. They may have higher permissions than me.",
      ephemeral: true,
    });
  }

  try {
    await interaction.guild.members.ban(user, {
      reason,
      deleteMessageSeconds: deleteMessages * 86400,
    });

    const embed = new EmbedBuilder()
      .setColor("#ED4245")
      .setTitle("🔨 Member Banned")
      .addFields(
        { name: "User", value: `${user.tag} (${user.id})`, inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false },
        { name: "Messages Deleted", value: deleteMessages > 0 ? `Last ${deleteMessages} day(s)` : "None", inline: true }
      )
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    Log.info(`${interaction.user.tag} banned ${user.tag}: ${reason}`, "moderation", interaction.guild.id);
  } catch (error) {
    Log.error("Failed to ban user", error);
    await interaction.reply({ content: `❌ Failed to ban user: ${error.message}`, ephemeral: true });
  }
}

async function handleUnban(interaction) {
  const userId = interaction.options.getString("user-id");
  const reason = interaction.options.getString("reason") || "No reason provided";

  try {
    const ban = await interaction.guild.bans.fetch(userId);
    await interaction.guild.members.unban(userId, reason);

    const embed = new EmbedBuilder()
      .setColor("#57F287")
      .setTitle("✅ User Unbanned")
      .addFields(
        { name: "User", value: `${ban.user.tag} (${ban.user.id})`, inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    Log.info(`${interaction.user.tag} unbanned ${ban.user.tag}: ${reason}`, "moderation", interaction.guild.id);
  } catch (error) {
    if (error.code === 10026) {
      return interaction.reply({ content: "❌ This user is not banned.", ephemeral: true });
    }
    Log.error("Failed to unban user", error);
    await interaction.reply({ content: `❌ Failed to unban user: ${error.message}`, ephemeral: true });
  }
}

async function handleTimeout(interaction) {
  const user = interaction.options.getUser("user");
  const duration = parseInt(interaction.options.getString("duration"));
  const reason = interaction.options.getString("reason") || "No reason provided";
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.reply({ content: "❌ User not found in this server.", ephemeral: true });
  }

  if (!member.moderatable) {
    return interaction.reply({
      content: "❌ I cannot timeout this user. They may have higher permissions than me.",
      ephemeral: true,
    });
  }

  if (member.id === interaction.user.id) {
    return interaction.reply({ content: "❌ You cannot timeout yourself.", ephemeral: true });
  }

  try {
    await member.timeout(duration * 1000, reason);

    const durationText = formatDuration(duration);

    const embed = new EmbedBuilder()
      .setColor("#FEE75C")
      .setTitle("⏰ Member Timed Out")
      .addFields(
        { name: "User", value: `${user.tag} (${user.id})`, inline: true },
        { name: "Duration", value: durationText, inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    Log.info(
      `${interaction.user.tag} timed out ${user.tag} for ${durationText}: ${reason}`,
      "moderation",
      interaction.guild.id
    );
  } catch (error) {
    Log.error("Failed to timeout user", error);
    await interaction.reply({ content: `❌ Failed to timeout user: ${error.message}`, ephemeral: true });
  }
}

async function handleUntimeout(interaction) {
  const user = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") || "No reason provided";
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.reply({ content: "❌ User not found in this server.", ephemeral: true });
  }

  if (!member.isCommunicationDisabled()) {
    return interaction.reply({ content: "❌ This user is not timed out.", ephemeral: true });
  }

  try {
    await member.timeout(null, reason);

    const embed = new EmbedBuilder()
      .setColor("#57F287")
      .setTitle("✅ Timeout Removed")
      .addFields(
        { name: "User", value: `${user.tag} (${user.id})`, inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    Log.info(`${interaction.user.tag} removed timeout from ${user.tag}: ${reason}`, "moderation", interaction.guild.id);
  } catch (error) {
    Log.error("Failed to remove timeout", error);
    await interaction.reply({ content: `❌ Failed to remove timeout: ${error.message}`, ephemeral: true });
  }
}

async function handlePurge(interaction) {
  const amount = interaction.options.getInteger("amount");
  const user = interaction.options.getUser("user");

  await interaction.deferReply({ ephemeral: true });

  try {
    let messages = await interaction.channel.messages.fetch({ limit: 100 });

    if (user) {
      messages = messages.filter((m) => m.author.id === user.id);
    }

    // Filter out messages older than 14 days (Discord limit)
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    messages = messages.filter((m) => m.createdTimestamp > twoWeeksAgo);

    messages = [...messages.values()].slice(0, amount);

    if (messages.length === 0) {
      return interaction.editReply(
        "❌ No messages found to delete (messages older than 14 days cannot be bulk deleted)."
      );
    }

    const deleted = await interaction.channel.bulkDelete(messages, true);

    const embed = new EmbedBuilder()
      .setColor("#57F287")
      .setTitle("🗑️ Messages Purged")
      .addFields(
        { name: "Deleted", value: `${deleted.size} messages`, inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true }
      )
      .setTimestamp();

    if (user) {
      embed.addFields({ name: "From User", value: `${user.tag}`, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
    Log.info(
      `${interaction.user.tag} purged ${deleted.size} messages${user ? ` from ${user.tag}` : ""}`,
      "moderation",
      interaction.guild.id
    );
  } catch (error) {
    Log.error("Failed to purge messages", error);
    await interaction.editReply(`❌ Failed to purge messages: ${error.message}`);
  }
}

async function handleSlowmode(interaction) {
  const seconds = interaction.options.getInteger("seconds");

  try {
    await interaction.channel.setRateLimitPerUser(seconds);

    const embed = new EmbedBuilder()
      .setColor(seconds > 0 ? "#FEE75C" : "#57F287")
      .setTitle(seconds > 0 ? "🐌 Slowmode Enabled" : "✅ Slowmode Disabled")
      .addFields(
        { name: "Duration", value: seconds > 0 ? formatDuration(seconds) : "Disabled", inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    Log.info(
      `${interaction.user.tag} set slowmode to ${seconds}s in #${interaction.channel.name}`,
      "moderation",
      interaction.guild.id
    );
  } catch (error) {
    Log.error("Failed to set slowmode", error);
    await interaction.reply({ content: `❌ Failed to set slowmode: ${error.message}`, ephemeral: true });
  }
}

async function handleLock(interaction) {
  const reason = interaction.options.getString("reason") || "Channel locked by moderator";

  try {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: false,
    });

    const embed = new EmbedBuilder()
      .setColor("#ED4245")
      .setTitle("🔒 Channel Locked")
      .setDescription("This channel has been locked. Members cannot send messages.")
      .addFields(
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    Log.info(
      `${interaction.user.tag} locked #${interaction.channel.name}: ${reason}`,
      "moderation",
      interaction.guild.id
    );
  } catch (error) {
    Log.error("Failed to lock channel", error);
    await interaction.reply({ content: `❌ Failed to lock channel: ${error.message}`, ephemeral: true });
  }
}

async function handleUnlock(interaction) {
  const reason = interaction.options.getString("reason") || "Channel unlocked by moderator";

  try {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: null,
    });

    const embed = new EmbedBuilder()
      .setColor("#57F287")
      .setTitle("🔓 Channel Unlocked")
      .setDescription("This channel has been unlocked. Members can send messages again.")
      .addFields(
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    Log.info(
      `${interaction.user.tag} unlocked #${interaction.channel.name}: ${reason}`,
      "moderation",
      interaction.guild.id
    );
  } catch (error) {
    Log.error("Failed to unlock channel", error);
    await interaction.reply({ content: `❌ Failed to unlock channel: ${error.message}`, ephemeral: true });
  }
}

async function handleWarn(interaction) {
  const user = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason");

  if (user.bot) {
    return interaction.reply({ content: "❌ You cannot warn a bot.", ephemeral: true });
  }

  try {
    const warnEmbed = new EmbedBuilder()
      .setColor("#FEE75C")
      .setTitle("⚠️ Warning")
      .setDescription(`You have received a warning from **${interaction.guild.name}**`)
      .addFields(
        { name: "Reason", value: reason, inline: false },
        { name: "Issued By", value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    await user.send({ embeds: [warnEmbed] });

    const embed = new EmbedBuilder()
      .setColor("#FEE75C")
      .setTitle("⚠️ Warning Sent")
      .addFields(
        { name: "User", value: `${user.tag} (${user.id})`, inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    Log.info(`${interaction.user.tag} warned ${user.tag}: ${reason}`, "moderation", interaction.guild.id);
  } catch (error) {
    if (error.code === 50007) {
      return interaction.reply({
        content: `❌ Cannot send warning to ${user.tag}. They may have DMs disabled.`,
        ephemeral: true,
      });
    }
    Log.error("Failed to warn user", error);
    await interaction.reply({ content: `❌ Failed to warn user: ${error.message}`, ephemeral: true });
  }
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minute${seconds >= 120 ? "s" : ""}`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${seconds >= 7200 ? "s" : ""}`;
  return `${Math.floor(seconds / 86400)} day${seconds >= 172800 ? "s" : ""}`;
}
