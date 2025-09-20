const { SlashCommandBuilder } = require('discord.js');
const Log = require('../../helpers/logs/log');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { lavalinkToggleLoop } = require('../../helpers/lavalinkManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Loop mode to set')
                .setRequired(false)
                .addChoices(
                    { name: 'None', value: 'NONE' },
                    { name: 'Track', value: 'TRACK' },
                    { name: 'Queue', value: 'QUEUE' }
                ))
        .setDescription('Toggle loop for the current track'),
    

    async execute(interaction)
    {
        Log.info(`/loop command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

        await interaction.deferReply({ ephemeral: true });

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) 
            return interaction.editReply({ embeds: [errorEmbed('You must be in a voice channel to use this command.')] });
            
        const botVoiceChannel = interaction.guild.members.me.voice.channel;
        if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id)
            return interaction.editReply({ embeds: [errorEmbed('You must be in the same voice channel as the bot to use this command.')] });

        const mode = interaction.options.getString('mode');

        let looped;

        if(mode)
            looped = await lavalinkToggleLoop(interaction.guild.id, mode);
        else
            looped = await lavalinkToggleLoop(interaction.guild.id);

        if(looped) 
            return interaction.editReply({ embeds: [successEmbed(`🔁 Loop mode set to **${looped}**.`)] }) ;
        else
            return interaction.editReply({ embeds: [errorEmbed('No music is currently playing.')] });


    }
}