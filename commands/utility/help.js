const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require("discord.js");
const Log = require("../../helpers/logs/log");

const CATEGORIES = {
  playback: {
    label: "Playback Control",
    description: "Start and control what’s playing in voice channels.",
    emoji: "🎵",
    commands: [
      { name: "play", description: "Queue a track from a URL or search term.", usage: "/play query:<song or url>" },
      { name: "pause", description: "Pause the currently playing track.", usage: "/pause" },
      { name: "resume", description: "Resume playback if paused.", usage: "/resume" },
      { name: "stop", description: "Stop playback and leave the voice channel.", usage: "/stop" },
      { name: "skip", description: "Skip the current track.", usage: "/skip" },
      { name: "previous", description: "Replay the previous track or restart the current one.", usage: "/previous" },
      { name: "seekto", description: "Jump to a specific time in the current track.", usage: "/seekto position:<ms>" },
      { name: "volume", description: "Set the player volume (0‑100).", usage: "/volume amount:<number>" }
    ]
  },
  queue: {
    label: "Queue & Looping",
    description: "View and manage what’s in the queue.",
    emoji: "📜",
    commands: [
      { name: "queue", description: "Display the queue with pagination controls.", usage: "/queue" },
      { name: "clearqueue", description: "Remove every track from the queue.", usage: "/clearqueue" },
      { name: "shuffle", description: "Shuffle the current queue order.", usage: "/shuffle" },
      { name: "loop", description: "Cycle loop modes (none, track, queue).", usage: "/loop [mode]" }
    ]
  },
  filters: {
    label: "Equalizer & Effects",
    description: "Tune the sound using presets or per-band settings.",
    emoji: "🎚️",
    commands: [
      { name: "eq preset", description: "Apply an equalizer preset (bass, pop, edm…)", usage: "/eq preset name:<preset>" },
      { name: "eq set", description: "Adjust a single band gain (-0.25 to 1).", usage: "/eq set band:<0-14> gain:<value>" },
      { name: "eq reset", description: "Reset the equalizer back to flat.", usage: "/eq reset" }
    ]
  },
  utility: {
    label: "Utility",
    description: "Miscellaneous helpers for moderators and power users.",
    emoji: "🛠️",
    commands: [
      { name: "user", description: "Inspect a user’s profile, flags, and status.", usage: "/user user:<member>" }
    ]
  }
};

const DEFAULT_CATEGORY = "playback";

const buildCategoryMenu = (activeKey = DEFAULT_CATEGORY) => {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("help-category")
    .setPlaceholder("Select a command category");

  for (const [key, category] of Object.entries(CATEGORIES)) {
    menu.addOptions({
      label: category.label,
      value: key,
      description: category.description.slice(0, 100),
      emoji: category.emoji,
      default: key === activeKey
    });
  }

  return new ActionRowBuilder().addComponents(menu);
};

const buildCategoryEmbed = (categoryKey, user) => {
  const category =
    CATEGORIES[categoryKey] ?? CATEGORIES[DEFAULT_CATEGORY];

  const embed = new EmbedBuilder()
    .setColor(0xff4f8b)
    .setTitle(`Help • ${category.label}`)
    .setDescription(category.description);

  category.commands.forEach((command) => {
    embed.addFields({
      name: `/${command.name}`,
      value: `${command.description}\nUsage: \`${command.usage}\``
    });
  });

  embed.setFooter({
    text: `Requested by ${user.tag}`,
    iconURL: user.displayAvatarURL({ size: 128 })
  });

  return embed;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Browse all Neo Beat Buddy commands by category."),
  async execute(interaction) {
    Log.info(`/help command used by ${interaction.user.tag} in guild ${interaction.guild?.name ?? "DMs"}`);

    await interaction.deferReply({ ephemeral: true });

    const embed = buildCategoryEmbed(DEFAULT_CATEGORY, interaction.user);
    const menu = buildCategoryMenu(DEFAULT_CATEGORY);

    await interaction.editReply({
      embeds: [embed],
      components: [menu]
    });
  },
  async handleCategorySelect(interaction) {
    const selected = interaction.values[0];
    const embed = buildCategoryEmbed(selected, interaction.user);
    const menu = buildCategoryMenu(selected);

    await interaction.update({
      embeds: [embed],
      components: [menu]
    });
  }
};
