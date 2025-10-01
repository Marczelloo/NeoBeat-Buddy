const { SlashCommandBuilder } = require('discord.js');
const { refreshNowPlayingMessage } = require('../../helpers/buttons');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const { requireSharedVoice } = require('../../helpers/interactions/voiceGuards');
const { lavalinkToggleLoop, createPoru } = require('../../helpers/lavalink/index');
const Log = require('../../helpers/logs/log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Loop mode to set')
                .setRequired(false)
                .addChoices(
                    { name: 'None', value: 'NONE' },
                    { name: 'Track', value: 'TRACK' },
                    { name: 'Queue', value: 'QUEUE' }
                ))
        .setDescription('Toggle loop for the current track'),
    

    async execute(interaction)
    {
        Log.info(`/loop command used by ${interaction.user.tag} in guild ${interaction.guild.name}`);

        await interaction.deferReply({ ephemeral: true });

        const guard = await requireSharedVoice(interaction);
        if(!guard.ok) return interaction.editReply(guard.response);

        const mode = interaction.options.getString('mode');

        const loopMode = await lavalinkToggleLoop(interaction.guild.id, mode);

        if(loopMode) 
        {
            const player = createPoru(interaction.guild.id).players.get(interaction.guild.id);
            await refreshNowPlayingMessage(interaction.client, interaction.guild.id, player);
            return interaction.editReply({ embeds: [successEmbed(`🔁 Loop mode set to **${loopMode}**.`)] }) ;
        }
        else
            return interaction.editReply({ embeds: [errorEmbed('No music is currently playing.')] });


    }
}