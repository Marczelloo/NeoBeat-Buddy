const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { getGuildState, updateGuildState } = require('../../helpers/guildState.js');
const { requireSharedVoice } = require('../../helpers/interactions/voiceGuards.js');
const { lavalinkStop } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and clear the queue'),

    async execute(interaction)
    {
        Log.info(`/stop command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

        await interaction.deferReply({ ephemeral: true });

        const guard = await requireSharedVoice(interaction);
        if(!guard.ok) return interaction.editReply(guard.response);

        const stopped = await lavalinkStop(interaction.guild.id);
        if (stopped)
        {
            const server = getGuildState(interaction.guild.id);
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

            updateGuildState(interaction.guild.id, {
                nowPlayingMessage: null,
                nowPlayingChannel: null,
            });

            return interaction.editReply({ embeds: [successEmbed('Music stopped and queue cleared.')] });
        }

        return interaction.editReply({ embeds: [errorEmbed('No music is currently playing.')] });
    }
};
