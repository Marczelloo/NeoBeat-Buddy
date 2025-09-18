const { SlashCommandBuilder } = require('discord.js');
const Log = require('../../helpers/logs/log');
const { lavalinkPause } = require('../../helpers/lavalinkManager');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the currently playing song'),

        async execute(interaction)
        {
            Log.info(`/pause command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

            await interaction.deferReply({ ephemeral: true });

            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) return interaction.editReply({ embeds: [errorEmbed('You must be in a voice channel to use this command.')] });

            const paused = await lavalinkPause(interaction.guild.id);
            if (paused) 
                return interaction.editReply({ embeds: [successEmbed('⏸️ Music paused.')] });
            else 
                return interaction.editReply({ embeds: [errorEmbed('No music is currently playing.')] });
            
        }

}