const { SlashCommandBuilder } = require("discord.js");
const djProposals = require("../../helpers/dj/proposals");
const djStore = require("../../helpers/dj/store");
const { buildProposalAnnouncement, buildProposalComponents, buildProposalEmbed } = require("../../helpers/dj/ui");
const { errorEmbed, successEmbed, playlistEmbed, songEmbed } = require("../../helpers/embeds");
const { getGuildState, updateGuildState } = require("../../helpers/guildState.js");
const { recordSearch } = require("../../helpers/history/searchHistory");
const { lavalinkPlay, lavalinkResolveTracks } = require("../../helpers/lavalink/index");
const { getPoru } = require("../../helpers/lavalink/players");
const Log = require("../../helpers/logs/log");
const statsStore = require("../../helpers/stats/store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube, Spotify, or SoundCloud")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("The URL or search term of the song to play")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("source")
        .setDescription("Search source (default: server preference)")
        .setRequired(false)
        .addChoices(
          { name: "🎵 Auto (Smart Selection)", value: "auto" },
          { name: "🎼 Deezer (FLAC Quality)", value: "deezer" },
          { name: "▶️ YouTube", value: "youtube" },
          { name: "🎧 Spotify", value: "spotify" }
        )
    )
    .addBooleanOption((option) =>
      option
        .setName("prepend")
        .setDescription("Add the track to the front of the queue instead of the back")
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();

    // Don't autocomplete if the query is too short
    if (!focusedValue || focusedValue.length < 2) {
      return interaction.respond([]);
    }

    // Skip autocomplete for URLs (YouTube, Spotify, SoundCloud links)
    if (
      focusedValue.startsWith("http://") ||
      focusedValue.startsWith("https://") ||
      focusedValue.includes("youtube.com") ||
      focusedValue.includes("youtu.be") ||
      focusedValue.includes("spotify.com") ||
      focusedValue.includes("soundcloud.com")
    ) {
      return interaction.respond([]);
    }

    try {
      // Check if user has selected a source
      const selectedSource = interaction.options.getString("source");

      // Determine which source to use for autocomplete
      let searchSource;
      if (selectedSource && selectedSource !== "auto") {
        // User explicitly chose a source - use it
        searchSource = selectedSource;
      } else {
        // No explicit choice - use server default
        const guildSettings = getGuildState(interaction.guildId);
        searchSource = guildSettings?.defaultSource || "deezer";
      }

      // Use direct Lavalink API to search based on determined source
      const poru = getPoru();
      const node = poru.leastUsedNodes[0];
      let results = null;

      if (node) {
        try {
          let searchQuery;

          // Build search query based on source
          switch (searchSource) {
            case "deezer":
              searchQuery = `dzsearch:${focusedValue}`;
              break;
            case "youtube":
              searchQuery = `ytsearch:${focusedValue}`;
              break;
            case "spotify":
              searchQuery = `spsearch:${focusedValue}`;
              break;
            case "auto":
            default:
              // Auto mode: Try Deezer first, fallback to YouTube
              searchQuery = `dzsearch:${focusedValue}`;
              break;
          }

          const searchUrl = `http://${node.options.host}:${
            node.options.port
          }/v4/loadtracks?identifier=${encodeURIComponent(searchQuery)}`;
          const response = await fetch(searchUrl, {
            headers: { Authorization: node.options.password },
          });
          const data = await response.json();

          if (data?.loadType === "search" && Array.isArray(data?.data) && data.data.length > 0) {
            // For auto mode with Deezer, combine with YouTube if results are few
            if (searchSource === "auto" && data.data.length < 3) {
              const ytResults = await poru.resolve({ query: focusedValue });
              const ytTracks = ytResults?.tracks || [];

              results = {
                loadType: "search",
                tracks: [...data.data, ...ytTracks],
              };
            } else {
              results = {
                loadType: data.loadType,
                tracks: data.data,
              };
            }
          } else if (searchSource === "auto") {
            // Deezer had no results in auto mode, try YouTube
            results = await poru.resolve({ query: focusedValue });
          }
        } catch {
          // Source search failed, fallback to default
        }
      }

      // Fallback to default search if source-specific search didn't work
      if (!results) {
        results = await poru.resolve({ query: focusedValue });
      }

      if (!results?.tracks || results.tracks.length === 0) {
        return interaction.respond([]);
      }

      // Take only first 15 tracks for faster processing
      const limitedTracks = results.tracks.slice(0, 15);

      // Filter out non-music content (tutorials, compilations, etc.)
      const musicTracks = limitedTracks.filter((track) => {
        const title = (track.info?.title || "").toLowerCase();
        const author = (track.info?.author || "").toLowerCase();

        // Skip non-music content
        if (
          title.includes("tutorial") ||
          title.includes("how to") ||
          title.includes("lesson") ||
          title.includes("compilation") ||
          (author.includes("topic") && title.includes("provided to youtube"))
        ) {
          return false;
        }

        return true;
      });

      // Deduplicate by artist + title
      const seen = new Set();
      const uniqueTracks = [];

      for (const track of musicTracks) {
        const author = (track.info?.author || "Unknown Artist").trim();
        const title = (track.info?.title || "Unknown").trim();

        // Create a normalized key for deduplication
        const normalizedAuthor = author.toLowerCase().replace(/\s+/g, "");
        const normalizedTitle = title.toLowerCase().replace(/\s+/g, "");
        const key = `${normalizedAuthor}|||${normalizedTitle}`;

        if (!seen.has(key)) {
          seen.add(key);
          uniqueTracks.push(track);

          // Stop at 10 unique tracks for faster response
          if (uniqueTracks.length >= 10) break;
        }
      }

      // Format results for autocomplete
      const choices = uniqueTracks.map((track) => {
        const title = track.info?.title || "Unknown";
        const author = track.info?.author || "Unknown Artist";

        // Truncate if too long (Discord has 100 char limit)
        let displayName = `${title} - ${author}`;
        if (displayName.length > 100) {
          displayName = displayName.substring(0, 97) + "...";
        }

        // Use "artist title" as the value
        let value = `${author} ${title}`;
        if (value.length > 100) {
          value = value.substring(0, 100);
        }

        return {
          name: displayName,
          value: value,
        };
      });

      await interaction.respond(choices);
    } catch (error) {
      Log.error("Autocomplete error in /play", error);
      // Return empty array on error to avoid blocking the user
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    Log.info(
      "🎵 /play command",
      `user=${interaction.user.tag}`,
      `guild=${interaction.guild.name}`,
      `id=${interaction.guild.id}`
    );

    await interaction.deferReply();

    const query = await interaction.options.getString("query");
    const voiceChannel = await interaction.member.voice.channel;

    if (!voiceChannel)
      return interaction.editReply({
        embeds: [errorEmbed("You must be in a voice channel to use this command.")],
      });

    if (!query || query.trim() === "")
      return interaction.editReply({ embeds: [errorEmbed("Please provide a valid URL or search term.")] });

    const prepend = interaction.options.getBoolean("prepend") ?? false;

    // Get source preference
    const selectedSource = interaction.options.getString("source");
    let source;
    if (selectedSource && selectedSource !== "auto") {
      source = selectedSource;
    } else {
      const guildSettings = getGuildState(interaction.guildId);
      source = guildSettings?.defaultSource || "deezer";
    }

    const requester = {
      id: interaction.user.id,
      tag: interaction.user.tag,
      avatar: interaction.user.displayAvatarURL({ size: 256 }),
    };

    const config = djStore.getGuildConfig(interaction.guild.id);
    const isDj = djStore.hasDjPermissions(interaction.member, config);

    if (config.enabled && !isDj) {
      try {
        const preview = await lavalinkResolveTracks(query, source);
        const proposal = djProposals.createProposal(interaction.guild.id, {
          query,
          prepend,
          requester,
          voiceChannelId: voiceChannel.id,
          textChannelId: interaction.channel.id,
          preview: {
            title: preview.track?.info?.title ?? query,
            url: preview.track?.info?.uri ?? null,
            isPlaylist: preview.isPlaylist,
            trackCount: preview.playlistTrackCount ?? preview.tracks.length,
            durationMs: preview.playlistDurationMs,
            source: preview.track?.info?.sourceName ?? null,
          },
        });

        const embed = buildProposalEmbed(proposal);
        const components = buildProposalComponents(interaction.guild.id, proposal.id);
        const announcement = buildProposalAnnouncement(proposal, config.roleId);

        const message = await interaction.channel.send({
          ...announcement,
          embeds: [embed],
          components,
        });

        djProposals.setMessageReference(interaction.guild.id, proposal.id, message.id, interaction.channel.id);

        return interaction.editReply({
          embeds: [successEmbed("Your suggestion has been sent to the DJ for approval.")],
          allowedMentions: { parse: [] },
        });
      } catch (error) {
        Log.error("Failed to prepare suggestion preview", error);
        return interaction.editReply({
          embeds: [errorEmbed("Could not prepare that track. Please try a different query.")],
        });
      }
    }

    try {
      const { track, player, isPlaylist, playlistInfo, playlistUrl, playlistTrackCount, playlistDurationMs } =
        await lavalinkPlay({
          guildId: interaction.guild.id,
          voiceId: voiceChannel.id,
          textId: interaction.channel.id,
          query: query,
          requester: requester,
          prepend: prepend,
          source: source,
        });

      if (!track || !track.info) {
        Log.warning("Lavalink returned a track without metadata", {
          guild: interaction.guild.id,
          query,
        });

        return interaction.editReply({
          embeds: [
            errorEmbed(
              "Track unavailable",
              "YouTube would not give me the metadata for that track. If it is age-restricted, I will keep trying another source automatically."
            ),
          ],
        });
      }

      track.info.loop = player.loop ?? "NONE";

      // Record search in history (for non-playlist single tracks)
      if (!isPlaylist && track) {
        recordSearch(requester.id, interaction.guild.id, query, track);
      }

      if (isPlaylist) {
        statsStore.trackPlaylistAdded(interaction.guild.id, playlistTrackCount);

        await interaction.editReply({
          embeds: [
            playlistEmbed({
              title: playlistInfo?.name ?? track.info.title ?? "Playlist",
              url: playlistUrl ?? playlistInfo?.url ?? track.info.uri,
              trackCount: playlistTrackCount,
              totalDurationMs: playlistDurationMs,
              requesterTag: requester.tag,
              requesterAvatar: requester.avatar,
              source: track.info?.sourceName ?? "Unknown",
            }),
          ],
        });
      } else {
        await interaction.editReply({ embeds: [songEmbed(track.info)] });
      }

      updateGuildState(interaction.guild.id, {
        nowPlayingChannel: interaction.channel.id,
      });
    } catch (error) {
      Log.error("Error in /play command:", error);
      return interaction.editReply({
        embeds: [errorEmbed("An error occurred while trying to play the song. Please try again later.")],
      });
    }
  },
};
