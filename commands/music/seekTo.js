const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { requireSharedVoice } = require('../../helpers/interactions/voiceGuards');
const { lavalinkSeekTo, lavalinkGetDuration } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seekto')
        .addStringOption(option =>
            option.setName('position')
                .setDescription('Position to seek to (in seconds or in mm:ss/hh:mm:ss format)')
                .setRequired(true))
        .setDescription('Seek to a specific position in the current track'),

    async execute(interaction) {
        Log.info(`/seekto command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

        await interaction.deferReply({ ephemeral: true });

        const guard = await requireSharedVoice(interaction);
        if(!guard.ok) return interaction.editReply(guard.response);

        const position = interaction.options.getString('position');
        if (!position) return interaction.editReply({ embeds: [errorEmbed('You must specify a position to seek to.')] });

        const isValidPosition = /^\d+$/.test(position) || /^(?:\d{1,2}:)?\d{2}:\d{2}$/.test(position);
        if (!isValidPosition) return interaction.editReply({ embeds: [errorEmbed('Invalid position format. Use seconds or mm:ss/hh:mm:ss format.')] });

        const positionInMs = /^\d+$/.test(position) ? parseInt(position) * 1000 : (() => {
            const parts = position.split(':').map(Number);
            let seconds = 0;
            if (parts.length === 3) {
                seconds += parts[0] * 3600; // hours
                seconds += parts[1] * 60;   // minutes
                seconds += parts[2];        // seconds
            } else if (parts.length === 2) {
                seconds += parts[0] * 60;   // minutes
                seconds += parts[1];        // seconds
            }
            return seconds * 1000;
        })();

        if (isNaN(positionInMs) || positionInMs < 0) {
            return interaction.editReply({ embeds: [errorEmbed('Invalid position value. It must be a positive number.')] });
        }

        const duration = await lavalinkGetDuration(interaction.guild.id);
        if (duration === null) {
            return interaction.editReply({ embeds: [errorEmbed('Failed to retrieve track duration.')] });
        }

        if (positionInMs > duration) {
            return interaction.editReply({ embeds: [errorEmbed(`Invalid position. The track duration is only ${duration / 1000} seconds.`)] });
        }

        const success = await lavalinkSeekTo(interaction.guild.id, positionInMs);
        if (success) {
            return interaction.editReply({ embeds: [successEmbed(`⏩ Seeking to ${position}...`)] });
        } else {
            return interaction.editReply({ embeds: [errorEmbed('Failed to seek to the specified position.')] });
        }
    }
}