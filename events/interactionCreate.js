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
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "help-category" && typeof helpCommand.handleCategorySelect === "function") {
        await helpCommand.handleCategorySelect(interaction);
      }

      return;
    }

    if (interaction.isButton()) {
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
