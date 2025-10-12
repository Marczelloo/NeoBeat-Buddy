const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { lavalinkSetEqualizer, lavalinkResetFilters } = require("../lavalink/filters");
const PRESETS = require("./messages");
const { getEqualizerState } = require("../lavalink/equalizerStore");
const { buildPanelEmbed, buildPanelComponents, updatePanelState, getPanelState, TOTAL_BANDS } = require("./panel");
const { throttleEqUpdate } = require("./throttle");
const Log = require("../logs/log");

function bandsArrayToLavalink(bandsArray) {
  return bandsArray.map((gain, band) => ({ band, gain }));
}

async function handlePanelInteraction(interaction) {
  const guildId = interaction.guild.id;
  const customId = interaction.customId;

  if (customId === "eq:preset:select") {
    const preset = interaction.values[0];
    await handlePresetSelect(interaction, guildId, preset);
    return;
  }

  if (customId.startsWith("eq:band:")) {
    const direction = customId.split(":")[2];
    await handleBandSelect(interaction, guildId, direction);
    return;
  }

  if (customId.startsWith("eq:nudge:")) {
    const parts = customId.split(":");
    const direction = parts[2];
    const isShift = parts[3] === "shift";
    await handleGainNudge(interaction, guildId, direction, isShift);
    return;
  }

  if (customId === "eq:ab:toggle") {
    await handleABToggle(interaction, guildId);
    return;
  }

  if (customId === "eq:save") {
    await handleSaveSnapshot(interaction, guildId);
    return;
  }

  if (customId === "eq:reset") {
    await handleReset(interaction, guildId);
    return;
  }

  if (customId === "eq:modal") {
    await showFineTuneModal(interaction);
    return;
  }

  if (customId === "eq:finetune:submit") {
    await handleFineTuneSubmit(interaction, guildId);
    return;
  }
}

async function refreshPanel(interaction, guildId) {
  const state = getPanelState(guildId);
  if (!state) return;

  const embed = buildPanelEmbed(guildId);
  const components = buildPanelComponents(guildId);

  await interaction.update({ embeds: [embed], components });
}

async function handlePresetSelect(interaction, guildId, preset) {
  await lavalinkSetEqualizer(guildId, preset);
  await new Promise((resolve) => setTimeout(resolve, 50));
  await refreshPanel(interaction, guildId);
}

async function handleBandSelect(interaction, guildId, direction) {
  const state = getPanelState(guildId);
  if (!state) {
    await interaction.reply({ content: "❌ Panel state not found", ephemeral: true });
    return;
  }

  const currentIndex = state.selectedBandIndex || 0;
  const newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
  const clampedIndex = Math.max(0, Math.min(TOTAL_BANDS - 1, newIndex));

  updatePanelState(guildId, { selectedBandIndex: clampedIndex });
  await refreshPanel(interaction, guildId);
}

async function handleGainNudge(interaction, guildId, direction, isShift) {
  const eqState = getEqualizerState(guildId);
  const currentBands = eqState?.equalizer || [];

  const bands = Array(15).fill(0);
  currentBands.forEach(({ band, gain }) => {
    if (band >= 0 && band < 15) {
      bands[band] = Number(gain) || 0;
    }
  });

  const state = getPanelState(guildId);
  const selectedBandIndex = state?.selectedBandIndex || 0;

  const delta = isShift ? 0.083 : 0.166;
  const multiplier = direction === "+" ? 1 : -1;
  const change = delta * multiplier;

  const currentGain = Number(bands[selectedBandIndex]) || 0;
  const newGain = currentGain + change;

  Log.debug(`[EQ DEBUG] Band ${selectedBandIndex}: ${currentGain} → ${newGain} (change: ${change})`);

  bands[selectedBandIndex] = Math.max(-0.25, Math.min(1.0, newGain));

  throttleEqUpdate(guildId, async () => {
    await lavalinkSetEqualizer(guildId, bandsArrayToLavalink(bands));
  });

  setTimeout(async () => {
    try {
      const channel = await interaction.client.channels.fetch(interaction.channelId);
      const message = await channel.messages.fetch(interaction.message.id);

      const embed = buildPanelEmbed(guildId);
      const components = buildPanelComponents(guildId);

      await message.edit({ embeds: [embed], components });
    } catch (err) {
      // Ignore errors from refreshing
    }
  }, 250);

  await interaction.deferUpdate();
}

