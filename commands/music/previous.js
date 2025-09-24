const { SlashCommandBuilder  } = require('discord.js');
const { lavalinkPrevious } = require('../../helpers/lavalinkManager');
const Log = require('../../helpers/logs/log');
const { errorEmbed } = require('../../helpers/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('previous')
        .setDescription("Replay the previous track or restart the current one."),

    async execute(interaction)
    {
        Log.info(`/previous command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

        await interaction.deferReply({ ephemeral: true });

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel)
            return interaction.editReply({ embeds: [errorEmbed('You must be in a voice channel to use this command.')] });
        
        const botVoiceChannel = interaction.guild.members.me.voice.channel;
        if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id)
            return interaction.editReply({ embeds: [errorEmbed('You must be in the same voice channel as the bot to use this command.')] });

        const result = await lavalinkPrevious(interaction.guild.id);

        switch (result?.status) {
            case "no_player":
                return interaction.editReply({ content: "Nothing is playing right now." });
            case "empty":
                return interaction.editReply({ content: "No playback history yet." });
            case "restart":
                return interaction.editReply({ content: "Restarted the current track from the beginning." });
            case "previous":
                return interaction.editReply({ content: `Now playing the previous track: **${result.track?.info?.title ?? "Unknown"}**` });
            default:
                return interaction.editReply({ content: "Could not jump to the previous track." });
        }
    }
}