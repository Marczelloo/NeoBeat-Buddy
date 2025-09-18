const { SlashCommandBuilder } = require('discord.js');
const { ActionRowBuilder } = require('discord.js');
const { setGlobalVariable, getServerData } = require('../../global.js');
const { errorEmbed, playerEmbed } = require('../../helpers/embeds');
const Log = require('../../helpers/logs/log');
const { lavalinkPlay } = require('../../helpers/lavalinkManager');
const { songEmbed } = require('../../helpers/embeds.js');
const { skipButton, rewindButton, loopButton, shuffleButton, pauseButton, resumeButton, buildControlRows } = require('../../helpers/buttons.js');
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
                track.info.loop = getServerData(interaction.guild.id, 'loop') || 'Off';

                await interaction.editReply({ embeds: [songEmbed(track.info)]});

                if(startImmediately)
                {
                    const artwork = track.info.artworkUrl ?? track.info.image ?? 'https://i.imgur.com/3g7nmJC.png';
                    const nowPlayingEmbed = playerEmbed(
                        track.info.title,
                        track.info.uri,
                        artwork,
                        track.info.author ?? 'Unknown',
                        track.info.requesterTag,
                        track.info.requesterAvatar,
                        track.info.isStream ? 'Live' : formatDuration(track.info.length),
                        track.info.isStream ? 'Live' : '0:00',
                        track.info.loop
                    );
                    const message = await interaction.followUp({ embeds: [nowPlayingEmbed], components: controls });
                    
                    setGlobalVariable(interaction.guild.id, 'nowPlayingMessage', message.id);
                    setGlobalVariable(interaction.guild.id, 'nowPlayingChannel', interaction.channel.id);
                }
            }   
            catch(error)
            {
                Log.error("Error in /play command:", error);
                return interaction.editReply({ embeds: [errorEmbed('An error occurred while trying to play the song. Please try again later.')] });
            }

            
        }
}