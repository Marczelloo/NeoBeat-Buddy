const { Events, TextInputStyle, ModalBuilder, TextInputBuilder, ActionRowBuilder } = require("discord.js");
const queueCommand = require("../commands/music/queue");
const helpCommand = require("../commands/utility/help");
const { handleControlButtons, refreshNowPlayingMessage } = require("../helpers/buttons");
const { getClient } = require("../helpers/clientRegistry");
const { handleProposalInteraction } = require("../helpers/dj/interactions");
const djStore = require("../helpers/dj/store");
const { createPoru, lavalinkSetVolume } = require("../helpers/lavalink/index");
const Log = require("../helpers/logs/log");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command || !command.autocomplete) {
        return;
      }

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        Log.error(`Error handling autocomplete for ${interaction.commandName}`, error);
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "help-category" && typeof helpCommand.handleCategorySelect === "function") {
        await helpCommand.handleCategorySelect(interaction);
      }
      ``;
      if (interaction.customId.startsWith("eq:")) {
        const { handlePanelInteraction } = require("../helpers/equalizer/interactions");
        await handlePanelInteraction(interaction);
        return;
      }

      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith("changelog:")) {
        const announcer = require("../helpers/announcements/announcer");
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
        const parts = interaction.customId.split(":");
        const action = parts[1]; // prev, next, or current
        const allVersions = announcer.getAllVersions();

        if (allVersions.length === 0) {
          await interaction.reply({ content: "No changelog versions available.", ephemeral: true });
          return;
        }

        // Get current version from embed footer - try multiple patterns
        const footerText = interaction.message.embeds[0]?.footer?.text;
        let currentVersion = footerText?.match(/Version ([\d.]+)/)?.[1] || footerText?.match(/v?([\d.]+)/)?.[1];

        if (!currentVersion || !allVersions.includes(currentVersion)) {
          currentVersion = allVersions[0];
        }

        const currentIndex = allVersions.indexOf(currentVersion);
        let newIndex = currentIndex;

        // Navigate based on action
        if (action === "prev") {
          // Older version = higher index (move down the list)
          if (currentIndex < allVersions.length - 1) {
            newIndex = currentIndex + 1;
          }
        } else if (action === "next") {
          // Newer version = lower index (move up the list)
          if (currentIndex > 0) {
            newIndex = currentIndex - 1;
          }
        } else if (action === "current") {
          // Latest version = index 0
          newIndex = 0;
        }

        const newVersion = allVersions[newIndex];

        const embed = announcer.buildPatchNotesEmbed(newVersion, newIndex + 1, allVersions.length);
        const linkButtons = announcer.buildPatchNotesButtons(newVersion, false);

        // Build navigation buttons
        const components = [linkButtons];

        if (allVersions.length > 1) {
          const navButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("changelog:prev")
              .setLabel("◀ Older")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(newIndex >= allVersions.length - 1),
            new ButtonBuilder()
              .setCustomId("changelog:current")
              .setLabel("Latest")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(newIndex === 0),
            new ButtonBuilder()
              .setCustomId("changelog:next")
              .setLabel("Newer ▶")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(newIndex <= 0)
          );

          components.push(navButtons);
        }

        await interaction.update({
          content: newIndex === 0 ? `📢 **Latest Version: v${newVersion}**` : `📜 **Version: v${newVersion}**`,
          embeds: [embed],
          components,
        });
        return;
      }

      if (interaction.customId === "announce:dismiss") {
        await interaction.message.delete().catch((err) => {
          Log.error("Failed to delete announcement message", err);
        });
        return;
      }

      if (interaction.customId.startsWith("eq:")) {
        const { handlePanelInteraction } = require("../helpers/equalizer/interactions");
        await handlePanelInteraction(interaction);
        return;
      }

      if (interaction.customId.startsWith("dj|")) {
        await handleProposalInteraction(interaction);
        return;
      }

      if (interaction.customId.startsWith("queue|")) {
        if (typeof queueCommand.handlePaginationButtons === "function") {
          await queueCommand.handlePaginationButtons(interaction);
        }

        return;
      }

      // Playlist pagination buttons
      if (interaction.customId.startsWith("playlist-prev:") || interaction.customId.startsWith("playlist-next:")) {
        const parts = interaction.customId.split(":");
        const action = parts[0].replace("playlist-", ""); // "prev" or "next"
        const playlistName = parts[1];
        const currentPage = parseInt(parts[2], 10);

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const { getPlaylist } = require("../helpers/playlists/store");
        const playlist = getPlaylist(userId, guildId, playlistName);

        if (!playlist) {
          await interaction.reply({ content: "Playlist not found.", ephemeral: true });
          return;
        }

        const newPage = action === "next" ? currentPage + 1 : currentPage - 1;
        const playlistCommand = require("../commands/music/playlist");
        await playlistCommand.showPlaylistPage(interaction, playlist, newPage);
        return;
      }

      const poru = createPoru(getClient());
      const player = poru.players.get(interaction.guild.id);
      if (!player) {
        await interaction.reply({ content: "No music is being played on this server.", ephemeral: true });
        return;
      }

      const config = djStore.getGuildConfig(interaction.guild.id);
      const isDj = djStore.hasDjPermissions(interaction.member, config);

      const memberChannel = interaction.member.voice?.channelId;
      if (player.voiceChannel && player.voiceChannel !== memberChannel) {
        await interaction.reply({
          content: "You must be in the same voice channel as me to use this button.",
          ephemeral: true,
        });
        return;
      }

      if (interaction.customId === "volume-button") {
        if (config.enabled && !isDj) {
          const mention = djStore.getDjRoleMention(config);
          await interaction.reply({
            content: "Only " + mention + " can adjust the volume while DJ mode is active.",
            ephemeral: true,
          });
          return;
        }

        const modal = new ModalBuilder().setCustomId("player-volume-modal").setTitle("Set Player Volume");

        const volumeInput = new TextInputBuilder()
          .setCustomId("player-volume-value")
          .setLabel("Volume (1-100)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(String(player.volume ?? 100));

        modal.addComponents(new ActionRowBuilder().addComponents(volumeInput));
        await interaction.showModal(modal);
        return;
      }

      await handleControlButtons(interaction, player);
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId !== "player-volume-modal") return;

      const rawValue = interaction.fields.getTextInputValue("player-volume-value").trim();
      const parsed = Number(rawValue);

      if (!Number.isFinite(parsed)) {
        await interaction.reply({
          content: "Invalid volume value. Please provide a number between 1 and 100.",
          ephemeral: true,
        });
        return;
      }

      const target = Math.max(0, Math.min(100, Math.round(parsed)));

      const poru = createPoru(getClient());
      const player = poru.players.get(interaction.guild.id);
      if (!player) {
        await interaction.reply({ content: "No music is being played on this server.", ephemeral: true });
        return;
      }

      const config = djStore.getGuildConfig(interaction.guild.id);
      const isDj = djStore.hasDjPermissions(interaction.member, config);
      if (config.enabled && !isDj) {
        const mention = djStore.getDjRoleMention(config);
        await interaction.reply({
          content: "Only " + mention + " can adjust the volume while DJ mode is active.",
          ephemeral: true,
        });
        return;
      }

      const memberChannel = interaction.member.voice?.channelId;
      if (player.voiceChannel && player.voiceChannel !== memberChannel) {
        await interaction.reply({
          content: "You must be in the same voice channel as me to use this button.",
          ephemeral: true,
        });
        return;
      }

      await lavalinkSetVolume(interaction.guild.id, target);
      await interaction.reply({ content: `Set player volume to \`${target}\`.`, ephemeral: true });
      await refreshNowPlayingMessage(
        interaction.client,
        interaction.guild.id,
        player,
        player.loop ?? "NONE",
        player.position
      );
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      Log.error(
        `No command matching ${interaction.commandName} was found.`,
        null,
        `Command name: ${interaction.commandName}`,
        interaction.guild.id,
        interaction.guild.name
      );
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      Log.error(
        `Error executing ${interaction.commandName}`,
        error,
        `Command name: ${interaction.commandName}`,
        interaction.guild.id,
        interaction.guild.name
      );
    }
  },
};
