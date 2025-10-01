const { SlashCommandBuilder } = require('discord.js');
const { refreshNowPlayingMessage } = require('../../helpers/buttons');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { requireSharedVoice } = require('../../helpers/interactions/voiceGuards');
const { lavalinkResume, createPoru } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the currently paused song'),

        async execute(interaction)
        {
            Log.info(`/resume command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

            await interaction.deferReply({ ephemeral: true });

            const guard = await requireSharedVoice(interaction);
            if(!guard.ok) return interaction.editReply(guard.response);

            const resumed = await lavalinkResume(interaction.guild.id);
            if (resumed) 
            {
                const player = createPoru(interaction.guild.id).players.get(interaction.guild.id);
                await refreshNowPlayingMessage(interaction.client, interaction.guild.id, player);
                return interaction.editReply({ embeds: [successEmbed('▶️ Music resumed.')] });
            }
            else 
                return interaction.editReply({ embeds: [errorEmbed('No music is currently paused.')] });
        }
}