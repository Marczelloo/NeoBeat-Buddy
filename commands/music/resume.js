const { SlashCommandBuilder } = require('discord.js');
const Log = require('../../helpers/logs/log');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { lavalinkResume, createPoru } = require('../../helpers/lavalinkManager');
const { refreshNowPlayingMessage } = require('../../helpers/buttons');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the currently paused song'),

        async execute(interaction)
        {
            Log.info(`/resume command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

            await interaction.deferReply({ ephemeral: true });

            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) return interaction.editReply({ embeds: [errorEmbed('You must be in a voice channel to use this command.')] });
            
            const botVoiceChannel = interaction.guild.members.me.voice.channel;
            if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id)
                return interaction.editReply({ embeds: [errorEmbed('You must be in the same voice channel as the bot to use this command.')] });

            const resumed = await lavalinkResume(interaction.guild.id);
            if (resumed) 
            {
                const player = createPoru(interaction.guild.id).players.get(interaction.guild.id);
                await refreshNowPlayingMessage(interaction.client, interaction.guild.id, player);
                return interaction.editReply({ embeds: [successEmbed('▶️ Music resumed.')] });
            }
            else 
                return interaction.editReply({ embeds: [errorEmbed('No music is currently paused.')] });
        }
}