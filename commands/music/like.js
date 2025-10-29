const { SlashCommandBuilder } = require("discord.js");
const { errorEmbed, successEmbed } = require("../../helpers/embeds");
const { getPlayer } = require("../../helpers/lavalink");
const { addTrack, getLikedSongs } = require("../../helpers/playlists/store");

module.exports = {
  data: new SlashCommandBuilder().setName("like").setDescription("Add the current track to your Liked Songs playlist"),

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

    // Add to Liked Songs
    const result = addTrack(userId, guildId, "Liked Songs", track);

    if (!result.success) {
      return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
    }

    const embed = successEmbed("Added to Liked Songs ❤️")
      .setDescription(`**${track.info.title}** by ${track.info.author}`)
      .setFooter({ text: "Use /playlist view name:Liked Songs to see all your liked tracks" });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
