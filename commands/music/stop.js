const { SlashCommandBuilder } = require('discord.js');
const Log = require('../../helpers/logs/log');
const { getServerData, setGlobalVariable } = require('../../global');
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
        {
            const server = getServerData(interaction.guild.id);
            const channelId = server.nowPlayingChannel;
            const messageId = server.nowPlayingMessage;

            if (channelId && messageId)
            {
                const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
                if (channel)
                {
                    const message = await channel.messages.fetch(messageId).catch((err) => {
                        if (err?.code === 10008) return null;
                        return null;
                    });

                    if (message)
                    {
                        await message.delete().catch(() => null);
                    }
                }
            }

            setGlobalVariable(interaction.guild.id, 'nowPlayingMessage', null);
            setGlobalVariable(interaction.guild.id, 'nowPlayingChannel', null);

            return interaction.editReply({ embeds: [successEmbed('Music stopped and queue cleared.')] });
        }

        return interaction.editReply({ embeds: [errorEmbed('No music is currently playing.')] });
    }
};
