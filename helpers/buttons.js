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

    const server = getServerData(guildId);

    if (!server.nowPlayingChannel || !server.nowPlayingMessage) return;

    const channelId = server.nowPlayingChannel;
    const messageId = server.nowPlayingMessage;
    if (!channelId || !messageId) return;

   const channel = await interaction.client.channels.fetch(server.nowPlayingChannel);

    try {
        const message = await channel.messages.fetch(server.nowPlayingMessage);
        const controls = buildControlRows({ paused: player.isPaused, loopMode, disabled: false });

        const embed = player.currentTrack
            ? playerEmbed(
                player.currentTrack.info.title,
                player.currentTrack.info.uri,
                player.currentTrack.info.artworkUrl ?? player.currentTrack.info.image ?? 'https://i.imgur.com/3g7nmJC.png',
                player.currentTrack.info.author ?? 'Unknown',
                player.currentTrack.info.requesterTag ?? 'Unknown',
                player.currentTrack.info.requesterAvatar ?? null,
                player.currentTrack.info.isStream ? 'Live' : formatDuration(player.currentTrack.info.length ?? 0),
                player.currentTrack.info.isStream ? 'Live' : formatDuration(player.position ?? 0),
                loopMode,
            )
            : null;

        const payload = { components: controls };
        if (embed) payload.embeds = [embed];

        await message.edit(payload);
    } 
    catch (error) 
    {
        if (error.code !== 10008) throw error; // ignore unknown-message race
    }
}

module.exports = {
    skipButton,
    rewindButton,
    pauseButton,
    resumeButton,
    loopButton,
    shuffleButton,
    buildControlRows,
    handleControlButtons
}
