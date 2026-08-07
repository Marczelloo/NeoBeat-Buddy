const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { BRAND } = require("../../helpers/brand");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const {
  FILTER_PRESET_NAMES,
  getFilterPreset,
} = require("../../helpers/lavalink/filterPresets");
const { lavalinkResetEffects, lavalinkSetFilterPreset } = require("../../helpers/lavalink/index");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Apply fun Lavalink audio effects")
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List available audio effects")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("reset").setDescription("Turn off audio effects and keep the current EQ")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("preset")
        .setDescription("Apply a fun audio effect preset")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Effect preset")
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = FILTER_PRESET_NAMES.filter((name) => name.includes(focused)).map((name) => ({
      name: `${name} — ${getFilterPreset(name).description}`.substring(0, 100),
      value: name,
    }));

    return interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "list") {
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle("🎛️ Mewbit Audio Effects")
        .setDescription("Apply with `/filter preset name:<effect>`. Effects preserve your EQ settings.")
        .addFields(
          FILTER_PRESET_NAMES.map((name) => ({
            name: `✨ ${name}`,
            value: getFilterPreset(name).description,
            inline: true,
          }))
        )
        .setFooter({ text: "Use /filter reset to turn effects off" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const voiceGuard = await requireSharedVoice(interaction);
    if (!voiceGuard.ok) return interaction.editReply(voiceGuard.response);

    const djGuard = requireDj(interaction, { action: "change audio effects" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const guildId = interaction.guildId;

    if (subcommand === "reset") {
      const result = await lavalinkResetEffects(guildId);
      return interaction.editReply(
        result.status === "no_player" ? "❌ No music is currently playing." : "✅ Audio effects turned off. EQ kept."
      );
    }

    const presetName = interaction.options.getString("name").toLowerCase();
    const result = await lavalinkSetFilterPreset(guildId, presetName);

    if (result.status === "no_player") return interaction.editReply("❌ No music is currently playing.");
    if (result.status === "invalid_preset") return interaction.editReply("❌ Unknown audio effect preset.");

    return interaction.editReply(`✅ Applied **${presetName}** audio effect. EQ settings were preserved.`);
  },
};
