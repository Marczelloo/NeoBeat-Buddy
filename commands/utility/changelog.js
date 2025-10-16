const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const {
  getAllVersions,
  buildPatchNotesEmbed,
  buildPatchNotesButtons,
  getCurrentVersion,
} = require("../../helpers/announcements/announcer");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("changelog")
    .setDescription("View bot patch notes and update history")
    .addStringOption((option) =>
      option
        .setName("version")
        .setDescription("Specific version to view (defaults to latest)")
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const allVersions = getAllVersions();
    const focusedValue = interaction.options.getFocused().toLowerCase();

    // Show up to 20 versions (most recent + initial if space)
    let choices = allVersions.slice(0, 19); // First 19 versions

    // Add initial version (1.0.0) at the end if not already included
    const initialVersion = allVersions[allVersions.length - 1];
    if (choices.length < allVersions.length && !choices.includes(initialVersion)) {
      choices.push(initialVersion);
    }

    // Filter based on user input
    const filtered = choices
      .filter((version) => version.toLowerCase().includes(focusedValue))
      .map((version) => ({
        name: `v${version}`,
        value: version,
      }));

    await interaction.respond(filtered.slice(0, 25));
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const requestedVersion = interaction.options.getString("version");
    const allVersions = getAllVersions();

    if (allVersions.length === 0) {
      return interaction.editReply({
        content: "❌ No patch notes available.",
      });
    }

    // Determine which version to show
    let version = requestedVersion || getCurrentVersion();
    let versionIndex = allVersions.indexOf(version);

    // If requested version doesn't exist, show latest
    if (versionIndex === -1) {
      version = allVersions[0];
      versionIndex = 0;

      if (requestedVersion) {
        await interaction.editReply({
          content: `⚠️ Version \`${requestedVersion}\` not found. Showing latest version instead.`,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Build embed and buttons
    const embed = buildPatchNotesEmbed(version, versionIndex, allVersions.length);
    const linkButtons = buildPatchNotesButtons(version, false);

    // Add navigation buttons if there are multiple versions
    const components = [linkButtons];

    if (allVersions.length > 1) {
      const navButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("changelog:prev")
          .setLabel("◀ Older")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(versionIndex === allVersions.length - 1),
        new ButtonBuilder()
          .setCustomId("changelog:current")
          .setLabel("Latest")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(versionIndex === 0),
        new ButtonBuilder()
          .setCustomId("changelog:next")
          .setLabel("Newer ▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(versionIndex === 0)
      );

      components.push(navButtons);
    }

    await interaction.editReply({
      content: versionIndex === 0 ? `📢 **Latest Version: v${version}**` : `📜 **Version: v${version}**`,
      embeds: [embed],
      components,
    });
  },
};
