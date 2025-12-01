const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const fs = require("node:fs/promises");
const path = require("node:path");
const Log = require("../../helpers/logs/log");

const DATA_FILE = path.join(__dirname, "..", "..", "helpers", "data", "tickets.json");

// In-memory cache
let ticketsData = { config: {}, tickets: [] };
let loaded = false;

async function loadData() {
  if (loaded) return;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    ticketsData = JSON.parse(raw);
    loaded = true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      Log.error("Failed to load tickets data", error);
    }
    ticketsData = { config: {}, tickets: [] };
    loaded = true;
  }
}

async function saveData() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(ticketsData, null, 2), "utf-8");
  } catch (error) {
    Log.error("Failed to save tickets data", error);
  }
}

function getGuildConfig(guildId) {
  return ticketsData.config[guildId] || null;
}

function setGuildConfig(guildId, config) {
  ticketsData.config[guildId] = config;
  saveData();
}

function generateTicketId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function createTicket(guildId, userId, type, title, description) {
  const ticket = {
    id: generateTicketId(),
    guildId,
    userId,
    type,
    title,
    description,
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    responses: [],
  };
  ticketsData.tickets.push(ticket);
  saveData();
  return ticket;
}

function getTicket(ticketId) {
  return ticketsData.tickets.find((t) => t.id === ticketId);
}

function getGuildTickets(guildId, status = null) {
  let tickets = ticketsData.tickets.filter((t) => t.guildId === guildId);
  if (status) {
    tickets = tickets.filter((t) => t.status === status);
  }
  return tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getUserTickets(userId, guildId = null) {
  let tickets = ticketsData.tickets.filter((t) => t.userId === userId);
  if (guildId) {
    tickets = tickets.filter((t) => t.guildId === guildId);
  }
  return tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function updateTicketStatus(ticketId, status, responderId = null, response = null) {
  const ticket = getTicket(ticketId);
  if (!ticket) return null;

  ticket.status = status;
  ticket.updatedAt = new Date().toISOString();

  if (response) {
    ticket.responses.push({
      responderId,
      response,
      timestamp: new Date().toISOString(),
    });
  }

  saveData();
  return ticket;
}

const TICKET_TYPES = {
  bug: { label: "🐛 Bug Report", color: "#ED4245", emoji: "🐛" },
  feature: { label: "💡 Feature Request", color: "#57F287", emoji: "💡" },
  feedback: { label: "💬 General Feedback", color: "#5865F2", emoji: "💬" },
  question: { label: "❓ Question", color: "#FEE75C", emoji: "❓" },
  other: { label: "📝 Other", color: "#99AAB5", emoji: "📝" },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Report bugs, request features, or provide feedback")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new ticket (bug report, feature request, feedback)")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Type of ticket")
            .setRequired(true)
            .addChoices(
              { name: "🐛 Bug Report", value: "bug" },
              { name: "💡 Feature Request", value: "feature" },
              { name: "💬 General Feedback", value: "feedback" },
              { name: "❓ Question", value: "question" },
              { name: "📝 Other", value: "other" }
            )
        )
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("View your submitted tickets"))
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View details of a specific ticket")
        .addStringOption((option) =>
          option.setName("id").setDescription("Ticket ID (e.g., ABC123)").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("admin")
        .setDescription("Admin ticket management")
        .addSubcommand((sub) =>
          sub
            .setName("setup")
            .setDescription("Configure the ticket system for this server")
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("Channel where ticket notifications will be sent")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
            .addRoleOption((option) =>
              option.setName("role").setDescription("Role to ping for new tickets (optional)").setRequired(false)
            )
        )
        .addSubcommand((sub) => sub.setName("disable").setDescription("Disable the ticket system for this server"))
        .addSubcommand((sub) =>
          sub
            .setName("pending")
            .setDescription("View all open tickets for this server")
            .addStringOption((option) =>
              option
                .setName("status")
                .setDescription("Filter by status")
                .addChoices(
                  { name: "🟢 Open", value: "open" },
                  { name: "🟡 In Progress", value: "in-progress" },
                  { name: "🔴 Closed", value: "closed" },
                  { name: "📋 All", value: "all" }
                )
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("respond")
            .setDescription("Respond to a ticket")
            .addStringOption((option) =>
              option.setName("id").setDescription("Ticket ID").setRequired(true).setAutocomplete(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("close")
            .setDescription("Close a ticket")
            .addStringOption((option) =>
              option.setName("id").setDescription("Ticket ID").setRequired(true).setAutocomplete(true)
            )
            .addStringOption((option) =>
              option.setName("reason").setDescription("Reason for closing (optional)").setRequired(false)
            )
        )
    ),

  async autocomplete(interaction) {
    await loadData();

    const focusedOption = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup();

    if (focusedOption.name === "id") {
      let tickets;

      if (subcommandGroup === "admin") {
        // Admins see all guild tickets
        tickets = getGuildTickets(interaction.guild.id);
      } else {
        // Users see their own tickets
        tickets = getUserTickets(interaction.user.id, interaction.guild.id);
      }

      const filtered = tickets
        .filter(
          (t) =>
            t.id.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
            t.title.toLowerCase().includes(focusedOption.value.toLowerCase())
        )
        .slice(0, 25);

      await interaction.respond(
        filtered.map((t) => ({
          name: `${t.id} - ${t.title.slice(0, 50)}${t.title.length > 50 ? "..." : ""} (${t.status})`,
          value: t.id,
        }))
      );
    }
  },

  async execute(interaction) {
    await loadData();

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === "admin") {
      // Check admin permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: "❌ You need **Manage Server** permission to manage tickets.",
          ephemeral: true,
        });
      }

      switch (subcommand) {
        case "setup":
          return handleSetup(interaction);
        case "disable":
          return handleDisable(interaction);
        case "pending":
          return handlePending(interaction);
        case "respond":
          return handleRespond(interaction);
        case "close":
          return handleClose(interaction);
      }
    }

    switch (subcommand) {
      case "create":
        return handleCreate(interaction);
      case "list":
        return handleList(interaction);
      case "view":
        return handleView(interaction);
    }
  },

  async handleModal(interaction) {
    await loadData();

    if (interaction.customId.startsWith("ticket_create:")) {
      return handleCreateModal(interaction);
    }

    if (interaction.customId.startsWith("ticket_respond:")) {
      return handleRespondModal(interaction);
    }
  },

  // Export for button handlers
  handleTicketButton,
};

