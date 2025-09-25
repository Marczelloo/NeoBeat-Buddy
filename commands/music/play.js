const { SlashCommandBuilder } = require('discord.js');
const { buildControlRows } = require('../../helpers/buttons.js');
const { errorEmbed, playerEmbed } = require('../../helpers/embeds');
const { songEmbed } = require('../../helpers/embeds.js');
const { getGuildState, updateGuildState } = require('../../helpers/guildState.js');
const { lavalinkPlay } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');
const { formatDuration } = require('../../helpers/utils.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from YouTube, Spotify, or SoundCloud')
        .addStringOption(option => option
            .setName('query')
            .setDescription('The URL or search term of the song to play')
            .setRequired(true)
        ),

        async execute(interaction)
        {
            Log.info(`/play command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

            await interaction.deferReply();

            const query = await interaction.options.getString('query');
            const voiceChannel = await interaction.member.voice.channel;

            if (!voiceChannel) return interaction.editReply({ embeds: [errorEmbed('You must be in a voice channel to use this command.')] });

            if(!query || query.trim() === '') return interaction .editReply({ embeds: [errorEmbed('Please provide a valid URL or search term.')] });

            try
            {
                const { track, player, startImmediately } = await lavalinkPlay({
                    guildId: interaction.guild.id,
                    voiceId: voiceChannel.id,
                    textId: interaction.channel.id,
                    query: query,
                })

                const controls = buildControlRows({ paused: false, loopMode: player.loop ?? 'NONE'})

                const requester = interaction.user;
                track.info.requesterId = requester.id;
                track.info.requesterTag = requester.tag;
                track.info.requesterAvatar = requester.displayAvatarURL({ size: 256 });
                track.info.loop = player.loop ?? 'NONE';

                await interaction.editReply({ embeds: [songEmbed(track.info)]});

                if(startImmediately)
                {
                    const info = player.currentTrack.info || {};
                    const duration = info.isStream ? 'Live' : formatDuration(info.length ?? 0);
                    const position = info.isStream ? 'Live' : formatDuration(player.position ?? 0);
                    const artwork = info.artworkUrl ?? info.image ?? 'https://i.imgur.com/3g7nmJC.png';
                    const nowPlayingEmbed = playerEmbed(
                        info.title,
                        info.uri,
                        artwork,
                        info.author ?? 'Unknown',
                        info.requesterTag,
                        info.requesterAvatar,
                        duration,
                        position,
                        info.loop,
                        player.volume
                    );

                    const payload = { embeds: [nowPlayingEmbed], components: controls };
                    const server = getGuildState(interaction.guild.id);
                    const channelId = server.nowPlayingChannel;
                    const messageId = server.nowPlayingMessage;

                    let message = null;
                    if (channelId && messageId)
                    {
                        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
                        if (channel)
                        {
                            message = await channel.messages.fetch(messageId).catch((err) => {
                                if (err?.code === 10008) return null;
                                return null;
                            });
                        }
                    }

                    if (message)
                    {
                        await message.edit(payload);
                    }
                    else
                    {
                        message = await interaction.followUp(payload);
                    }

                    updateGuildState(interaction.guild.id,{
                        nowPlayingMessage: message.id,
                        nowPlayingChannel: message.channelId ?? interaction.channel.id
                    });
                }
            }   
            catch(error)
            {
                Log.error("Error in /play command:", error);
                return interaction.editReply({ embeds: [errorEmbed('An error occurred while trying to play the song. Please try again later.')] });
            }

            
        }
}
