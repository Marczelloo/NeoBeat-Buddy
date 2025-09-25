const Log = require("./logs/log");

const guildState = new Map();

const createDefaultState = () => ({
    nowPlayingMessage: null,
    nowPlayingChannel: null,
})

function getGuildState(guildId)
{
    if(!guildId) 
    {
        Log.error('getGuildState called without a guildId');
        return null;
    }

    if(!guildState.has(guildId))
    {
        guildState.set(guildId, createDefaultState());
    }

    return guildState.get(guildId);
}

function updateGuildState(guildId, partial = {})
{
    const state = getGuildState(guildId);
    Object.assign(state, partial);
    
    return state;
}

function resetGuildState(guildId)
{
    if(!guildId) return;

    guildState.set(guildId, createDefaultState());
}

module.exports = {
    getGuildState,
    updateGuildState,
    resetGuildState,
}