async function handleSetup(interaction) {
  const channel = interaction.options.getChannel("channel");
  const role = interaction.options.getRole("role");

  setGuildConfig(interaction.guild.id, {
    channelId: channel.id,
    roleId: role?.id || null,
    enabled: true,
  });

  const embed = new EmbedBuilder()
    .setColor("#57F287")
    .setTitle("✅ Ticket System Configured")
    .addFields(
      { name: "Notification Channel", value: `${channel}`, inline: true },
      { name: "Ping Role", value: role ? `${role}` : "None", inline: true }
    )
    .setDescription("Users can now use `/ticket create` to submit bug reports, feature requests, and feedback.")
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDisable(interaction) {
  const config = getGuildConfig(interaction.guild.id);

  if (!config?.enabled) {
    return interaction.reply({
      content: "❌ Ticket system is not enabled for this server.",
      ephemeral: true,
    });
  }

  setGuildConfig(interaction.guild.id, { ...config, enabled: false });

  await interaction.reply({
    content: "✅ Ticket system has been disabled for this server.",
    ephemeral: true,
  });
}

async function handleCreate(interaction) {
  const type = interaction.options.getString("type");

  const modal = new ModalBuilder().setCustomId(`ticket_create:${type}`).setTitle(`Create ${TICKET_TYPES[type].label}`);

  const titleInput = new TextInputBuilder()
    .setCustomId("ticket_title")
    .setLabel("Title")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Brief summary of your report...")
    .setMaxLength(100)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("ticket_description")
    .setLabel("Description")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(getPlaceholderForType(type))
    .setMaxLength(2000)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descriptionInput)
  );

  await interaction.showModal(modal);
}

