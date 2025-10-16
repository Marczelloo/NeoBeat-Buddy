const { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require("discord.js");
const skipVotes = require("./dj/skipVotes");
const djStore = require("./dj/store");
const { playerEmbed, errorEmbed } = require("./embeds");
const { getGuildState } = require("./guildState");
const {
  lavalinkPause,
  lavalinkResume,
  lavalinkSkip,
  lavalinkToggleLoop,
  lavalinkShuffle,
  createPoru,
  lavalinkPrevious,
  getLyricsState,
} = require("./lavalink/index");
const { buildLyricsResponse } = require("./lavalink/lyricsFormatter");
const { recordSkip } = require("./lavalink/skipLearning");
const Log = require("./logs/log");
const { formatDuration } = require("./utils");

const LOOP_EMOJI = "1198248581304418396";
const SHUFFLE_EMOJI = "1198248578146115605";
const SKIP_EMOJI = "1198248590087307385";
const REWIND_EMOJI = "1198248587369386134";
const PAUSE_EMOJI = "1198248585624571904";
const RESUME_EMOJI = "1198248583162511430";
const LYRICS_EMOJI = "1422570950951571456";
const VOLUME_EMOJI = "1422570891283529738";

function createButton(id, style, emoji, disabled = false) {
  return new ButtonBuilder().setCustomId(id).setStyle(style).setEmoji(emoji).setDisabled(disabled);
}

function skipButton(disabled = false) {
  return createButton("skip-button", ButtonStyle.Secondary, SKIP_EMOJI, disabled);
}

function rewindButton(disabled = false) {
  return createButton("rewind-button", ButtonStyle.Secondary, REWIND_EMOJI, disabled);
}

function pauseButton(disabled = false) {
  return createButton("pause-button", ButtonStyle.Danger, PAUSE_EMOJI, disabled);
}

function resumeButton(disabled = false) {
  return createButton("resume-button", ButtonStyle.Success, RESUME_EMOJI, disabled);
}

function loopButton(disabled = false, mode = "NONE") {
  const active = mode !== "NONE";
  const label = mode === "QUEUE" ? "đź”" : LOOP_EMOJI;

  return createButton("loop-button", active ? ButtonStyle.Success : ButtonStyle.Primary, label, disabled);
}

function shuffleButton(disabled = false) {
  return createButton("shuffle-button", ButtonStyle.Primary, SHUFFLE_EMOJI, disabled);
}

function lyricsButton(disabled = false) {
  return createButton("lyrics-button", ButtonStyle.Primary, LYRICS_EMOJI, disabled);
}

function volumeButton(disabled = false) {
  return createButton("volume-button", ButtonStyle.Primary, VOLUME_EMOJI, disabled);
}

function buildControlRows({ paused = false, loopMode = "NONE", disabled = false } = {}) {
  return [
    new ActionRowBuilder().addComponents(
      rewindButton(disabled),
      pauseButton(disabled || paused),
      resumeButton(disabled || !paused),
      skipButton(disabled)
    ),
    new ActionRowBuilder().addComponents(
      loopButton(disabled, loopMode),
      shuffleButton(disabled),
      lyricsButton(disabled),
      volumeButton(disabled)
    ),
  ];
}

async function handleControlButtons(interaction, player) {
  const guildId = interaction.guildId;
  const config = djStore.getGuildConfig(guildId);
  const isDj = djStore.hasDjPermissions(interaction.member, config);
  const customId = interaction.customId;
  let loopMode = player.loop ?? "NONE";

  if (customId === "skip-button") {
    const poru = createPoru(interaction.client);
    const livePlayer = poru.players.get(guildId);

    if (!config.enabled || isDj) {
      await interaction.deferUpdate();
      await lavalinkSkip(guildId);
      if (livePlayer?.currentTrack) recordSkip(guildId, livePlayer.currentTrack, "manual_skip");
      skipVotes.clear(guildId);

      const loopToDisplay = player.loop ?? "NONE";
      const playerSnapshot = createPoru(interaction.client).players.get(guildId) ?? player;

      await refreshNowPlayingMessage(interaction.client, guildId, playerSnapshot, loopToDisplay);
      return;
    }

    const settings = djStore.getSkipSettings(guildId);

    if (!livePlayer || (!livePlayer.currentTrack && livePlayer.queue.length === 0)) {
      await interaction.reply({ content: "Nothing is playing right now.", ephemeral: true });
      return;
    }

    const voiceChannel =
      interaction.guild.channels.cache.get(livePlayer.voiceChannel) ??
      (await interaction.guild.channels.fetch(livePlayer.voiceChannel).catch(() => null));

    if (!voiceChannel) {
      await interaction.reply({ content: "Could not determine the active voice channel.", ephemeral: true });
      return;
    }

    if (settings.mode === "dj") {
      const mention = djStore.getDjRoleMention(config);
      await interaction.reply({
        content: "Only " + mention + " can skip tracks while DJ mode is active.",
        ephemeral: true,
      });
      return;
    }

    if (settings.mode === "hybrid" && isDj) {
      const skipped = await lavalinkSkip(guildId);
      if (skipped) {
        skipVotes.clear(guildId);
        if (livePlayer?.currentTrack) recordSkip(guildId, livePlayer.currentTrack, "manual_skip");
        await interaction.reply({ content: "Song skipped.", ephemeral: true });
      }

      return interaction.reply({ content: "No music is currently playing.", ephemeral: true });
    }

    const listeners = voiceChannel.members.filter((member) => !member.user.bot);
    const eligibleCount = listeners.size;

    if (eligibleCount <= 1) {
      await lavalinkSkip(guildId);
      skipVotes.clear(guildId);
      if (livePlayer?.currentTrack) recordSkip(guildId, livePlayer.currentTrack, "manual_skip");
      await interaction.reply({ content: "Song skipped.", ephemeral: true });

      const loopToDisplay = player.loop ?? "NONE";
      const playerSnapshot = poru.players.get(guildId) ?? player;
      await refreshNowPlayingMessage(interaction.client, guildId, playerSnapshot, loopToDisplay);
      return;
    }

    const result = skipVotes.registerVote({
      guildId,
      userId: interaction.user.id,
      voiceChannelId: voiceChannel.id,
      eligibleCount,
      threshold: settings.threshold,
    });

    if (result.status === "duplicate") {
      await interaction.reply({
        content: "You already voted. Votes: " + result.votes + "/" + result.required + ".",
        ephemeral: true,
      });
      return;
    }

    if (result.status === "passed") {
      await lavalinkSkip(guildId);
      skipVotes.clear(guildId);
      if (livePlayer?.currentTrack) recordSkip(guildId, livePlayer.currentTrack, "manual_skip");
      await interaction.reply({ content: "Vote passed. Song skipped.", ephemeral: true });

      const loopToDisplay = player.loop ?? "NONE";
      const playerSnapshot = poru.players.get(guildId) ?? player;
      await refreshNowPlayingMessage(interaction.client, guildId, playerSnapshot, loopToDisplay);
      return;
    }

    await interaction.reply({
      content: "Vote recorded. Votes: " + result.votes + "/" + result.required + ".",
      ephemeral: true,
    });
    return;
  }

  if (
    config.enabled &&
    !isDj &&
    ["loop-button", "shuffle-button", "volume-button", "pause-button", "resume-button", "rewind-button"].includes(
      customId
    )
  ) {
    const mention = djStore.getDjRoleMention(config);
    await interaction.reply({
      content: "Only " + mention + " can use this control while DJ mode is active.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  switch (customId) {
    case "pause-button":
      await lavalinkPause(guildId);
      break;
    case "resume-button":
      await lavalinkResume(guildId);
      break;
    case "rewind-button": {
      const result = await lavalinkPrevious(guildId);

      if (result?.status === "no-player") {
        await interaction.followUp({ content: "Nothing is playing right now.", flags: MessageFlags.Ephemeral });
        return;
      }

      if (result?.status === "empty") {
        await interaction.followUp({
          content: "No previous track in history yet.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      break;
    }
    case "loop-button":
      loopMode = (await lavalinkToggleLoop(guildId)) ?? loopMode;
      break;
    case "shuffle-button":
      await lavalinkShuffle(guildId);
      break;
    case "lyrics-button": {
      const payload = getLyricsState(guildId);
      if (!payload || (!payload.lyrics && !payload.lines)) {
        return interaction.editReply({ embeds: [errorEmbed("No lyrics were found for this track.")] });
      }

      const text =
        payload.lyrics || (Array.isArray(payload.lines) ? payload.lines.map((entry) => entry.line).join("\n") : null);

      if (!text)
        return interaction.editReply({ embeds: [errorEmbed("The lyrics provider returned an empty result.")] });

      const trackTitle = payload.track?.title ?? player.currentTrack?.info?.title ?? "Unknown track";

      const { embeds, content } = buildLyricsResponse({
        text,
        provider: payload?.source,
        trackTitle,
      });

      if (!embeds.length) {
        await interaction.followUp({
          embeds: [errorEmbed("The lyrics provider returned an empty result.")],
        });

        return;
      }

      await interaction.followUp({
        content,
        embeds,
      });

      return;
    }
    default:
      await interaction.followUp({ content: "Unknown button.", flags: MessageFlags.Ephemeral });
      return;
  }

  const loopToDisplay = loopMode ?? player.loop ?? "NONE";
  const playerSnapshot = createPoru(interaction.client).players.get(guildId) ?? player;

  await refreshNowPlayingMessage(interaction.client, guildId, playerSnapshot, loopToDisplay);
}

async function refreshNowPlayingMessage(client, guildId, playerOverride = null, loopOverride, positionOverride) {
  const server = getGuildState(guildId);

  if (!server || server.nowPlayingReplacing) {
    Log.info("refreshNowPlayingMessage skipped (replace in progress)", `guild=${guildId}`);
    return;
  }

  const channelId = server.nowPlayingChannel;
  const messageId = server.nowPlayingMessage;

  if (!channelId || !messageId) {
    Log.info("refreshNowPlayingMessage missing channel/message", `guild=${guildId}`);
    return;
  }

  const player = playerOverride ?? createPoru(client).players.get(guildId);

  if (!player) return;

  const loopMode = loopOverride ?? player.loop ?? "NONE";
  const controls = buildControlRows({ paused: player.isPaused, loopMode, disabled: !player.currentTrack });

  let embed = null;

  if (player.currentTrack) {
    const info = player.currentTrack.info || {};
    const artwork = info.artworkUrl ?? info.image ?? "https://i.imgur.com/3g7nmJC.png";
    const elapsedMs = positionOverride ?? player.position ?? 0;
    const durationLabel = info.isStream ? "Live" : formatDuration(info.length ?? 0);
    const positionLabel = info.isStream ? "Live" : formatDuration(elapsedMs);
    const autoplay = getGuildState(guildId)?.autoplay ?? false;

    embed = playerEmbed(
      info.title,
      info.uri,
      artwork,
      info.author ?? "Unknown",
      info.requesterTag ?? "Unknown",
      info.requesterAvatar ?? null,
      durationLabel,
      positionLabel,
      loopMode,
      player.volume,
      autoplay
    );
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch((err) => {
    if (err?.code === 10008) {
      Log.info("refreshNowPlayingMessage target already gone", `guild=${guildId}`, `message=${messageId}`);
      return null;
    }
    throw err;
  });

  if (!message) return;

  const payload = { components: controls };
  if (embed) payload.embeds = [embed];

  try {
    await message.edit(payload);
  } catch (err) {
    if (err?.code === 10008) {
      Log.info("refreshNowPlayingMessage edit target missing", `guild=${guildId}`, `message=${messageId}`);
      return;
    }

    throw err;
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
  handleControlButtons,
  refreshNowPlayingMessage,
};
