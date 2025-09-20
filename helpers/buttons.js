const { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { getServerData } = require('../global');
const { formatDuration } = require('./utils');
const {
  lavalinkPause,
  lavalinkResume,
  lavalinkSkip,
  lavalinkSeekToStart,
  lavalinkToggleLoop,
  lavalinkShuffle,
  createPoru,
} = require('./lavalinkManager');
const { playerEmbed } = require('./embeds');

const LOOP_EMOJI = '1198248581304418396';
const SHUFFLE_EMOJI = '1198248578146115605';
const SKIP_EMOJI = '1198248590087307385';
const REWIND_EMOJI = '1198248587369386134';
const PAUSE_EMOJI = '1198248585624571904';
const RESUME_EMOJI = '1198248583162511430';

function createButton(id, style, emoji, disabled = false) {
    return new ButtonBuilder()
        .setCustomId(id)
        .setStyle(style)
        .setEmoji(emoji)
        .setDisabled(disabled);
}

function skipButton(disabled = false)
{
    return createButton('skip-button', ButtonStyle.Secondary, SKIP_EMOJI, disabled);
}

function rewindButton(disabled = false)
{
    return createButton('rewind-button', ButtonStyle.Secondary, REWIND_EMOJI, disabled);
}

function pauseButton(disabled = false)
{
    return createButton('pause-button', ButtonStyle.Danger, PAUSE_EMOJI, disabled);
}

function resumeButton(disabled = false)
{
    return createButton('resume-button', ButtonStyle.Success, RESUME_EMOJI, disabled);
}

function loopButton(disabled = false, mode = 'NONE')
{
    const active = mode !== 'NONE';
    const label = 
        mode === 'QUEUE' ? '🔁'
        : LOOP_EMOJI;

    return createButton('loop-button', active ? ButtonStyle.Success : ButtonStyle.Primary, label, disabled);
}

function shuffleButton(disabled = false)
{
    return createButton('shuffle-button', ButtonStyle.Primary, SHUFFLE_EMOJI, disabled);
}

function buildControlRows({  paused =  false, loopMode = 'NONE', disabled = false} = {})
{
    return [
        new ActionRowBuilder().addComponents(
            rewindButton(disabled),
            pauseButton(disabled || paused),
            resumeButton(disabled || !paused),  
            skipButton(disabled),
        ),
        new ActionRowBuilder().addComponents(
            loopButton(disabled, loopMode),
            shuffleButton(disabled)
        ),
    ];
}

async function handleControlButtons(interaction, player)
{
    const guildId = interaction.guildId;
    let loopMode = player.loop ?? 'NONE';
    let needsEmbedRefresh = false;

    await interaction.deferUpdate();

    switch(interaction.customId)
    {
        case 'pause-button':
            await lavalinkPause(guildId);
            break;
        case 'resume-button':
            await lavalinkResume(guildId);
            break;
        case 'skip-button':
            await lavalinkSkip(guildId);
            return;
            break;
        case 'rewind-button':
            await lavalinkSeekToStart(guildId);
            break;
        case 'loop-button':
            loopMode = await lavalinkToggleLoop(guildId);
            needsEmbedRefresh = true;
            break;
        case 'shuffle-button':
            await lavalinkShuffle(guildId);
            await interaction.followUp({ content: 'Queue shuffled!', flags: MessageFlags.Ephemeral });
            break;
        default:
            return interaction.reply({ content: 'Unknown button.', ephemeral: true });
    }

    const loopToDisplay = loopMode ?? (player.loop ?? 'NONE');
    const playerSnapshot = createPoru(interaction.client).players.get(guildId) ?? player;

    await refreshNowPlayingMessage(
      interaction.client,
      guildId,
      playerSnapshot,
      loopToDisplay
    );
}

async function refreshNowPlayingMessage(client, guildId, playerOverride = null, loopOverride)
{
    const server = getServerData(guildId);
    const channelId = server.nowPlayingChannel;
    const messageId = server.nowPlayingMessage;

    if (!channelId || !messageId) return;

    const player = playerOverride ?? createPoru(client).players.get(guildId);
    if (!player) return;

    const loopMode = loopOverride ?? (player.loop ?? 'NONE');
    const controls = buildControlRows({ paused: player.isPaused, loopMode, disabled: !player.currentTrack });

    let embed = null;
    if (player.currentTrack)
    {
        const info = player.currentTrack.info || {};
        const duration = info.isStream ? 'Live' : formatDuration(info.length ?? 0);
        const position = info.isStream ? 'Live' : formatDuration(player.position ?? 0);
        const artwork = info.artworkUrl ?? info.image ?? 'https://i.imgur.com/3g7nmJC.png';
        
        embed = playerEmbed(
            info.title,
            info.uri,
            artwork,
            info.author ?? 'Unknown',
            info.requesterTag ?? 'Unknown',
            info.requesterAvatar ?? null,
            duration,
            position,
            loopMode,
            player.volume,
        );
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if(!channel) return;

    const message = await channel.messages.fetch(messageId).catch((err) => {
        if (err?.code === 10008) return null
        throw err;
    })

    if(!message) return;

    const payload = { components: controls };
    if (embed) payload.embeds = [embed];

    await message.edit(payload);
}

module.exports = {
    skipButton,
    rewindButton,
    pauseButton,
    resumeButton,
    loopButton,
    shuffleButton,
    buildControlRows,
    handleControlButtons,
    refreshNowPlayingMessage
}
