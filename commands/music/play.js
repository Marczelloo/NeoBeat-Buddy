const { SlashCommandBuilder } = require("discord.js");
const djProposals = require("../../helpers/dj/proposals");
const djStore = require("../../helpers/dj/store");
const { buildProposalAnnouncement, buildProposalComponents, buildProposalEmbed } = require("../../helpers/dj/ui");
const { errorEmbed, successEmbed, playlistEmbed, songEmbed } = require("../../helpers/embeds");
const { updateGuildState } = require("../../helpers/guildState.js");
const { lavalinkPlay, lavalinkResolveTracks } = require("../../helpers/lavalink/index");
const Log = require("../../helpers/logs/log");
const statsStore = require("../../helpers/stats/store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube, Spotify, or SoundCloud")
    .addStringOption((option) =>
      option.setName("query").setDescription("The URL or search term of the song to play").setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("prepend")
        .setDescription("Add the track to the front of the queue instead of the back")
        .setRequired(false)
    ),

  async execute(interaction) {
    Log.info("/play command used by " + interaction.user.tag + " in guild " + interaction.guild.name);

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

    const requester = {
      id: interaction.user.id,
      tag: interaction.user.tag,
      avatar: interaction.user.displayAvatarURL({ size: 256 }),
    };

    const config = djStore.getGuildConfig(interaction.guild.id);
    const isDj = djStore.hasDjPermissions(interaction.member, config);

    if (config.enabled && !isDj) {
      try {
        const preview = await lavalinkResolveTracks(query);
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
