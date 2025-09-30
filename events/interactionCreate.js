const { Events, TextInputStyle } = require('discord.js');
const { ModalBuilder } = require('discord.js');
const { TextInputBuilder } = require('discord.js');
const { ActionRowBuilder } = require('discord.js');
const queueCommand = require('../commands/music/queue');
const helpCommand = require('../commands/utility/help');
const { handleControlButtons, refreshNowPlayingMessage } = require('../helpers/buttons');
const { getClient } = require('../helpers/clientRegistry');
const { createPoru, lavalinkSetVolume } = require('../helpers/lavalink/index');
const Log = require('../helpers/logs/log');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
		if (interaction.isStringSelectMenu()) {
			if (interaction.customId === 'help-category' && typeof helpCommand.handleCategorySelect === 'function') 
			{
				await helpCommand.handleCategorySelect(interaction);
			}
      		
			return;
    	}

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

			if(interaction.customId === 'volume-button')
			{
				const modal = new ModalBuilder()
					.setCustomId('player-volume-modal')
					.setTitle('Set Player Volume');

				const volumeInput = new TextInputBuilder()
					.setCustomId('player-volume-value')
					.setLabel('Volume (1-100)')
					.setStyle(TextInputStyle.Short)
					.setRequired(true)
					.setValue(String(player.volume ?? 100));

				modal.addComponents(new ActionRowBuilder().addComponents(volumeInput));
				
				return interaction.showModal(modal);
			}

			await handleControlButtons(interaction, player);
			return;
		}

		if(interaction.isModalSubmit())
		{
			if(interaction.customId !== 'player-volume-modal') return;

			const rawValue = interaction.fields.getTextInputValue('player-volume-value').trim();
			const parsed = Number(rawValue);

			if(!Number.isFinite(parsed)) return interaction.reply({ content: 'Invalid volume value. Please provide a number between 1 and 100.', ephemeral: true });

			const target = Math.max(0, Math.min(100, Math.round(parsed)));

			const poru = createPoru(getClient());
			const player = poru.players.get(interaction.guild.id);

			if(!player) return interaction.reply({ content: 'No music is being played on this server.', ephemeral: true });

			const memberChannel = interaction.member.voice?.channelId;

			if(player.voiceChannel && player.voiceChannel !== memberChannel) return interaction.reply({ content: 'You must be in the same voice channel as me to use this button.', ephemeral: true });

			await lavalinkSetVolume(interaction.guild.id, target);
			await interaction.reply({ content: `Set player volume to \`${target}\`.`, ephemeral: true });
			await refreshNowPlayingMessage(interaction.client, interaction.guild.id, player, player.loop ?? 'NONE', player.position);

			return;
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