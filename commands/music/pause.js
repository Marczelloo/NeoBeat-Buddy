const { SlashCommandBuilder } = require('discord.js');
const { refreshNowPlayingMessage } = require('../../helpers/buttons');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { requireSharedVoice } = require('../../helpers/interactions/voiceGuards');
const { lavalinkPause, createPoru } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the currently playing song'),

        async execute(interaction)
        {
            Log.info(`/pause command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

            await interaction.deferReply({ ephemeral: true });

           const guard = await requireSharedVoice(interaction);
            if(!guard.ok) return interaction.editReply(guard.response);

            const paused = await lavalinkPause(interaction.guild.id);
            if (paused) 
            {
                const player = createPoru(interaction.guild.id).players.get(interaction.guild.id);
                await refreshNowPlayingMessage(interaction.client, interaction.guild.id, player)
                return interaction.editReply({ embeds: [successEmbed('⏸️ Music paused.')] });
            }
            else 
                return interaction.editReply({ embeds: [errorEmbed('No music is currently playing.')] });
            
        }

}