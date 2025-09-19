const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Log = require('../../helpers/logs/log');
const { createPoru } = require('../../helpers/lavalinkManager');
const { errorEmbed } = require('../../helpers/embeds');
const { formatDuration } = require('../../helpers/utils');

const ITEMS_PER_PAGE = 20;
const PREV_EMOJI = '⬅️';
const NEXT_EMOJI = '➡️';

const encodeId = (action, guildId, userId, page) => 
    `queue|${action}|${guildId}|${userId}|${page}`;

const decodeId = (customId) => {
    const [root, action, guildId, userId, page] = customId.split('|');

    if(root !== 'queue') return null;

    return { action, guildId, userId, page: Number(page) || 0 };
}

function buildQueueEmbed(player, page, totalPages, requesterId)
{
    const lines = [];

    if(player.currentTrack)
    {
        const now = player.currentTrack.info;
        const duration = now.isStream ? 'Live' : formatDuration(now.length);
        lines.push(`**Now Playing:** [${now.title}](${now.uri}) · \`${duration}\` · requested by <@${now.requesterId ?? requesterId}>`);
    }

    const start = page * ITEMS_PER_PAGE;
    const slice = player.queue.slice(start, start + ITEMS_PER_PAGE);

    if(slice.length === 0)
    {
        lines.push('The queue is empty.');
    }
    else
    {
        slice.forEach((track, idx) => {
            const info = track.info;
            const duration = info.isStream ? 'Live' : formatDuration(info.length);
            const position = start + idx + 1;
            lines.push(`**${position}.** [${info.title}](${info.uri}) · \`${duration}\` · requested by <@${info.requesterId ?? requesterId}>`);
        })
    }

    return new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('Current Queue')
        .setDescription(lines.join('\n'))
        .setFooter({
            text: `Page ${page + 1}/${totalPages} • ${player.queue.length} queued tracks`,
        })
        .setTimestamp();
}

function buildControls(currentPage, totalPages, guildId, userId)
{
    const prevPage = Math.max(0, currentPage - 1);
    const nextPage = Math.min(totalPages - 1, currentPage + 1);

    const prev = new ButtonBuilder()
        .setCustomId(encodeId('prev', guildId, userId, prevPage))
        .setLabel(PREV_EMOJI)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 0);

    const next = new ButtonBuilder()
        .setCustomId(encodeId('next', guildId, userId, nextPage))
        .setLabel(NEXT_EMOJI)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === totalPages - 1 || totalPages === 0);

    return [new ActionRowBuilder().addComponents(prev, next)];
}

async function renderQueue(interaction, player, page = 0)
{
    const totalPages = Math.max(1, Math.ceil(player.queue.length / ITEMS_PER_PAGE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const embed = buildQueueEmbed(player, safePage, totalPages, interaction.user.id);
    const components = buildControls(safePage, totalPages, interaction.guildId, interaction.user.id);

    return { embed, components, page: safePage, totalPages };
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue'),

        async execute(interaction)
        {
            Log.info(`/queue command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

            await interaction.deferReply({ ephemeral: true });

            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) return interaction.editReply({ embeds: [errorEmbed('You must be in a voice channel to use this command.')] });

            const poru = createPoru(interaction.client);
            const player = poru.players.get(interaction.guild.id);
            if (!player || (!player.currentTrack && player.queue.length === 0)) {
                return interaction.editReply({ embeds: [errorEmbed('The queue is empty.')] });
            }

            const { embed, components } = await renderQueue(interaction, player, 0);
            await interaction.editReply({ embeds: [embed], components });
        },
        async handlePaginationButtons(interaction)
        {
            const data = decodeId(interaction.customId);
            if(!data) return interaction.reply({ content: 'Invalid button.', ephemeral: true });

            if(interaction.user.id !== data.userId)
            {
                return interaction.reply({ content: 'Only the user who initiated the command can use these buttons.', ephemeral: true });
            }

            const poru = createPoru(interaction.client);
            const player = poru.players.get(data.guildId);

            if(!player || (!player.currentTrack && player.queue.length === 0))
            {
                return interaction.update({
                    embeds: [errorEmbed('The queue is empty.')],
                    components: [],
                });
            }

            const { embed, components } = await renderQueue(interaction, player, data.page);
            await interaction.update({ embeds: [embed], components });
        }
}