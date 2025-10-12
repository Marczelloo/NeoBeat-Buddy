const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getEqualizerState } = require("../lavalink/equalizerStore");
const PRESET_CHOICES = require("./presets");

const panelState = new Map();

const BAND_FREQUENCIES = [
  "25 Hz",
  "40 Hz",
  "63 Hz",
  "100 Hz",
  "160 Hz",
  "250 Hz",
  "400 Hz",
  "630 Hz",
  "1 kHz",
  "1.6 kHz",
  "2.5 kHz",
  "4 kHz",
  "6.3 kHz",
  "10 kHz",
  "16 kHz",
];

const TOTAL_BANDS = 15;

function ensurePanelState(guildId) {
  if (!panelState.has(guildId)) {
    panelState.set(guildId, {
      messageId: null,
      channelId: null,
      selectedBandIndex: 0,
      savedSnapshot: null,
      lastInteractionUserId: null,
      lastUpdate: Date.now(),
    });
  }
  return panelState.get(guildId);
}

function renderBandBar(gain) {
  const barLength = 21;
  const center = 4;

  const normalized = (gain + 0.25) / 1.25;
  const position = Math.round(normalized * (barLength - 1));
  const clampedPos = Math.max(0, Math.min(barLength - 1, position));

  let bar = "";
  for (let i = 0; i < barLength; i++) {
    if (i === center) {
      bar += i === clampedPos ? "●" : "┼";
    } else if (i === clampedPos) {
      bar += "●";
    } else if ((gain >= 0 && i > center && i < clampedPos) || (gain < 0 && i < center && i > clampedPos)) {
      bar += "─";
    } else {
      bar += "·";
    }
  }

  return `\`${bar}\``;
}

function formatGainValue(gain) {
  let db;
  if (gain >= 0) {
    db = gain * 6;
  } else {
    db = gain * 48;
  }

  return `${db >= 0 ? "+" : ""}${db.toFixed(1)} dB`;
}

function getCurrentPresetName(guildId) {
  const eqState = getEqualizerState(guildId);
  return eqState?.preset || "Custom";
}

function buildPanelEmbed(guildId) {
  const eqState = getEqualizerState(guildId);
  const currentBands = eqState?.equalizer || [];

  const bands = Array(15).fill(0);
  currentBands.forEach(({ band, gain }) => {
    if (band >= 0 && band < 15) bands[band] = gain;
  });

  const presetName = getCurrentPresetName(guildId);
  const state = ensurePanelState(guildId);
  const selectedBandIndex = state.selectedBandIndex || 0;

  let bandDisplay = "";
  for (let i = 0; i < TOTAL_BANDS; i++) {
    const freq = BAND_FREQUENCIES[i];
    const gain = bands[i];
    const bar = renderBandBar(gain);
    const value = formatGainValue(gain);

    const isSelected = i === selectedBandIndex;
    const prefix = isSelected ? "**►** " : "　 ";

    bandDisplay += `${prefix}**${freq.padEnd(7)}** ${bar} \`${value}\`\n`;
  }

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle(`🎚️ Mixer Panel – ${presetName}`)
    .setDescription(bandDisplay || "No data")
    .setFooter({ text: `Band ${selectedBandIndex + 1}/${TOTAL_BANDS} selected • Use ▲/▼ to navigate` })
    .setTimestamp();

  return embed;
}

function buildPresetSelectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("eq:preset:select")
      .setPlaceholder("Choose an EQ preset")
      .addOptions(
        PRESET_CHOICES.map((preset) => ({
          label: preset.charAt(0).toUpperCase() + preset.slice(1),
          value: preset,
          description: `Apply ${preset} preset`,
        }))
      )
  );
}

function buildBandSelectorRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("eq:band:prev").setLabel("▲ Up").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("eq:band:next").setLabel("▼ Down").setStyle(ButtonStyle.Secondary)
  );
}

function buildGainControlRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("eq:nudge:-").setLabel("– –").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("eq:nudge:-:shift").setLabel("–").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("eq:info")
      .setLabel("Selected Band")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder().setCustomId("eq:nudge:+:shift").setLabel("+").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("eq:nudge:+").setLabel("+ +").setStyle(ButtonStyle.Success)
  );
}

function buildUtilityRow(hasSnapshot) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("eq:ab:toggle")
      .setLabel("A/B")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasSnapshot),
    new ButtonBuilder().setCustomId("eq:save").setLabel("💾 Save").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("eq:reset").setLabel("🔄 Reset").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("eq:modal").setLabel("⚙️ Fine Tune").setStyle(ButtonStyle.Secondary)
  );
}

function buildPanelComponents(guildId) {
  const state = ensurePanelState(guildId);

  return [
    buildPresetSelectMenu(),
    buildBandSelectorRow(),
    buildGainControlRow(),
    buildUtilityRow(state.savedSnapshot !== null),
  ];
}

function deletePanelState(guildId) {
  panelState.delete(guildId);
}

function getPanelState(guildId) {
  return panelState.get(guildId);
}

function updatePanelState(guildId, updates) {
  const state = ensurePanelState(guildId);
  Object.assign(state, updates, { lastUpdate: Date.now() });
  panelState.set(guildId, state);
}

module.exports = {
  ensurePanelState,
  buildPanelEmbed,
  buildPanelComponents,
  deletePanelState,
  getPanelState,
  updatePanelState,
  BAND_FREQUENCIES,
  TOTAL_BANDS,
};
