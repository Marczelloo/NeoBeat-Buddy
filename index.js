require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const { setClient } = require('./global.js');
const { createPoru } = require('./helpers/lavalink/index.js')
const Log = require('./helpers/logs/log.js');

Log.info('Token:', token ? 'Loaded' : 'Not Found');

const client = new Client({ intents: [GatewayIntentBits.Guilds, 
	GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, 
	GatewayIntentBits.GuildPresences, 
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.Guilds, 
	GatewayIntentBits.GuildMembers,
	GatewayIntentBits.GuildModeration, 
	GatewayIntentBits.GuildIntegrations,
	GatewayIntentBits.GuildWebhooks,
	GatewayIntentBits.GuildInvites, 
	GatewayIntentBits.GuildVoiceStates,
	GatewayIntentBits.GuildPresences,
	GatewayIntentBits.GuildMessages, 
	GatewayIntentBits.GuildMessageReactions, 
	GatewayIntentBits.GuildMessageTyping, 
	GatewayIntentBits.DirectMessages, 
	GatewayIntentBits.DirectMessageReactions, 
	GatewayIntentBits.DirectMessageTyping, 
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.GuildScheduledEvents, 
	GatewayIntentBits.AutoModerationConfiguration, 
	GatewayIntentBits.AutoModerationExecution ]
});

client.commands = new Collection();
setClient(client);
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for(const folder of commandFolders){
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for(const file of commandFiles){
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
	
		if('data' in command && 'execute' in command)
		{
			client.commands.set(command.data.name, command);
		} 
		else 
		{
			Log.warning(`The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const eventsPath = path.join(__dirname, 'events');
const eventsFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));


for(const file of eventsFiles){
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if(event.once){
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.on('voiceStateUpdate', (oldState, newState) => {
	if (oldState.member.user.id === client.user.id && newState.channelId === null) {
		Log.info('Bot left the voice channel:', oldState.channel, newState.guild.name, newState.guild.id);
		//const guild = newState.guild;
		//vcLeaveReset(guild.id);
	}
});

client.on('voiceStateUpdate', (oldState, newState) => {
	const oldChannel = oldState.channel;
	const newChannel = newState.channel;
	const guild = newState.guild;

	if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
		const oldMembers = oldChannel.members.size;
		const newMembers = newChannel.members.size;

		if (oldMembers !== newMembers && newMembers === 1) {
			Log.info('Bot is alone in the voice channel:', newChannel.name, guild.name, guild.id);
			Log.info('Bot will leave the voice channel in 60 seconds:', newChannel.name, guild.name, guild.id);
            //add leaving voice channnel after 60 seconds if alone and clearing up the queue
		}
	}
});

client.ws.on('error', (error) => {
	Log.error('WebSocket error:', error);
	reconnectClient();
});

const maxRetries = 3;
let currentAttempt = 0;

function connectClient() {
    client.login(token)
        .then(() => {
				Log.success('Successfully connected to Discord!');
        })
        .catch(err => {
				Log.error('Failed to connect to Discord:', err);
            if (currentAttempt < maxRetries) {
                currentAttempt++;
					 Log.warning(`Attempting to reconnect... Attempt ${currentAttempt}/${maxRetries}`);
                setTimeout(connectClient, 5000);
            } else {
					Log.error('Failed to connect to Discord after several attempts.');
            }
        });
}

function reconnectClient() {
	if (currentAttempt < maxRetries) {
		 currentAttempt++;
		 Log.warning(`Attempting to reconnect... Attempt ${currentAttempt}/${maxRetries}`);
		 client.destroy();
		 setTimeout(connectClient, 5000);
	} else {
		 Log.error('Failed to reconnect to Discord after several attempts.');
		 process.exit(1); // Exit the process to allow a restart
	}
}

connectClient();

const poru = createPoru(client);
client.on('raw', (d) => poru.packetUpdate(d));