const { SlashCommandBuilder } = require("discord.js");
const { ITEMS_PER_PAGE, buildQueueControls, decodeQueueId } = require("../../helpers/components/queue");
const djProposals = require("../../helpers/dj/proposals");
const djStore = require("../../helpers/dj/store");
const { buildPendingSuggestionsField } = require("../../helpers/dj/ui");
const { errorEmbed, queueEmbed, successEmbed } = require("../../helpers/embeds");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { createPoru } = require("../../helpers/lavalink/index");
const { playbackState } = require("../../helpers/lavalink/state");
const Log = require("../../helpers/logs/log");
const { createPlaylist, addTrack } = require("../../helpers/playlists/store");

async function renderQueue(interaction, player, page = 0) {
  const totalPages = Math.max(1, Math.ceil(player.queue.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);

  const embed = queueEmbed({
    currentTrack: player.currentTrack,
    isPlaying: player.isPlaying,
    queue: player.queue,
    page: safePage,
    totalPages,
    requesterId: interaction.user.id,
  });

  const config = djStore.getGuildConfig(interaction.guildId);
  if (config.enabled) {
    const field = buildPendingSuggestionsField(djProposals.listProposals(interaction.guildId));
    if (field) {
      embed.addFields(field);
    }
  }

  const components = buildQueueControls(safePage, totalPages, interaction.guildId, interaction.user.id);

  return { embed, components, page: safePage, totalPages };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Manage the music queue")

    .addSubcommand((subcommand) => subcommand.setName("view").setDescription("Show the current music queue"))

    .addSubcommand((subcommand) =>
      subcommand
        .setName("export")
        .setDescription("Export current session (queue + history) to a playlist")
        .addStringOption((option) => option.setName("name").setDescription("Playlist name").setRequired(true))
        .addBooleanOption((option) =>
          option
            .setName("include-current")
            .setDescription("Include currently playing track (default: true)")
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "export") {
      return handleExport(interaction);
    }

    // Default: view queue
    Log.info("/queue command used by " + interaction.user.tag + " in guild " + interaction.guild.name);

    await interaction.deferReply({ ephemeral: true });

    const guard = await requireSharedVoice(interaction);
    if (!guard.ok) return interaction.editReply(guard.response);

    const poru = createPoru(interaction.client);
    const player = poru.players.get(interaction.guild.id);
    if (!player || (!player.isPlaying && player.queue.length === 0)) {
      return interaction.editReply({ embeds: [errorEmbed("The queue is empty.")] });
    }

    const { embed, components } = await renderQueue(interaction, player, 0);
    await interaction.editReply({ embeds: [embed], components });
  },
  async handlePaginationButtons(interaction) {
    const data = decodeQueueId(interaction.customId);
    if (!data) return interaction.reply({ content: "Invalid button.", ephemeral: true });

    if (interaction.user.id !== data.userId) {
      return interaction.reply({
        content: "Only the user who initiated the command can use these buttons.",
        ephemeral: true,
      });
    }

    const poru = createPoru(interaction.client);
    const player = poru.players.get(data.guildId);

    if (!player || (!player.currentTrack && player.queue.length === 0)) {
      return interaction.update({
        embeds: [errorEmbed("The queue is empty.")],
        components: [],
      });
    }

    const { embed, components } = await renderQueue(interaction, player, data.page);
    await interaction.update({ embeds: [embed], components });
  },
};

async function handleExport(interaction) {
  const playlistName = interaction.options.getString("name");
  const includeCurrent = interaction.options.getBoolean("include-current") ?? true;

  await interaction.deferReply();

  const guard = await requireSharedVoice(interaction);
  if (!guard.ok) return interaction.editReply(guard.response);

  const poru = createPoru(interaction.client);
  const player = poru.players.get(interaction.guild.id);

  if (!player) {
    return interaction.editReply({ embeds: [errorEmbed("No active player session.")] });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  // Get session data
  const sessionState = playbackState.get(guildId) || {};
  const history = sessionState.history || [];
  const currentTrack = player.currentTrack;
  const queue = player.queue || [];

  // Collect all tracks
  const allTracks = [];

  // Add history
  if (history.length > 0) {
    allTracks.push(...history.map((t) => ({ ...t, fromHistory: true })));
  }

  // Add current track
  if (includeCurrent && currentTrack) {
    allTracks.push({ ...currentTrack, fromCurrent: true });
  }

  // Add queue
  if (queue.length > 0) {
    allTracks.push(...queue.map((t) => ({ ...t, fromQueue: true })));
  }

  if (allTracks.length === 0) {
    return interaction.editReply({
      embeds: [errorEmbed("No tracks to export. Play some music first!")],
    });
  }

  // Create playlist
  const createResult = createPlaylist(userId, guildId, playlistName, {
    type: "user",
    description: `Exported from session on ${new Date().toLocaleDateString()}`,
    public: false,
  });

  if (!createResult.success) {
    return interaction.editReply({ embeds: [errorEmbed(createResult.error)] });
  }

  // Remove duplicates by title+author combination (more reliable than identifier)
  const uniqueTracks = [];
  const seen = new Set();

  for (const track of allTracks) {
    // Skip if track doesn't have required info
    if (!track.info?.title || !track.info?.author) {
      continue;
    }

    // Create unique key based on title+author (case-insensitive)
    // Normalize whitespace and special characters for better matching
    const title = track.info.title.toLowerCase().trim().replace(/\s+/g, " ");
    const author = track.info.author.toLowerCase().trim().replace(/\s+/g, " ");
    const uniqueKey = `${title}|||${author}`;

    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      uniqueTracks.push(track);
    }
  }

  // Add all unique tracks
  let addedCount = 0;
  let skippedCount = 0;
  const duplicatesRemoved = allTracks.length - uniqueTracks.length;

  for (const track of uniqueTracks) {
    const result = addTrack(userId, guildId, playlistName, track);

    if (result.success) {
      addedCount++;
    } else {
      skippedCount++;
    }
  }

  const embed = successEmbed(`Exported session to playlist`)
    .setDescription(`Created playlist **${playlistName}**`)
    .addFields(
      { name: "Tracks Added", value: addedCount.toString(), inline: true },
      { name: "Duplicates Removed", value: duplicatesRemoved.toString(), inline: true },
      { name: "Total Processed", value: allTracks.length.toString(), inline: true }
    );

  if (skippedCount > 0) {
    embed.addFields({ name: "Skipped (Errors)", value: skippedCount.toString(), inline: true });
  }

  if (history.length > 0) {
    embed.addFields({ name: "From History", value: history.length.toString(), inline: true });
  }
  if (includeCurrent && currentTrack) {
    embed.addFields({ name: "Current Track", value: "Included", inline: true });
  }
  if (queue.length > 0) {
    embed.addFields({ name: "From Queue", value: queue.length.toString(), inline: true });
  }

  Log.info(`/queue export used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

  return interaction.editReply({ embeds: [embed] });
}
