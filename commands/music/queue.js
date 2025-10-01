const { SlashCommandBuilder } = require('discord.js');
const {
    ITEMS_PER_PAGE,
    buildQueueControls,
    decodeQueueId
} = require('../../helpers/components/queue');
const { errorEmbed, queueEmbed } = require('../../helpers/embeds');
const { createPoru } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');


async function renderQueue(interaction, player, page = 0) {
  const totalPages = Math.max(1, Math.ceil(player.queue.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);

  const embed = queueEmbed({
    currentTrack: player.currentTrack,
    isPlaying: player.isPlaying,
    queue: player.queue,
    page: safePage,
    totalPages,
    requesterId: interaction.user.id,
  });

  const components = buildQueueControls(
    safePage,
    totalPages,
    interaction.guildId,
    interaction.user.id,
  );

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
            if (!voiceChannel) 
                return interaction.editReply({ embeds: [errorEmbed('You must be in a voice channel to use this command.')] });
            
            const botVoiceChannel = interaction.guild.members.me.voice.channel;
            if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id)
                return interaction.editReply({ embeds: [errorEmbed('You must be in the same voice channel as the bot to use this command.')] });

            const poru = createPoru(interaction.client);
            const player = poru.players.get(interaction.guild.id);
            if (!player || (!player.isPlaying && player.queue.length === 0)) 
            {
                return interaction.editReply({ embeds: [errorEmbed('The queue is empty.')] });
            }

            const { embed, components } = await renderQueue(interaction, player, 0);
            await interaction.editReply({ embeds: [embed], components });
        },
        async handlePaginationButtons(interaction)
        {
            const data = decodeQueueId(interaction.customId);
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