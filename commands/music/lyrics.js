const { SlashCommandBuilder } = require("discord.js");
const { errorEmbed, lyricsEmbed } = require("../../helpers/embeds");
const { getPlayer } = require('../../helpers/lavalink/players');
const { getLyricsState } = require('../../helpers/lavalink/state');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Show lyrics for the currently playing song'),

        async execute(interaction)
        {
            await interaction.deferReply();

            const player = getPlayer(interaction.guildId);
            if(!player?.currentTrack) return interaction.editReply({ embeds: [errorEmbed('No track is currently playing.')] });

            const payload = getLyricsState(interaction.guildId);
            if (!payload || (!payload.lyrics && !payload.lines)) return interaction.editReply({ embeds: [errorEmbed('No lyrics were found for this track.')] });
            

            const text = payload.lyrics
                || (Array.isArray(payload.lines)
                    ? payload.lines.map((entry) => entry.line).join('\n')
                    : null);

            if (!text) return interaction.editReply({ embeds: [errorEmbed('The lyrics provider returned an empty result.')] });

            return interaction.editReply({
                embeds: [
                    lyricsEmbed(
                        `Lyrics — ${payload.track?.title ?? player.currentTrack.info.title}`,
                        text.slice(0, 1900),
                        payload?.source ? `Provider • ${payload.source}` : undefined
                    ),
                ],
            });
        }
}