async function handleABToggle(interaction, guildId) {
  const state = getPanelState(guildId);
  if (!state?.savedSnapshot) {
    await interaction.reply({ content: "❌ No snapshot saved", ephemeral: true });
    return;
  }

  const eqState = getEqualizerState(guildId);
  const currentBands = eqState?.equalizer || [];

  const currentArray = Array(15).fill(0);
  currentBands.forEach(({ band, gain }) => {
    if (band >= 0 && band < 15) currentArray[band] = gain;
  });

  await lavalinkSetEqualizer(guildId, bandsArrayToLavalink(state.savedSnapshot));
  updatePanelState(guildId, { savedSnapshot: [...currentArray] });

  await new Promise((resolve) => setTimeout(resolve, 50));
  await refreshPanel(interaction, guildId);
}

async function handleSaveSnapshot(interaction, guildId) {
  const eqState = getEqualizerState(guildId);
  const currentBands = eqState?.equalizer || [];

  const bands = Array(15).fill(0);
  currentBands.forEach(({ band, gain }) => {
    if (band >= 0 && band < 15) bands[band] = gain;
  });

  updatePanelState(guildId, { savedSnapshot: [...bands] });

  const state = getPanelState(guildId);
  const embed = buildPanelEmbed(guildId);
  const components = buildPanelComponents(guildId);

  await interaction.update({ embeds: [embed], components });
  await interaction.followUp({ content: "✅ Snapshot saved! Use A/B to toggle.", ephemeral: true });
}

async function handleReset(interaction, guildId) {
  await lavalinkResetFilters(guildId);
  await new Promise((resolve) => setTimeout(resolve, 50));
  await refreshPanel(interaction, guildId);
}

async function showFineTuneModal(interaction) {
  const guildId = interaction.guild.id;
  const eqState = getEqualizerState(guildId);
  const currentBands = eqState?.equalizer || [];

  const bands = Array(15).fill(0);
  currentBands.forEach(({ band, gain }) => {
    if (band >= 0 && band < 15) bands[band] = gain;
  });

  const currentValues = bands.map((b) => b.toFixed(2)).join(", ");

  const modal = new ModalBuilder().setCustomId("eq:finetune:submit").setTitle("Fine Tune Equalizer");

  const input = new TextInputBuilder()
    .setCustomId("eq:bands:input")
    .setLabel("Enter 15 gain values (-0.25 to 1.0)")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(currentValues)
    .setPlaceholder("0, 0, 0.25, 0.5, 1.0, ...")
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleFineTuneSubmit(interaction, guildId) {
  const input = interaction.fields.getTextInputValue("eq:bands:input");
  const values = input.split(",").map((v) => parseFloat(v.trim()));

  if (values.length !== 15 || values.some((v) => isNaN(v) || v < -0.25 || v > 1.0)) {
    await interaction.reply({
      content: "❌ Invalid input. Please provide exactly 15 values between -0.25 and 1.0 (-12dB to +6dB)",
      ephemeral: true,
    });
    return;
  }

  await lavalinkSetEqualizer(guildId, bandsArrayToLavalink(values));
  await new Promise((resolve) => setTimeout(resolve, 50));

  const state = getPanelState(guildId);
  if (state?.messageId && state?.channelId) {
    const channel = await interaction.client.channels.fetch(state.channelId);
    const message = await channel.messages.fetch(state.messageId);

    const embed = buildPanelEmbed(guildId);
    const components = buildPanelComponents(guildId);

    await message.edit({ embeds: [embed], components });
  }

  await interaction.reply({ content: "✅ Equalizer updated!", ephemeral: true });
}

module.exports = {
  handlePanelInteraction,
};
