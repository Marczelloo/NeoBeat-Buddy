const djStore = require("../dj/store");
const { errorEmbed } = require("../embeds");

function requireDj(interaction, { action = "perform this action", ephemeral = true } = {}) {
  if (!interaction?.guildId) {
    return { ok: true, config: djStore.DEFAULT_CONFIG };
  }

  const config = djStore.getGuildConfig(interaction.guildId);
  if (!config.enabled) {
    return { ok: true, config };
  }

  const allowed = djStore.hasDjPermissions(interaction.member, config);
  if (allowed) {
    return { ok: true, config };
  }

  const target = config.roleId ? `<@&${config.roleId}>` : "a DJ";
  const embed = errorEmbed("DJ only action", `Only ${target} can ${action} while DJ mode is enabled.`);

  return {
    ok: false,
    config,
    response: {
      embeds: [embed],
      ephemeral,
    },
  };
}

module.exports = {
  requireDj,
};
