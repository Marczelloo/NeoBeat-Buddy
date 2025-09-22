const { SlashCommandBuilder } = require('discord.js');
const Log = require('../../helpers/logs/log');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { lavalinkSetVolume, createPoru } = require('../../helpers/lavalinkManager');
const { refreshNowPlayingMessage } = require('../../helpers/buttons');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the playback volume (0-100)')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('The volume level to set')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100)
        ),

    async execute(interaction) {
        Log.info(`/volume command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

        await interaction.deferReply({ ephemeral: true });

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.editReply({ embeds: [errorEmbed('You must be in a voice channel to use this command.')] });

        const botVoiceChannel = interaction.guild.members.me.voice.channel;
        if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id)
            return interaction.editReply({ embeds: [errorEmbed('You must be in the same voice channel as the bot to use this command.')] });

        const volume = interaction.options.getInteger('level');
        const success = await lavalinkSetVolume(interaction.guild.id, volume);

        if (success) 
        {
            const player = createPoru(interaction.guild.id).players.get(interaction.guild.id);
            await refreshNowPlayingMessage(interaction.client, interaction.guild.id, player);
            return interaction.editReply({ embeds: [successEmbed(`Volume set to ${volume}.`)] });
        }
        else
        {
            return interaction.editReply({ embeds: [errorEmbed('Failed to set volume.')] });
        }
    }
}