const { SlashCommandBuilder } = require('discord.js');
const Log = require('../../helpers/logs/log');
const { lavalinkStop } = require('../../helpers/lavalinkManager');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and clear the queue'),

        async execute(interaction)
        {
            Log.info(`/stop command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

            await interaction.deferReply({ ephemeral: true });

            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) 
                return interaction.editReply({ embeds: [errorEmbed('You must be in a voice channel to use this command.')] });
            
            const botVoiceChannel = interaction.guild.members.me.voice.channel;
            if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id)
                return interaction.editReply({ embeds: [errorEmbed('You must be in the same voice channel as the bot to use this command.')] });

            const stopped = await lavalinkStop(interaction.guild.id);
            if (stopped) 
                return interaction.editReply({ embeds: [successEmbed('⏹️ Music stopped and queue cleared.')] });
            else
                return interaction.editReply({ embeds: [errorEmbed('No music is currently playing.')] });
        }
}