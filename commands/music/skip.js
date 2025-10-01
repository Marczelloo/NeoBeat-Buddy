const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { requireSharedVoice } = require('../../helpers/interactions/voiceGuards');
const { lavalinkSkip } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the currently playing song'),

        async execute(interaction)
        {
            Log.info(`/skip command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

            await interaction.deferReply({ ephemeral: true });

            const guard = await requireSharedVoice(interaction);
            if(!guard.ok) return interaction.editReply(guard.response);

            const skipped = await lavalinkSkip(interaction.guild.id);
            if (skipped) 
                return interaction.editReply({ embeds: [successEmbed('⏭️ Song skipped.')] });
            else
                return interaction.editReply({ embeds: [errorEmbed('No music is currently playing.')] });
        }
}