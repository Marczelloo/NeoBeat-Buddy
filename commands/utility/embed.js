const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const Log = require("../../helpers/logs/log");

// Temporary storage for embed options (cleared after modal submission)
const pendingEmbeds = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Send a custom embedded message to a channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to send the embed to")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("Embed color (hex code like #5865F2 or name)")
        .setRequired(false)
        .addChoices(
          { name: "🔵 Blurple (Discord)", value: "#5865F2" },
          { name: "🟢 Green (Success)", value: "#57F287" },
          { name: "🔴 Red (Error)", value: "#ED4245" },
          { name: "🟡 Yellow (Warning)", value: "#FEE75C" },
          { name: "🟣 Fuchsia", value: "#EB459E" },
          { name: "⚪ White", value: "#FFFFFF" },
          { name: "⚫ Dark", value: "#2C2F33" },
          { name: "🎵 Neo Beat Purple", value: "#9B59B6" }
        )
    )
    .addStringOption((option) =>
      option.setName("image").setDescription("URL of an image to include in the embed").setRequired(false)
    )
    .addStringOption((option) =>
      option.setName("thumbnail").setDescription("URL of a thumbnail image (small, top-right)").setRequired(false)
    )
    .addBooleanOption((option) =>
      option.setName("timestamp").setDescription("Add a timestamp to the embed footer").setRequired(false)
    ),

  pendingEmbeds, // Export for access in interactionCreate

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel");

    // Check bot permissions in target channel
    const botMember = interaction.guild.members.me;
    const permissions = channel.permissionsFor(botMember);

    if (!permissions.has("SendMessages") || !permissions.has("EmbedLinks")) {
      return interaction.reply({
        content: `❌ I don't have permission to send embeds in ${channel}. I need **Send Messages** and **Embed Links** permissions.`,
        ephemeral: true,
      });
    }

    // Store options for the modal handler using interaction ID
    const embedOptions = {
      channelId: channel.id,
      color: interaction.options.getString("color") || "#5865F2",
      image: interaction.options.getString("image") || null,
      thumbnail: interaction.options.getString("thumbnail") || null,
      timestamp: interaction.options.getBoolean("timestamp") || false,
    };

    // Store with user ID as key (user can only have one pending embed at a time)
    pendingEmbeds.set(interaction.user.id, embedOptions);

    // Clean up after 5 minutes to prevent memory leaks
    setTimeout(() => pendingEmbeds.delete(interaction.user.id), 5 * 60 * 1000);

    // Create modal for title and description
    const modal = new ModalBuilder().setCustomId("embed_modal").setTitle("Create Custom Embed");

    const titleInput = new TextInputBuilder()
      .setCustomId("embed_title")
      .setLabel("Title")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter embed title...")
      .setMaxLength(256)
      .setRequired(true);

    const descriptionInput = new TextInputBuilder()
      .setCustomId("embed_description")
      .setLabel("Description")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter embed description... (supports Discord markdown)")
      .setMaxLength(4000)
      .setRequired(true);

    const footerInput = new TextInputBuilder()
      .setCustomId("embed_footer")
      .setLabel("Footer Text (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Optional footer text...")
      .setMaxLength(2048)
      .setRequired(false);

    const authorInput = new TextInputBuilder()
      .setCustomId("embed_author")
      .setLabel("Author Name (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Optional author name...")
      .setMaxLength(256)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descriptionInput),
      new ActionRowBuilder().addComponents(footerInput),
      new ActionRowBuilder().addComponents(authorInput)
    );

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    try {
      // Get options from pending storage
      const options = pendingEmbeds.get(interaction.user.id);

      if (!options) {
        return interaction.reply({
          content: "❌ Embed session expired. Please run `/embed` again.",
          ephemeral: true,
        });
      }

      // Clean up
      pendingEmbeds.delete(interaction.user.id);

      const title = interaction.fields.getTextInputValue("embed_title");
      const description = interaction.fields.getTextInputValue("embed_description");
      const footer = interaction.fields.getTextInputValue("embed_footer") || null;
      const author = interaction.fields.getTextInputValue("embed_author") || null;

      const channel = await interaction.guild.channels.fetch(options.channelId);

      if (!channel) {
        return interaction.reply({
          content: "❌ Channel not found. It may have been deleted.",
          ephemeral: true,
        });
      }

      // Helper to validate URLs
      const isValidUrl = (url) => {
        if (!url) return false;
        try {
          const parsed = new URL(url);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      };

      // Build the embed
      const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(options.color);

      // Only set image/thumbnail if URLs are valid
      if (options.image && isValidUrl(options.image)) {
        embed.setImage(options.image);
      }

      if (options.thumbnail && isValidUrl(options.thumbnail)) {
        embed.setThumbnail(options.thumbnail);
      }

      if (options.timestamp) {
        embed.setTimestamp();
      }

      if (footer) {
        embed.setFooter({ text: footer });
      }

      if (author) {
        embed.setAuthor({ name: author });
      }

      // Send the embed
      const message = await channel.send({ embeds: [embed] });

      Log.info(
        `Embed sent by ${interaction.user.tag} to #${channel.name} in ${interaction.guild.name}`,
        "embed",
        interaction.guild.id
      );

      await interaction.reply({
        content: `✅ Embed sent to ${channel}!\n🔗 [Jump to message](${message.url})`,
        ephemeral: true,
      });
    } catch (error) {
      Log.error("Failed to send embed", error);

      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.message.includes("one or more errors")) {
        errorMessage = "Invalid embed content. Check that any URLs (image/thumbnail) are valid and accessible.";
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: `❌ Failed to send embed: ${errorMessage}`,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: `❌ Failed to send embed: ${errorMessage}`,
          ephemeral: true,
        });
      }
    }
  },
};
