const Log = require('./helpers/logs/log');

const LoopType = {
    NONE: 0,
    TRACK: 1,
    QUEUE: 2,
}

const QueueType = {
    QUEUE: 0,
    ORIGINAL_QUEUE: 1,
    PLAYED_SONGS: 2,
}

const serverData = new Map();

let client = null;

function getServerData(guildId)
{
    if(!serverData.has(guildId))
    {
        serverData.set(guildId, {
            queue: [],
            originalQueue: [],
            playedSongs: [],
            loop: LoopType.NONE,
            shuffle: false,
            volume: 100,
            commandChannel: null,
            nowPlayingMessage: null,
            nowPlayingMessageId: null,
        })
    }

    return serverData.get(guildId);
}

function setGlobalVariable(guildId, propertyName, value)
{
    const server = getServerData(guildId);
    server[propertyName] = value;
}

function setSongInQueue(guildId, position, song, queueType) {
    const server = getServerData(guildId);
        if(queueType === QueueType.QUEUE)
            server.queue[position] = song;
        else if(queueType === QueueType.ORIGINAL_QUEUE)
            server.originalQueue[position] = song;
        else if(queueType === QueueType.PLAYED_SONGS)
            server.playedSongs[position] = song;
        else 
            Log.error("Invalid queueType", null, guildId);
}

function addToQueue(guildId, song, queueType) {
    const server = getServerData(guildId);
        if(queueType === QueueType.QUEUE)
            server.queue.push(song);
        else if(queueType === QueueType.ORIGINAL_QUEUE)
            server.originalQueue.push(song);
        else if(queueType === QueueType.PLAYED_SONGS)
            server.playedSongs.push(song);
        else 
            Log.error("Invalid queueType", null, guildId);
}

function shiftQueue(guildId, queueType) {
    const server = getServerData(guildId);
    if(queueType === QueueType.QUEUE)
        server.queue.shift();
    else if(queueType === QueueType.ORIGINAL_QUEUE)
        server.originalQueue.shift();
    else if(queueType === QueueType.PLAYED_SONGS)
        server.playedSongs.shift();
    else 
        Log.error("Invalid queueType", null, guildId);
}

function unshiftQueue(guildId, queueType, song = null) {
    const server = getServerData(guildId);
    if(queueType === QueueType.QUEUE)
        song ? server.queue.unshift(song) : server.queue.unshift();
    else if(queueType === QueueType.ORIGINAL_QUEUE)
        song ? server.originalQueue.unshift(song) : server.originalQueue.unshift();
    else if(queueType === QueueType.PLAYED_SONGS)
        song ? server.playedSongs.unshift(song) : server.playedSongs.unshift();
    else 
        Log.error("Invalid queueType", null, guildId);
}

function clearGlobalVariables(guildId)
{
    if(serverData.has(guildId))
    {
        const server = serverData.get(guildId);
        server.queue = [];
        server.originalQueue = [];
        server.playedSongs = [];
        server.loop = LoopType.NONE;
        server.shuffle = false;
        server.volume = 100;
    }
}

function getClient()
{
    return client;
}

function setClient(_client)
{
    client = _client;
}

module.exports = {
    LoopType,
    QueueType,
    getServerData,
    setGlobalVariable,
    clearGlobalVariables,
    setClient,
    getClient,
    setSongInQueue,
    addToQueue,
    shiftQueue,
    unshiftQueue,
}