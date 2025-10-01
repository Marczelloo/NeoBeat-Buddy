const { SlashCommandBuilder } = require("discord.js");
const { errorEmbed } = require("../../helpers/embeds");
const { requireSharedVoice } = require("../../helpers/interactions/voiceGuards");
const { buildLyricsResponse } = require('../../helpers/lavalink/lyricsFormatter');
const { getPlayer } = require('../../helpers/lavalink/players');
const { getLyricsState } = require('../../helpers/lavalink/state');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Show lyrics for the currently playing song'),

    async execute(interaction) 
    {
        await interaction.deferReply();

        const guard = await requireSharedVoice(interaction);
        if(!guard.ok) return interaction.editReply(guard.response);

        const player = getPlayer(interaction.guildId);
    
        if (!player?.currentTrack) return interaction.editReply({ embeds: [errorEmbed('No track is currently playing.')] });
        
        const payload = getLyricsState(interaction.guildId);

        if (!payload || (!payload.lyrics && !payload.lines)) return interaction.editReply({ embeds: [errorEmbed('No lyrics were found for this track.')] });

        const text = payload.lyrics
            || (Array.isArray(payload.lines)
                ? payload.lines.map((entry) => entry.line).join('\n')
                : null);

        if (!text) return interaction.editReply({ embeds: [errorEmbed('The lyrics provider returned an empty result.')] });
        

        const trackTitle = payload.track?.title
            ?? player.currentTrack?.info?.title
            ?? 'Unknown track';

        const { embeds, content } = buildLyricsResponse({
            text,
            provider: payload?.source,
            trackTitle,
        });

        if (!embeds.length) return interaction.editReply({ embeds: [errorEmbed('The lyrics provider returned an empty result.')], content: null });
        

        return interaction.editReply({
            content,
            embeds,
        });
    },
};