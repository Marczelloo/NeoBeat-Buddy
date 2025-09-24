const { Events } = require('discord.js');
const queueCommand = require('../commands/music/queue');
const { getClient } = require('../global');
const { handleControlButtons } = require('../helpers/buttons');
const { createPoru } = require('../helpers/lavalink/index');
const Log = require('../helpers/logs/log');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction){
		if(interaction.isButton())
		{
			if(interaction.customId.startsWith('queue|'))
			{
				if(typeof queueCommand.handlePaginationButtons === 'function')
				{
					await queueCommand.handlePaginationButtons(interaction);
				}	

				return;
			}

			const poru = createPoru(getClient());
			const player = poru.players.get(interaction.guild.id);
			if(!player) return interaction.reply({ content: 'No music is being played on this server.', ephemeral: true });

			const memeberChannel = interaction.member.voice.channelId;
			if(player.voiceChannel && player.voiceChannel !== memeberChannel) return interaction.reply({ content: 'You must be in the same voice channel as me to use this button.', ephemeral: true });

			await handleControlButtons(interaction, player);
		}

		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			Log.error(`No command matching ${interaction.commandName} was found.`, null, `Command name: ${interaction.commandName}`, interaction.guild.id, interaction.guild.name);
			return;
		}

		try 
		{
			await command.execute(interaction);
		} catch (error) {
			Log.error(`Error executing ${interaction.commandName}`, error, `Command name: ${interaction.commandName}`, interaction.guild.id, interaction.guild.name);
		}
    },
};