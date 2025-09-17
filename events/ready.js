const { Events } = require('discord.js');
const Log = require('../helpers/logs/log');
const { createPoru } = require('../helpers/lavalinkManager');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        Log.success(`Logged in as ${client.user.tag}`);
        client.user.setActivity(`/help for more information`);
    
        try 
        {
            const poru = createPoru(client);
            poru.init(client);
        
            if (!client._poruRawHooked) 
            {
                client.on('raw', (d) => poru.packetUpdate(d));
                client._poruRawHooked = true;
            }
            Log.success('Poru (Lavalink) initialized in ready event');
        } 
        catch (e) 
        {
            Log.error('Failed to initialize Poru in ready', e);
        }
    },
};