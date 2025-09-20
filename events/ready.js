const { Events } = require('discord.js');
const Log = require('../helpers/logs/log');
const { createPoru } = require('../helpers/lavalinkManager');
const { getServerData } = require('../global');
const { playerEmbed } = require('../helpers/embeds');
const { ActionRowBuilder } = require('discord.js');
const { rewindButton, pauseButton, resumeButton, skipButton, loopButton, shuffleButton } = require('../helpers/buttons');
const { formatDuration } = require('../helpers/utils');
const { buildControlRows } = require('../helpers/buttons');


module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        Log.success(`Logged in as ${client.user.tag}`);
        client.user.setActivity(`/help for more information`);
    
        try 
        {
            const poru = createPoru(client);
            poru.init(client);

            poru.on('trackStart', async (player, track) => {
                const server = getServerData(player.guildId);

                const oldMessageId = server?.nowPlayingMessage;
                const channelId = server?.nowPlayingChannel;
                if(!channelId) return;

                const channel = await client.channels.fetch(channelId);

                if(oldMessageId)
                {
                    try
                    {
                        const oldMessage = await channel.messages.fetch(oldMessageId);
                        await oldMessage.delete();
                    }
                    catch(e)
                    {
                        Log.error('Failed to delete old now playing message', e);
                    }
                }

                const embed = playerEmbed(
                    track.info.title,
                    track.info.uri,
                    track.info.artworkUrl ?? track.info.image ?? 'https://i.imgur.com/3g7nmJC.png',
                    track.info.author ?? 'Unknown',
                    track.info.requesterTag ?? 'Unknown',
                    track.info.requesterAvatar ?? null,
                    track.info.isStream ? 'Live' : formatDuration(track.info.length),
                    player.volume,
                    player.loop ?? 'NONE'
                );

                const controls = buildControlRows({
                    paused: player.isPaused,
                    loopMode: player.loop ?? 'NONE',
                });
                // const row = new ActionRowBuilder().addComponents(

                const newMessage = await channel.send({ embeds: [embed], components: controls });

                server.nowPlayingMessage = newMessage.id;
                server.nowPlayingChannel = channel.id;
                server.nowPlayingRequesterTag = track.info.requesterTag ?? 'Unknown';
                server.nowPlayingRequesterAvatar = track.info.requesterAvatar ?? null;

           });

            poru.on('trackEnd', async (player) => {
                const server = getServerData(player.guildIdd);
                const channelId = server?.nowPlayingChannel;
                const messageId = server?.nowPlayingMessage;
                if (!channelId || !messageId) return;

                try
                {
                    const channel = await client.channels.fetch(channelId);
                    const message = await channel.messages.fetch(messageId);

                    const controls = buildControlRows({ paused: false, loopMode: player.loop ?? 'NONE', disabled: true });

                    await message.edit({ components: controls });
                }
                catch(error)
                {
                    if(error.code !== 10008) throw error;
                    Log.error('Failed to disable buttons on track end', error);
                }
            })

            poru.on('queueEnd', async (player) => {
                const server = getServerData(player.guildId);
                const messageId = server?.nowPlayingMessage;
                const channelId = server?.nowPlayingChannel;

                if (!messageId || !channelId) return;

                const channel = await client.channels.fetch(channelId);
                await channel.messages.delete(messageId).catch(() => {});
                server.nowPlayingMessage = null;
            });

            if (!client._poruRawHooked) 
            {
                client.on('raw', (d) => poru.packetUpdate(d));
                client._poruRawHooked = true;
            }
            Log.success('Poru (Lavalink) initialized in ready event');
        } 
        catch (e) 
        {
            Log.error('Failed to initialize Poru in ready', e);
        }
    },
};