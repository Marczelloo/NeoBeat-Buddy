const { Events } = require('discord.js');
const { buildControlRows } = require('../helpers/buttons');
const { playerEmbed } = require('../helpers/embeds');
const { getGuildState, updateGuildState } = require('../helpers/guildState.js');
const { createPoru } = require('../helpers/lavalink/index');
const Log = require('../helpers/logs/log');
const { formatDuration } = require('../helpers/utils');


module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        Log.success(`Logged in as ${client.user.tag}`);
        client.user.setActivity({ name: '/help', type: 2 });
    
        try 
        {
            const poru = createPoru(client);
            poru.init(client);

            poru.on('trackStart', async (player) => {
                const info = player.currentTrack?.info || {};
                const state = updateGuildState(player.guildId, { nowPlayingReplacing: true }) ?? {};
                const channelId = state.nowPlayingChannel ?? player.textChannel;

                if (!channelId) {
                    Log.warn('trackStart without known channel', `guild=${player.guildId}`);
                    return;
                }

                const channel = await client.channels.fetch(channelId).catch((err) => {
                    Log.error('Failed to fetch now-playing channel', err, `guild=${player.guildId}`, `channel=${channelId}`);
                    return null;
                });
                if (!channel) return;

                const previousId = state.nowPlayingMessage ?? null;
                if (previousId) {
                    await channel.messages.delete(previousId).catch((err) => {
                    if (err?.code !== 10008) {
                        Log.error('trackStart failed to delete previous now-playing', err, `guild=${player.guildId}`, `message=${previousId}`);
                    }
                    });
                }

                const duration = info.isStream ? 'Live' : formatDuration(info.length ?? 0);
                const position = info.isStream ? 'Live' : formatDuration(player.position ?? 0);
                const artwork = info.artworkUrl ?? info.image ?? 'https://i.imgur.com/3g7nmJC.png';

                const embed = playerEmbed(
                    info.title,
                    info.uri,
                    artwork,
                    info.author ?? 'Unknown',
                    info.requesterTag ?? 'Unknown',
                    info.requesterAvatar ?? null,
                    duration,
                    position,
                    info.loop,
                    player.volume,
                );

                const controls = buildControlRows({
                    paused: player.isPaused,
                    loopMode: player.loop ?? 'NONE',
                });

                const message = await channel.send({ embeds: [embed], components: controls }).catch((err) => {
                    Log.error('Failed to send now-playing message', err, `guild=${player.guildId}`);
                    return null;
                });
                if (!message) {
                    updateGuildState(player.guildId, { nowPlayingReplacing: false });
                    return;
                }

                updateGuildState(player.guildId, {
                    nowPlayingMessage: message.id,
                    nowPlayingChannel: channel.id,
                    nowPlayingRequesterTag: info.requesterTag ?? 'Unknown',
                    nowPlayingRequesterAvatar: info.requesterAvatar ?? null,
                    nowPlayingReplacing: false,
                    nowPlayingVersion: (state.nowPlayingVersion ?? 0) + 1,
                });

                Log.info('Posted now-playing message', `guild=${player.guildId}`, `message=${message.id}`, `title=${info.title ?? 'Unknown'}`);
            });


            poru.on('trackEnd', async (player) => {
                const state = getGuildState(player.guildId);
                if (!state) return;

                // If something else is already replacing the card, let that run.
                if (state.nowPlayingReplacing) return;

                const channelId = state.nowPlayingChannel;
                const messageId = state.nowPlayingMessage;
                if (!channelId || !messageId) return;

                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (!channel) return;

                await channel.messages.delete(messageId).catch((err) => {
                    if (err?.code !== 10008) {
                    Log.error('trackEnd failed to delete now-playing message', err, `guild=${player.guildId}`, `message=${messageId}`);
                    }
                });

                updateGuildState(player.guildId, {
                    nowPlayingMessage: null,
                    nowPlayingReplacing: false,
                });
            });

            poru.on('queueEnd', async (player) => {
                const server = getGuildState(player.guildId);
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