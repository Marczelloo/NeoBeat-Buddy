const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { requireSharedVoice } = require('../../helpers/interactions/voiceGuards');
const { lavalinkRemoveFromQueue } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption((option) =>
            option
            .setName('position')
            .setDescription('Queue position to remove')
            .setMinValue(1)
        )
        .addStringOption((option) =>
            option
            .setName('title')
            .setDescription('Title/keyword of the song to remove')
        ),

        async execute(interaction)
        {
            Log.info(`/remove command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

            await interaction.deferReply({ ephemeral: true });

            const guard = await requireSharedVoice(interaction);
            if(!guard.ok) return interaction.editReply(guard.response);

            const position = interaction.options.getInteger('position');
            const title= interaction.options.getString('title') || position;

            if (!title && position == null)
            {
                return interaction.editReply({ embeds: [errorEmbed('You must provide either a title or a position to remove a song from the queue.')] });
            }

            const result = await lavalinkRemoveFromQueue(interaction.guild.id, {
                position, 
                title
            });

            switch(result?.status)
            {
                case "removed":
                    return interaction.editReply({ embeds: [successEmbed(`🗑️ Removed **${result.trackTitle}** from position ${result.index} in the queue.`)] })
                case "not_found":
                    return interaction.editReply({ embeds: [errorEmbed('No music found with that title or ID.')] })
                case "empty_queue":
                    return interaction.editReply({ embeds: [errorEmbed('The queue is empty.')] })
                default:
                    return interaction.editReply({ embeds: [errorEmbed('An unknown error occurred.')] })
                };
        }
}