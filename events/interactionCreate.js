const { Events } = require('discord.js');
const Log = require('../helpers/logs/log');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction){
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