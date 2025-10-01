const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { requireSharedVoice } = require('../../helpers/interactions/voiceGuards');
const { lavalinkClearQueue } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearqueue')
        .setDescription('Clear the current queue'),

    async execute(interaction)
    {
        Log.info(`/clearqueue command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

        await interaction.deferReply({ ephemeral: true });

        const guard = await requireSharedVoice(interaction);
        if(!guard.ok) return interaction.editReply(guard.response);

        const cleared = await lavalinkClearQueue(interaction.guild.id);
        if (cleared) 
            return interaction.editReply({ embeds: [successEmbed('🗑️ Queue cleared.')] })
        else
            return interaction.editReply({ embeds: [errorEmbed('The queue is already empty.')] });
    }
}