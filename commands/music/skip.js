const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { requireSharedVoice } = require('../../helpers/interactions/voiceGuards');
const { lavalinkSkip, lavalinkRemoveFromQueue } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the currently playing song')
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
            Log.info(`/skip command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

            await interaction.deferReply({ ephemeral: true });

           const guard = await requireSharedVoice(interaction);
            if(!guard.ok) return interaction.editReply(guard.response);

            const position = interaction.options.getInteger('position');
            const title= interaction.options.getString('title') || position;

            if (!title && position == null)
            {
                const skipped = await lavalinkSkip(interaction.guild.id);
                if (skipped) 
                    return interaction.editReply({ embeds: [successEmbed('⏭️ Song skipped.')] });
                else
                    return interaction.editReply({ embeds: [errorEmbed('No music is currently playing.')] });
            } 
            else
            {
                const result = await lavalinkRemoveFromQueue(interaction.guild.id, {
                    position, 
                    title
                });

                switch(result?.status)
                {
                    case "removed":
                        return interaction.editReply({ embeds: [successEmbed(`🗑️ Removed **${result.trackTitle}** from position ${result.index} in the queue.`)] });
                    case "not_found":
                        return interaction.editReply({ embeds: [errorEmbed('No music found with that title or ID.')] });
                    case "empty_queue":
                        return interaction.editReply({ embeds: [errorEmbed('The queue is empty.')] });
                    default:
                        return interaction.editReply({ embeds: [errorEmbed('An unknown error occurred.')] });
                }
            }
        }
}