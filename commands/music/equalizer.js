const { SlashCommandBuilder } = require("discord.js");
const PRESET_CHOICES = require("../../helpers/equalizer/presets");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { lavalinkSetEqualizer, lavalinkResetFilters } = require("../../helpers/lavalink/index");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("eq")
    .setDescription("Adjust the music equalizer in real time.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set the music equalizer.")
        .addIntegerOption((option) =>
          option.setName("band").setDescription("The band to adjust (0-14).").setRequired(true)
        )
        .addNumberOption((option) =>
          option.setName("gain").setDescription("The gain to apply (-0.25 to 1.0).").setRequired(true)
        )
    )
    .addSubcommand((subcommand) => subcommand.setName("reset").setDescription("Reset the music equalizer."))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("preset")
        .setDescription("Apply a preset equalizer setting.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the preset to apply [bass, treble, nightcore].")
            .setRequired(true)
            .addChoices(...PRESET_CHOICES.map((name) => ({ name, value: name })))
        )
    ),

  async execute(interaction) {
    Log.info(`/eq command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

    await interaction.deferReply({ ephemeral: true });

    const guard = await requireSharedVoice(interaction);
    if (!guard.ok) return interaction.editReply(guard.response);

    const djGuard = requireDj(interaction, { action: "adjust the equalizer" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const preset = interaction.options.getString("name");
    const band = interaction.options.getInteger("band");
    const gain = interaction.options.getNumber("gain");

    const guildId = interaction.guildId;
    const payload = preset ? preset : band !== null && gain !== null ? [{ band, gain }] : null;

    if (interaction.options.getSubcommand() === "reset") {
      const result = await lavalinkResetFilters(guildId);
      return interaction.editReply(
        result.status === "no_player" ? "No music is currently playing." : "Equalizer restored to default."
      );
    }

    if (!payload) {
      return interaction.editReply({
        content: "Invalid command usage. Please specify a preset or both band and gain values.",
      });
    }

    const result = await lavalinkSetEqualizer(guildId, payload);
    if (result.status === "no_player") {
      return interaction.editReply({ content: "No music is currently playing." });
    }

    if (result.status === "invalid_preset") {
      return interaction.editReply({
        content: "Preset not recognized. Available presets: bass, treble, nightcore.",
      });
    }

    return interaction.editReply(
      preset ? `Applied **${preset}** preset to the equalizer.` : `Set band **${band}** to gain **${gain}**.`
    );
  },
};