function getPlaceholderForType(type) {
  switch (type) {
    case "bug":
      return "Describe the bug, steps to reproduce, expected vs actual behavior...";
    case "feature":
      return "Describe the feature you'd like to see and why it would be useful...";
    case "feedback":
      return "Share your thoughts, suggestions, or experience with the bot...";
    case "question":
      return "What would you like to know?";
    default:
      return "Provide details...";
  }
}

async function handleCreateModal(interaction) {
  const type = interaction.customId.replace("ticket_create:", "");
  const title = interaction.fields.getTextInputValue("ticket_title");
  const description = interaction.fields.getTextInputValue("ticket_description");

  const ticket = createTicket(interaction.guild.id, interaction.user.id, type, title, description);

  const typeInfo = TICKET_TYPES[type];

  // User confirmation embed
  const userEmbed = new EmbedBuilder()
    .setColor(typeInfo.color)
    .setTitle(`${typeInfo.emoji} Ticket Created`)
    .setDescription(`Your ${typeInfo.label.toLowerCase()} has been submitted.`)
    .addFields(
      { name: "Ticket ID", value: `\`${ticket.id}\``, inline: true },
      { name: "Status", value: "🟢 Open", inline: true },
      { name: "Title", value: title, inline: false }
    )
    .setFooter({ text: "Use /ticket view to check status" })
    .setTimestamp();

  await interaction.reply({ embeds: [userEmbed], ephemeral: true });

  // Send notification to admin channel
  const config = getGuildConfig(interaction.guild.id);
  if (config?.enabled && config.channelId) {
    try {
      const channel = await interaction.guild.channels.fetch(config.channelId);
      if (channel) {
        const adminEmbed = new EmbedBuilder()
          .setColor(typeInfo.color)
          .setTitle(`${typeInfo.emoji} New ${typeInfo.label}`)
          .setDescription(description)
          .addFields(
            { name: "Ticket ID", value: `\`${ticket.id}\``, inline: true },
            { name: "From", value: `<@${interaction.user.id}>`, inline: true },
            { name: "Title", value: title, inline: false }
          )
          .setFooter({ text: `User ID: ${interaction.user.id}` })
          .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_progress:${ticket.id}`)
            .setLabel("Mark In Progress")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`ticket_respond:${ticket.id}`)
            .setLabel("Respond")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`ticket_close:${ticket.id}`).setLabel("Close").setStyle(ButtonStyle.Danger)
        );

        const content = config.roleId ? `<@&${config.roleId}>` : "";
        await channel.send({ content, embeds: [adminEmbed], components: [buttons] });
      }
    } catch (error) {
      Log.error("Failed to send ticket notification", error);
    }
  }

  Log.info(`Ticket ${ticket.id} created by ${interaction.user.tag} in ${interaction.guild.name}`, "ticket");
}

async function handleList(interaction) {
  const tickets = getUserTickets(interaction.user.id, interaction.guild.id);

  if (tickets.length === 0) {
    return interaction.reply({
      content: "📭 You haven't submitted any tickets in this server yet.\nUse `/ticket create` to submit one!",
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("📋 Your Tickets")
    .setDescription(
      tickets
        .slice(0, 15)
        .map((t) => {
          const status =
            t.status === "open" ? "🟢" : t.status === "in-progress" ? "🟡" : t.status === "closed" ? "🔴" : "⚪";
          const typeEmoji = TICKET_TYPES[t.type]?.emoji || "📝";
          return `${status} \`${t.id}\` ${typeEmoji} **${t.title.slice(0, 40)}${t.title.length > 40 ? "..." : ""}**`;
        })
        .join("\n")
    )
    .setFooter({ text: `Total: ${tickets.length} ticket(s) • Use /ticket view id:<id> for details` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleView(interaction) {
  const ticketId = interaction.options.getString("id");
  const ticket = getTicket(ticketId);

  if (!ticket) {
    return interaction.reply({
      content: "❌ Ticket not found.",
      ephemeral: true,
    });
  }

  // Check if user owns the ticket or is admin
  const isOwner = ticket.userId === interaction.user.id;
  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!isOwner && !isAdmin) {
    return interaction.reply({
      content: "❌ You don't have permission to view this ticket.",
      ephemeral: true,
    });
  }

  const typeInfo = TICKET_TYPES[ticket.type] || TICKET_TYPES.other;
  const statusEmoji = ticket.status === "open" ? "🟢" : ticket.status === "in-progress" ? "🟡" : "🔴";

  const embed = new EmbedBuilder()
    .setColor(typeInfo.color)
    .setTitle(`${typeInfo.emoji} Ticket ${ticket.id}`)
    .setDescription(ticket.description)
    .addFields(
      { name: "Title", value: ticket.title, inline: false },
      { name: "Type", value: typeInfo.label, inline: true },
      { name: "Status", value: `${statusEmoji} ${ticket.status}`, inline: true },
      { name: "Created", value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:R>`, inline: true }
    )
    .setTimestamp(new Date(ticket.updatedAt));

  if (ticket.responses.length > 0) {
    const latestResponse = ticket.responses[ticket.responses.length - 1];
    embed.addFields({
      name: `💬 Response (${ticket.responses.length} total)`,
      value: latestResponse.response.slice(0, 500) + (latestResponse.response.length > 500 ? "..." : ""),
      inline: false,
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handlePending(interaction) {
  const statusFilter = interaction.options.getString("status") || "open";
  const tickets =
    statusFilter === "all"
      ? getGuildTickets(interaction.guild.id)
      : getGuildTickets(interaction.guild.id, statusFilter);

  if (tickets.length === 0) {
    return interaction.reply({
      content: `📭 No ${statusFilter === "all" ? "" : statusFilter + " "}tickets found.`,
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle(
      `📋 ${statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Tickets`
    )
    .setDescription(
      tickets
        .slice(0, 20)
        .map((t) => {
          const status =
            t.status === "open" ? "🟢" : t.status === "in-progress" ? "🟡" : t.status === "closed" ? "🔴" : "⚪";
          const typeEmoji = TICKET_TYPES[t.type]?.emoji || "📝";
          return `${status} \`${t.id}\` ${typeEmoji} **${t.title.slice(0, 35)}...** - <@${t.userId}>`;
        })
        .join("\n")
    )
    .setFooter({ text: `Total: ${tickets.length} ticket(s)` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRespond(interaction) {
  const ticketId = interaction.options.getString("id");
  const ticket = getTicket(ticketId);

  if (!ticket) {
    return interaction.reply({
      content: "❌ Ticket not found.",
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder().setCustomId(`ticket_respond:${ticketId}`).setTitle(`Respond to Ticket ${ticketId}`);

  const responseInput = new TextInputBuilder()
    .setCustomId("response")
    .setLabel("Response")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Type your response to the user...")
    .setMaxLength(1500)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(responseInput));

  await interaction.showModal(modal);
}

async function handleRespondModal(interaction) {
  const ticketId = interaction.customId.replace("ticket_respond:", "");
  const response = interaction.fields.getTextInputValue("response");

  const ticket = updateTicketStatus(ticketId, "in-progress", interaction.user.id, response);

  if (!ticket) {
    return interaction.reply({
      content: "❌ Ticket not found.",
      ephemeral: true,
    });
  }

  await interaction.reply({
    content: `✅ Response sent to ticket \`${ticketId}\`. The user will be notified.`,
    ephemeral: true,
  });

  // Try to DM the user
  try {
    const user = await interaction.client.users.fetch(ticket.userId);
    const typeInfo = TICKET_TYPES[ticket.type] || TICKET_TYPES.other;

    const dmEmbed = new EmbedBuilder()
      .setColor(typeInfo.color)
      .setTitle(`${typeInfo.emoji} Response to Your Ticket`)
      .setDescription(response)
      .addFields(
        { name: "Ticket ID", value: `\`${ticketId}\``, inline: true },
        { name: "Title", value: ticket.title, inline: true },
        { name: "From Server", value: interaction.guild.name, inline: true }
      )
      .setFooter({ text: `Responded by ${interaction.user.tag}` })
      .setTimestamp();

    await user.send({ embeds: [dmEmbed] });
  } catch {
    // User may have DMs disabled
    Log.debug(`Could not DM user ${ticket.userId} about ticket response`);
  }

  Log.info(`Ticket ${ticketId} responded to by ${interaction.user.tag}`, "ticket");
}

async function handleClose(interaction) {
  const ticketId = interaction.options.getString("id");
  const reason = interaction.options.getString("reason") || "No reason provided";

  const ticket = updateTicketStatus(ticketId, "closed", interaction.user.id, `Closed: ${reason}`);

  if (!ticket) {
    return interaction.reply({
      content: "❌ Ticket not found.",
      ephemeral: true,
    });
  }

  await interaction.reply({
    content: `✅ Ticket \`${ticketId}\` has been closed.`,
    ephemeral: true,
  });

  // Try to DM the user
  try {
    const user = await interaction.client.users.fetch(ticket.userId);
    const typeInfo = TICKET_TYPES[ticket.type] || TICKET_TYPES.other;

    const dmEmbed = new EmbedBuilder()
      .setColor("#ED4245")
      .setTitle(`${typeInfo.emoji} Ticket Closed`)
      .setDescription(`Your ticket has been closed.`)
      .addFields(
        { name: "Ticket ID", value: `\`${ticketId}\``, inline: true },
        { name: "Title", value: ticket.title, inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setFooter({ text: `From: ${interaction.guild.name}` })
      .setTimestamp();

    await user.send({ embeds: [dmEmbed] });
  } catch {
    Log.debug(`Could not DM user ${ticket.userId} about ticket closure`);
  }

  Log.info(`Ticket ${ticketId} closed by ${interaction.user.tag}: ${reason}`, "ticket");
}

async function handleTicketButton(interaction) {
  await loadData();

  const [action, ticketId] = interaction.customId.split(":").slice(0, 2);

  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: "❌ You need **Manage Server** permission to manage tickets.",
      ephemeral: true,
    });
  }

  const ticket = getTicket(ticketId);

  if (!ticket) {
    return interaction.reply({
      content: "❌ Ticket not found.",
      ephemeral: true,
    });
  }

  switch (action) {
    case "ticket_progress": {
      updateTicketStatus(ticketId, "in-progress");
      await interaction.reply({
        content: `✅ Ticket \`${ticketId}\` marked as in-progress.`,
        ephemeral: true,
      });
      break;
    }

    case "ticket_respond": {
      const modal = new ModalBuilder()
        .setCustomId(`ticket_respond:${ticketId}`)
        .setTitle(`Respond to Ticket ${ticketId}`);

      const responseInput = new TextInputBuilder()
        .setCustomId("response")
        .setLabel("Response")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Type your response to the user...")
        .setMaxLength(1500)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(responseInput));

      await interaction.showModal(modal);
      break;
    }

    case "ticket_close": {
      updateTicketStatus(ticketId, "closed", interaction.user.id, "Closed via button");
      await interaction.reply({
        content: `✅ Ticket \`${ticketId}\` has been closed.`,
        ephemeral: true,
      });

      // Update the original message to show closed
      try {
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor("#99AAB5")
          .setTitle("🔴 [CLOSED] " + interaction.message.embeds[0].title);

        await interaction.message.edit({
          embeds: [embed],
          components: [], // Remove buttons
        });
      } catch {
        // Message may be old
      }

      // DM user
      try {
        const user = await interaction.client.users.fetch(ticket.userId);
        const dmEmbed = new EmbedBuilder()
          .setColor("#ED4245")
          .setTitle("🔴 Ticket Closed")
          .setDescription(`Your ticket \`${ticketId}\` has been closed.`)
          .addFields({ name: "Title", value: ticket.title })
          .setFooter({ text: `From: ${interaction.guild.name}` })
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] });
      } catch {
        // DMs disabled
      }
      break;
    }
  }
}
