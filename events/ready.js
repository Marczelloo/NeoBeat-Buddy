const { Events } = require('discord.js');
const Log = require('../helpers/logs/log');
const { createPoru } = require('../helpers/lavalinkManager');
const { getServerData } = require('../global');
const { playerEmbed } = require('../helpers/embeds');
const { ActionRowBuilder } = require('discord.js');
const { rewindButton, pauseButton, resumeButton, skipButton, loopButton, shuffleButton } = require('../helpers/buttons');
const { formatDuration } = require('../helpers/utils');


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
                    track.info.isStream ? 'Live' : '0:00'
                );
                const row = new ActionRowBuilder().addComponents(
                    rewindButton(false),
                    pauseButton(false),
                    resumeButton(true),
                    skipButton(false),
                    loopButton(false),
                );

                const newMessage = await channel.send({ embeds: [embed], components: [row] });

                server.nowPlayingMessage = newMessage.id;
                server.nowPlayingChannel = channel.id;
                server.nowPlayingRequesterTag = track.info.requesterTag ?? 'Unknown';
                server.nowPlayingRequesterAvatar = track.info.requesterAvatar ?? null;

           });

            poru.on('trackEnd', async (player) => {
                const guildId = player.guildId;
                const messageId = getServerData(guildId)?.nowPlayingMessage;

                if(!messageId) return;

                const channel = await client.channels.fetch(player.textChannel);
                await channel.messages.edit(messageId, {
                    components: [
                        new ActionRowBuilder().addComponents(
                            rewindButton(true),
                            pauseButton(true),  
                            resumeButton(true),
                            skipButton(true),
                            loopButton(true),
                        ),
                    ],
                })
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