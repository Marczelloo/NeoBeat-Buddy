const { EmbedBuilder } = require("discord.js");
const { formatDuration } = require("./utils");
const { LoopType } = require("../global");

const ICONS = {
  artist: '🎙️',
  duration: '⏱️',
  loop: '🔁',
  volume: '🔊',
  source: '📡',
  requested: '🙏',
};

const bold = (label, value) => `**${label}** ${value ?? '—'}`;

module.exports = { 
    playerEmbed(title, url, image, artist, requesterTag, requesterAvatar, duration, position, loop, volume = 100) {
        const loopLabel =
        loop === 'TRACK' || loop === LoopType.TRACK ? 'Track'
        : loop === 'QUEUE' || loop === LoopType.QUEUE ? 'Queue'
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
        .setColor('#1DB954')
        .setAuthor({ name: '🎧 Now Playing', iconURL: 'https://cdn.discordapp.com/emojis/741605543046807626.gif' })
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
    successEmbed: function(title, description) {
        return new EmbedBuilder()
            .setColor('#00d26a') // Modern green
            .setAuthor({ 
                name: '✅ Success', 
                iconURL: 'https://cdn.discordapp.com/emojis/809543717553446912.gif' 
            })
            .setTitle(title)
            .setDescription(description || null)
            .setFooter({ 
                text: 'Neo Beat Buddy • Success', 
            })
        },
    errorEmbed: function(title, description) {
        return new EmbedBuilder()
            .setColor('#ff4757') // Modern red
            .setAuthor({ 
                name: '❌ Error', 
                iconURL: 'https://cdn.discordapp.com/emojis/853314041004015616.png' 
            })
            .setTitle(title)
            .setDescription(description || null)
            .setFooter({ 
                text: 'Neo Beat Buddy • Error', 
            })
            .setTimestamp();
    },
    songEmbed(trackInfo) {
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
        .setColor('#7289da')
        .setAuthor({ name: '🎶 Added to Queue', iconURL: 'https://cdn.discordapp.com/emojis/853314041004015616.png' })
        .setTitle(trackInfo.title)
        .setURL(trackInfo.uri)
        .setDescription(trackInfo.author ? `*${trackInfo.author}*` : null)
        .setThumbnail(trackInfo.artworkUrl ?? trackInfo.image ?? 'https://i.imgur.com/3g7nmJC.png')
        .addFields({ name: '\u200b', value: details })
        .setFooter({ text: 'Neo Beat Buddy • Queue system' })
        .setTimestamp();
    },
}