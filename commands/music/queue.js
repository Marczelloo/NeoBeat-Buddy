const { SlashCommandBuilder } = require('discord.js');
const Log = require('../../helpers/logs/log');
const { createPoru } = require('../../helpers/lavalinkManager');
const { errorEmbed } = require('../../helpers/embeds');
const { fomratDuration, formatDuration } = require('../../helpers/utils');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue'),

        async execute(interaction)
        {
            Log.info(`/queue command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

            await interaction.deferReply({ ephemeral: true });

            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) return interaction.editReply({ embeds: [errorEmbed('You must be in a voice channel to use this command.')] });

            const poru = createPoru(interaction.client);
            const player = poru.players.get(interaction.guild.id);
            if (!player || (!player.currentTrack && player.queue.length === 0)) return interaction.editReply({ embeds: [errorEmbed('The queue is empty.')] });
            
            const lines = [];
            if (player.currentTrack) {
                const duration = player.currentTrack.info.isStream ? 'Live' : formatDuration(player.currentTrack.info.length);
                lines.push(`**Now Playing:** [${player.currentTrack.info.title}](${player.currentTrack.info.uri}) · \`${duration}\` · requested by <@${player.currentTrack.info.requesterId ?? interaction.user.id}>`);
            }

            player.queue.slice(0, 10).forEach((track, idx) => {
            const duration = track.info.isStream ? 'Live' : formatDuration(track.info.length);
            lines.push(`**${idx + 1}.** [${track.info.title}](${track.info.uri}) · \`${duration}\` · requested by <@${track.info.requesterId ?? interaction.user.id}>`);
            });

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('Current Queue')
                .setDescription(lines.join('\n'))
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] })
        }
}