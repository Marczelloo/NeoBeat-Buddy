const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { errorEmbed, successEmbed } = require("../../helpers/embeds");
const { getPlayer } = require("../../helpers/lavalink");
const { addTrack, removeTrack, getLikedSongs, isTrackInPlaylist } = require("../../helpers/playlists/store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("like")
    .setDescription("Add or remove the current track from your Liked Songs playlist"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    // Get current playing track
    const player = getPlayer(guildId);
    if (!player || !player.currentTrack) {
      return interaction.reply({
        embeds: [errorEmbed("No track is currently playing.")],
        ephemeral: true,
      });
    }

    const track = player.currentTrack;

    // Ensure Liked Songs playlist exists (auto-creates if needed)
    getLikedSongs(userId);

    // Check if track is already liked
    const checkResult = isTrackInPlaylist(userId, guildId, "Liked Songs", track);

    if (checkResult.exists) {
      // Track is already liked - ask for confirmation to remove
      const embed = successEmbed("💔 Unlike this track?").setDescription(
        `**${track.info.title}** by ${track.info.author}\n\nThis track is already in your Liked Songs. Do you want to remove it?`
      );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`unlike-confirm:${checkResult.position}`)
          .setLabel("Remove from Liked Songs")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("💔"),
        new ButtonBuilder().setCustomId("unlike-cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    } else {
      // Track is not liked - add it
      const result = addTrack(userId, guildId, "Liked Songs", track);

      if (!result.success) {
        return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
      }

      const embed = successEmbed("Added to Liked Songs ❤️")
        .setDescription(`**${track.info.title}** by ${track.info.author}`)
        .setFooter({ text: "Use /playlist view name:Liked Songs to see all your liked tracks" });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
