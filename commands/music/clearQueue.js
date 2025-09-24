const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { lavalinkClearQueue } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearqueue')
        .setDescription('Clear the current queue'),

    async execute(interaction)
    {
        Log.info(`/clearqueue command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

        await interaction.deferReply({ ephemeral: true });

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) 
            return interaction.editReply({ embeds: [errorEmbed('You must be in a voice channel to use this command.')] });
            
        const botVoiceChannel = interaction.guild.members.me.voice.channel;
        if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id)
            return interaction.editReply({ embeds: [errorEmbed('You must be in the same voice channel as the bot to use this command.')] });

        const cleared = await lavalinkClearQueue(interaction.guild.id);
        if (cleared) 
            return interaction.editReply({ embeds: [successEmbed('🗑️ Queue cleared.')] })
        else
            return interaction.editReply({ embeds: [errorEmbed('The queue is already empty.')] });
    }
}