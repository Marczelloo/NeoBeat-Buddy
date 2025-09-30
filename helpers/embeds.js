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

};

const COLORS = {
    player: '#1DB954',
    success: '#00d26a',
    error: '#ff4757',
    song: '#7289da',
    lyrics: '#5865F2',
    playlist: '#e91e63',
}

const bold = (label, value) => `**${label}** ${value ?? '—'}`;

module.exports = { 
    playerEmbed(title, url, image, artist, requesterTag, requesterAvatar, duration, position, loop, volume = 100) 
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
}