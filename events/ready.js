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
                const state = getGuildState(player.guildId) ?? {};
                const channelId = state.nowPlayingChannel ?? player.textChannel;
                if (!channelId) return;

                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (!channel) return;

                if (state.nowPlayingMessage) {
                    await channel.messages.delete(state.nowPlayingMessage).catch((err) => {
                    if (err?.code !== 10008) Log.error('Failed to delete now-playing message', err);
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

                const message = await channel.send({ embeds: [embed], components: controls }).catch(() => null);
                if (!message) return;

                updateGuildState(player.guildId, {
                    nowPlayingMessage: message.id,
                    nowPlayingChannel: channel.id,
                    nowPlayingRequesterTag: info.requesterTag ?? 'Unknown',
                    nowPlayingRequesterAvatar: info.requesterAvatar ?? null,
                });
            });


            poru.on('trackEnd', async (player) => {
                const state = getGuildState(player.guildId);
                const channelId = state?.nowPlayingChannel;
                const messageId = state?.nowPlayingMessage;
                if (!channelId || !messageId) return;

                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (!channel) return;

                await channel.messages.delete(messageId).catch((err) => {
                    if (err?.code !== 10008) Log.error('Failed to delete now-playing message on track end', err);
                });

                updateGuildState(player.guildId, { nowPlayingMessage: null });
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