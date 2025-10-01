const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PREV_EMOJI = '⬅️';
const NEXT_EMOJI = '➡️';
const ITEMS_PER_PAGE = 20;

const encodeQueueId = (action, guildId, userId, page) =>
  `queue|${action}|${guildId}|${userId}|${page}`;

const decodeQueueId = (customId) => {
  const [root, action, guildId, userId, page] = customId.split('|');
  if (root !== 'queue') return null;
  return { action, guildId, userId, page: Number(page) || 0 };
};

const buildQueueControls = (currentPage, totalPages, guildId, userId) => {
  const prevPage = Math.max(0, currentPage - 1);
  const nextPage = Math.min(totalPages - 1, currentPage + 1);

  const prev = new ButtonBuilder()
    .setCustomId(encodeQueueId('prev', guildId, userId, prevPage))
    .setLabel(PREV_EMOJI)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage === 0);

  const next = new ButtonBuilder()
    .setCustomId(encodeQueueId('next', guildId, userId, nextPage))
    .setLabel(NEXT_EMOJI)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage === totalPages - 1 || totalPages === 0);

  return [new ActionRowBuilder().addComponents(prev, next)];
};

module.exports = {
  ITEMS_PER_PAGE,
  encodeQueueId,
  decodeQueueId,
  buildQueueControls,
};