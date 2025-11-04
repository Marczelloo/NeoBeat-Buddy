const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getUserPresetNames, loadUserPreset, deleteUserPreset } = require("../../helpers/equalizer/customPresets");
const PRESET_CHOICES = require("../../helpers/equalizer/presets");
const { requireDj } = require("../../helpers/interactions/djGuards");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { lavalinkSetEqualizer, lavalinkResetFilters } = require("../../helpers/lavalink/index");
const Log = require("../../helpers/logs/log");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("eq")
    .setDescription("Adjust the music equalizer")
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List all available built-in EQ presets"))
    .addSubcommand((subcommand) => subcommand.setName("reset").setDescription("Reset the music equalizer to flat"))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("preset")
        .setDescription("Apply a preset equalizer setting")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Preset name (built-in or your custom preset)")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) => subcommand.setName("mypresets").setDescription("List your custom saved presets"))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete one of your custom presets")
        .addStringOption((option) =>
          option.setName("name").setDescription("Custom preset name to delete").setRequired(true).setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand();

    if (focusedOption.name === "name") {
      const userPresets = getUserPresetNames(interaction.user.id);
      let choices = [];

      if (subcommand === "preset") {
        const builtInChoices = PRESET_CHOICES.map((name) => ({
          name: `${name} (built-in)`,
          value: name,
        }));

        const customChoices = userPresets.map((name) => ({
          name: `${name} (custom)`,
          value: name,
        }));

        choices = [...builtInChoices, ...customChoices];
      } else if (subcommand === "delete") {
        choices = userPresets.map((name) => ({
          name: name,
          value: name,
        }));

        if (choices.length === 0) {
          choices = [{ name: "No custom presets saved yet", value: "none" }];
        }
      }

      const filtered = focusedOption.value
        ? choices.filter(
            (choice) =>
              choice.value !== "none" && choice.value.toLowerCase().includes(focusedOption.value.toLowerCase())
          )
        : choices;

      const limited = filtered.slice(0, 25);

      await interaction.respond(limited);
    }
  },

  async execute(interaction) {
    Log.info(
      "🎚️ /eq command",
      `user=${interaction.user.tag}`,
      `guild=${interaction.guild.name}`,
      `id=${interaction.guild.id}`
    );

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "list") {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🎚️ Built-in EQ Presets")
        .setDescription(
          "Use `/eq preset name:<preset>` to apply any of these presets.\n" +
            "Use `/eqpanel` to create custom presets with precise control."
        )
        .addFields([
          {
            name: "General",
            value: "`flat` • `acoustic` • `classical` • `piano` • `vocal` • `podcast` • `smallspeakers`",
            inline: false,
          },
          {
            name: "Genre-Based",
            value: "`pop` • `rock` • `jazz` • `dance` • `electronic` • `edm` • `hiphop` • `rnb` • `latin`",
            inline: false,
          },
          {
            name: "Bass & Treble",
            value: "`bass` • `bassboost` • `deep` • `treble`",
            inline: false,
          },
          {
            name: "Special",
            value: "`lofi` • `nightcore`",
            inline: false,
          },
        ])
        .setFooter({ text: `Total: ${PRESET_CHOICES.length} built-in presets available` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === "mypresets") {
      const userPresets = getUserPresetNames(interaction.user.id);

      if (userPresets.length === 0) {
        return interaction.editReply({
          content:
            "❌ You don't have any custom presets saved.\n" +
            "Use `/eqpanel` and click **📁 Save Preset** to create one!",
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("📁 Your Custom EQ Presets")
        .setDescription(userPresets.map((name, i) => `${i + 1}. \`${name}\``).join("\n"))
        .addFields([
          {
            name: "How to Use",
            value:
              "**Load:** `/eq preset name:" +
              userPresets[0] +
              "`\n" +
              "**Delete:** `/eq delete name:" +
              userPresets[0] +
              "`",
            inline: false,
          },
        ])
        .setFooter({ text: `${userPresets.length}/10 custom presets saved` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === "delete") {
      const presetName = interaction.options.getString("name").toLowerCase();

      if (presetName === "none") {
        return interaction.editReply({
          content: "❌ You don't have any custom presets to delete.",
        });
      }

      const result = deleteUserPreset(interaction.user.id, presetName);

      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.error}` });
      }

      return interaction.editReply({ content: `✅ Deleted custom preset **${presetName}**` });
    }

    const guard = await requireSharedVoice(interaction);
    if (!guard.ok) return interaction.editReply(guard.response);

    const djGuard = requireDj(interaction, { action: "adjust the equalizer" });
    if (!djGuard.ok) return interaction.editReply(djGuard.response);

    const guildId = interaction.guildId;

    if (subcommand === "reset") {
      const result = await lavalinkResetFilters(guildId);
      return interaction.editReply(
        result.status === "no_player" ? "❌ No music is currently playing." : "✅ Equalizer reset to flat."
      );
    }

    if (subcommand === "preset") {
      const presetName = interaction.options.getString("name").toLowerCase();

      const customPreset = loadUserPreset(interaction.user.id, presetName);

      let payload;
      let isCustom = false;

      if (customPreset) {
        payload = customPreset.bands.map((gain, band) => ({ band, gain }));
        isCustom = true;
      } else {
        payload = presetName;
      }

      const result = await lavalinkSetEqualizer(guildId, payload);

      if (result.status === "no_player") {
        return interaction.editReply({ content: "❌ No music is currently playing." });
      }

      if (result.status === "invalid_preset" && !isCustom) {
        return interaction.editReply({
          content:
            `❌ Preset **${presetName}** not found.\n\n` +
            `Use \`/eq list\` to see all built-in presets.\n` +
            `Use \`/eq mypresets\` to see your custom presets.`,
        });
      }

      return interaction.editReply(`✅ Applied **${presetName}** preset ${isCustom ? "(custom)" : "(built-in)"}`);
    }
  },
};
