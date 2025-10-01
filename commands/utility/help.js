const { SlashCommandBuilder} = require("discord.js");
const { helpCategoryEmbed } = require("../../helpers/embeds");
const { DEFAULT_CATEGORY, CATEGORIES } = require("../../helpers/help/categories");
const { buildCategoryMenu } = require("../../helpers/help/help");
const Log = require("../../helpers/logs/log");

const initialCategory = CATEGORIES[DEFAULT_CATEGORY];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Browse all Neo Beat Buddy commands by category."),
  async execute(interaction) {
    Log.info(`/help command used by ${interaction.user.tag} in guild ${interaction.guild?.name ?? "DMs"}`);

    await interaction.deferReply({ ephemeral: true });

    const embed = helpCategoryEmbed(initialCategory, interaction.user);
    const menu = buildCategoryMenu(DEFAULT_CATEGORY);

    await interaction.editReply({
      embeds: [embed],
      components: [menu]
    });
  },
  async handleCategorySelect(interaction) {
    const selectedKey = interaction.values[0] ?? DEFAULT_CATEGORY;
    const embed = helpCategoryEmbed(CATEGORIES[selectedKey] ?? initialCategory, interaction.user);
    const menu = buildCategoryMenu(selectedKey);

    await interaction.update({
      embeds: [embed],
      components: [menu]
    });
  }
};
