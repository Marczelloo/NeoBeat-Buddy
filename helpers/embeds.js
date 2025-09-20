const { EmbedBuilder } = require("discord.js");
const { formatDuration } = require("./utils");
const { LoopType } = require("../global");

module.exports = { 
    playerEmbed(title, url, image, artist, requesterTag, requesterAvatar, duration, volume, loop) {
        const loopLabel =
            loop === 'TRACK' || loop === LoopType.TRACK ? 'Track'
            : loop === 'QUEUE' || loop === LoopType.QUEUE ? 'Queue'
            : 'None';
        
        return new EmbedBuilder()
            .setColor('#1DB954')
            .setAuthor({ name: '🎶 Now Playing', iconURL: 'https://cdn.discordapp.com/emojis/741605543046807626.gif' })
            .setTitle(title)
            .setURL(url)
            .setThumbnail(image ?? 'https://i.imgur.com/3g7nmJC.png')
            .addFields(
                { name: '🎤 Artist', value: artist ?? 'Unknown', inline: true },
                { name: '⏱ Duration', value: duration ?? 'Unknown', inline: true },
                { name: '🔁 Loop', value: loopLabel, inline: true },
                { name: '🔊 Volume', value: `${volume ?? 100}`, inline: true }
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
    songEmbed: function(trackInfo) {
        const duration = trackInfo.isStream
            ? 'Live'
            : Number.isFinite(trackInfo.length)
            ? formatDuration(trackInfo.length)
            : 'Unknown';
        const requester =
            trackInfo.requesterId ? `<@${trackInfo.requesterId}>` :
            trackInfo.requesterTag ?? 'Unknown';

        return new EmbedBuilder()
            .setColor('#7289da')
            .setAuthor({ name: '🎵 Added to Queue', iconURL: 'https://cdn.discordapp.com/emojis/853314041004015616.png' })
            .setDescription(`**[${trackInfo.title}](${trackInfo.uri})**\n*${trackInfo.author ?? 'Unknown'}*`)
            .setThumbnail(trackInfo.artworkUrl ?? trackInfo.image ?? 'https://i.imgur.com/3g7nmJC.png')
            .addFields(
                { name: '⏱ Duration', value: `\`${duration}\``, inline: true },
                { name: '📦 Source', value: (trackInfo.sourceName ?? 'Unknown').replace(/^./, (c) => c.toUpperCase()), inline: true },
                { name: '👤 Requested by', value: requester, inline: true },
            )
            .setFooter({ text: 'Neo Beat Buddy • Queue system' })
            .setTimestamp();
    }
}