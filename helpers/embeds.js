const { EmbedBuilder } = require("discord.js");
const { formatDuration } = require("./utils");

const ICONS = {
    artist: '🎙️',
    duration: '⏱️',
    loop: '🔁',
    volume: '🔊',
    source: '📡',
    requested: '🙏',
    nowPlaying: '🎧',
    success: '✅',
    error: '❌',
    lyrics: '🎵',
    playlist: '🎶',
    stats: '📊',
    autoplay: '🔄',
};

const COLORS = {
    player: '#1DB954',
    success: '#00d26a',
    error: '#ff4757',
    song: '#7289da',
    lyrics: '#5865F2',
    playlist: '#e91e63',
    stats: '#f39c12',
    queue: '#5865F2'
}

const bold = (label, value) => `**${label}** ${value ?? '—'}`;

module.exports = { 
    playerEmbed(title, url, image, artist, requesterTag, requesterAvatar, duration, position, loop, volume = 100, autoplay = false) 
    {
        const loopLabel =
        loop === 'TRACK' ? 'Track'
        : loop === 'QUEUE' ? 'Queue'
        : 'None';

        const infoLeft = [
        `${ICONS.artist} ${bold('Artist', artist ?? 'Unknown')}`,
        `${ICONS.duration} ${bold('Duration', duration ?? 'Unknown')}`,
        ].join('\n');

        const infoRight = [
        `${ICONS.loop} ${bold('Loop', loopLabel)}`,
        `${ICONS.volume} ${bold('Volume', volume)}`,
        `${ICONS.autoplay} ${bold('Autoplay', autoplay ? "On" : "Off")}`,
        ].join('\n');

        return new EmbedBuilder()
        .setColor(COLORS.player)
        .setAuthor({ name: `${ICONS.nowPlaying} Now Playing`, iconURL: 'https://cdn.discordapp.com/emojis/741605543046807626.gif' })
        .setTitle(title)
        .setURL(url)
        .setThumbnail(image ?? 'https://i.imgur.com/3g7nmJC.png')
        .setDescription(position && duration ? `\`${position}\` / \`${duration}\`` : null)
        .addFields(
            { name: '\u200b', value: infoLeft, inline: true },
            { name: '\u200b', value: infoRight, inline: true },
        )
        .setFooter({
            text: `Requested by ${requesterTag ?? 'Unknown'}`,
            iconURL: requesterAvatar ?? undefined,
        });
    },
    successEmbed: function(title, description) 
    {
        return new EmbedBuilder()
            .setColor(COLORS.success)
            .setAuthor({ 
                name: `${ICONS.success} Success`, 
                iconURL: 'https://cdn.discordapp.com/emojis/809543717553446912.gif' 
            })
            .setTitle(title)
            .setDescription(description || null)
            .setFooter({ 
                text: 'Neo Beat Buddy • Success', 
            })
        },
    errorEmbed: function(title, description) 
    {
        return new EmbedBuilder()
            .setColor(COLORS.error)
            .setAuthor({ 
                name: `${ICONS.error} Error`, 
                iconURL: 'https://cdn.discordapp.com/emojis/853314041004015616.png' 
            })
            .setTitle(title)
            .setDescription(description || null)
            .setFooter({ 
                text: 'Neo Beat Buddy • Error', 
            })
            .setTimestamp();
    },
    songEmbed(trackInfo) 
    {
        const duration = trackInfo.isStream
        ? 'Live'
        : Number.isFinite(trackInfo.length)
        ? formatDuration(trackInfo.length)
        : 'Unknown';

        const requester =
        trackInfo.requesterId ? `<@${trackInfo.requesterId}>`
        : trackInfo.requesterTag ?? 'Unknown';

        const details = [
        `${ICONS.duration} ${bold('Duration', duration)}`,
        `${ICONS.source} ${bold('Source', (trackInfo.sourceName ?? 'Unknown').replace(/^./, c => c.toUpperCase()))}`,
        `${ICONS.requested} ${bold('Requested', requester)}`,
        ].join('\n');

        return new EmbedBuilder()
        .setColor(COLORS.song)
        .setAuthor({ name: `${ICONS.playlist} Added to Queue`, iconURL: 'https://cdn.discordapp.com/emojis/853314041004015616.png' })
        .setTitle(trackInfo.title)
        .setURL(trackInfo.uri)
        .setDescription(trackInfo.author ? `*${trackInfo.author}*` : null)
        .setThumbnail(trackInfo.artworkUrl ?? trackInfo.image ?? 'https://i.imgur.com/3g7nmJC.png')
        .addFields({ name: '\u200b', value: details })
        .setFooter({ text: 'Neo Beat Buddy • Queue system' })
        .setTimestamp();
    },
    lyricsEmbed: function(title, description, footerNote) 
    {
        return new EmbedBuilder()
            .setColor(COLORS.lyrics)
            .setAuthor({
                name: `${ICONS.lyrics} Lyrics`,
                iconURL: 'https://cdn.discordapp.com/emojis/741605543046807626.gif',
            })
            .setTitle(title)
            .setDescription(description || null)
            .setFooter({ text: footerNote || 'Neo Beat Buddy • Lyrics' });
    },
    playlistEmbed({
        title,
        url,
        trackCount,
        totalDurationMs,
        requesterTag,
        requesterAvatar,
        source,
    }) {
        const durationLabel = Number.isFinite(totalDurationMs)
            ? formatDuration(totalDurationMs)
            : 'Unknown';

        return new EmbedBuilder()
            .setColor(COLORS.playlist)
            .setAuthor({
                name: `${ICONS.playlist} Playlist Added`,
                iconURL: 'https://cdn.discordapp.com/emojis/853314041004015616.png',
            })
            .setTitle(title)
            .setURL(url)
            .setDescription(source ? `Source • **${source}**` : null)
            .addFields(
                { name: 'Tracks', value: `**${trackCount}**`, inline: true },
                { name: 'Total duration', value: `**${durationLabel}**`, inline: true },
            )
            .setFooter({
                text: requesterTag ? `Requested by ${requesterTag}` : 'Neo Beat Buddy • Queue',
                iconURL: requesterAvatar ?? undefined,
            })
            .setTimestamp();
    },
    statsEmbed(guildStats, globalStats, lastActivityLabel) {
        const toHours = (ms) => (ms / 3_600_000).toFixed(2);
        const toDays = (ms) => (ms / 86_400_000).toFixed(1);
        
        const guildFields = [];
        const globalFields = [];
        
        if (guildStats) {
            guildFields.push(
                {
                    name: '🎵 This Server',
                    value: [
                        `Songs played: **${guildStats.songsPlayed}**`,
                        `Hours played: **${toHours(guildStats.msPlayed)}h**`,
                        `Songs skipped: **${guildStats.songsSkipped}**`,
                        `Playlists added: **${guildStats.playlistsAdded}**`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '👥 Server Activity',
                    value: [
                        `Unique users: **${guildStats.uniqueUserCount}**`,
                        `Peak listeners: **${guildStats.peakListeners}**`,
                        `Sessions: **${guildStats.totalSessions}**`,
                        `Avg session: **${toHours(guildStats.averageSessionLength)}h**`,
                    ].join('\n'),
                    inline: true,
                }
            );
        }
        
        if (globalStats) {
            globalFields.push(
                {
                    name: '🌍 Global Stats',
                    value: [
                        `Songs played: **${globalStats.songsPlayed}**`,
                        `Total playtime: **${toDays(globalStats.msPlayed)} days**`,
                        `Unique users: **${globalStats.uniqueUserCount}**`,
                        `Total sessions: **${globalStats.totalSessions}**`,
                    ].join('\n'),
                    inline: false,
                }
            );
        }

        return new EmbedBuilder()
            .setTitle(`${ICONS.stats} Playback Statistics`)
            .setColor(COLORS.stats)
            .addFields(...guildFields, ...globalFields)
            .setFooter({ text: `Last activity: ${lastActivityLabel}` })
            .setTimestamp();
    },
    queueEmbed({ currentTrack, isPlaying, queue, page, totalPages, requesterId })
    {
        const lines = [];

        if(currentTrack && (isPlaying || queue.length))
        {
            const info = currentTrack.info  || {};
            const duration = info.isStream ? "Live" : formatDuration(info.length);

            lines.push(
                `**Now Playing:** [${info.title}](${info.uri}) • \`${duration}\` • requested by <@${info.requesterId ?? requesterId}>`,
                '',
            );
        }
        else
        {
            lines.push('**Not playing anything right now.**', '');
        }

        const start = page * 20;
        const slice = queue.slice(start, start + 20);

        if(!slice.length) lines.push('The queue is empty.')
        else
        {
            slice.forEach((track, idx) => {
                const info = track.info || {};
                const duration = info.isStream ? "Live" : formatDuration(info.length);
                const position = start + idx + 1;

                lines.push(
                    `**${position}.** [${info.title}](${info.uri}) • \`${duration}\` • requested by <@${info.requesterId ?? requesterId}>`,
                );
            })
        }

        return new EmbedBuilder()
            .setColor(COLORS.queue)
            .setTitle('Current Queue')
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Page ${page + 1}/${totalPages} • ${queue.length} queued tracks` })
            .setTimestamp();
    },
    helpCategoryEmbed(category, user)
    {
        const embed = new EmbedBuilder()
            .setColor(0xff4f8b)
            .setTitle(`Help - ${category.label}`)
            .setDescription(category.description);

        (category.commands ?? []).forEach((command) => {
            embed.addFields({
                name: `/${command.name}`,
                value: `${command.description}\nUsage: \`${command.usage}\``,
            });
        });

        if (Array.isArray(category.notes))
        {
            category.notes.forEach((note) => {
                embed.addFields({
                    name: note.name,
                    value: note.value,
                    inline: false,
                });
            });
        }

        return embed.setFooter({
            text: `Requested by ${user.tag}`,
            iconURL: user.displayAvatarURL({ size: 128 }),
        });
    }
}