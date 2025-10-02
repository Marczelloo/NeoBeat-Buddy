const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const djStore = require('../../helpers/dj/store');
const { errorEmbed, successEmbed } = require('../../helpers/embeds');
const Log = require('../../helpers/logs/log');

async function ensureDjRole(interaction, providedRole)
{
  if(providedRole) return { role: providedRole, created: false };

  const guild = interaction.guild;
  const cached = guild.roles.cache.find((role) => role.name.toLowerCase() === 'dj');
  if(cached) return { role: cached, created: false };

  try
  {
    const created = await guild.roles.create({
      name: 'DJ',
      color: '#8c52ff',
      reason: 'DJ mode auto setup',
      hoist: false,
      mentionable: true,
    });

    return { role: created, created: true };
  }
  catch(error)
  {
    Log.error('Failed to auto-create DJ role', error, 'guild=' + guild.id);
    return { role: null, created: false, error };
  }
}

function requireManagement(interaction, config)
{
  const member = interaction.member;
  if(!member) return false;

  const cfg = config ?? djStore.getGuildConfig(interaction.guildId);

  if(cfg.strictMode && cfg.roleId)
  {
    if(member.roles?.cache?.has?.(cfg.roleId)) return true;
    if(interaction.guild?.ownerId && interaction.user.id === interaction.guild.ownerId) return true;
    return false;
  }

  if(member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if(member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  if(interaction.guild?.ownerId && interaction.user.id === interaction.guild.ownerId) return true;

  return false;
}

async function respond(interaction, payload)
{
  if(interaction.deferred || interaction.replied)
  {
    const { ephemeral, ...rest } = payload;
    return interaction.editReply(rest);
  }

  return interaction.reply({ ephemeral: true, ...payload });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dj')
    .setDescription('Configure DJ mode')
    .setDefaultMemberPermissions(null)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Enable DJ mode')
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Existing role to use (leave empty to auto-create)')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('skipmode')
            .setDescription('Skip handling strategy')
            .addChoices(
              { name: 'DJ approval', value: 'dj' },
              { name: 'Vote', value: 'vote' },
              { name: 'Hybrid', value: 'hybrid' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('threshold')
            .setDescription('Vote threshold percentage (10-100)')
            .setMinValue(10)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Disable DJ mode')
    )
    .addSubcommand((sub) =>
      sub
        .setName('setrole')
        .setDescription('Update the DJ role')
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role that will be considered DJ')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('skipmode')
        .setDescription('Update skip behaviour')
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Skip strategy')
            .setRequired(true)
            .addChoices(
              { name: 'DJ approval', value: 'dj' },
              { name: 'Vote', value: 'vote' },
              { name: 'Hybrid', value: 'hybrid' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('threshold')
            .setDescription('Vote threshold percentage (10-100)')
            .setMinValue(10)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('permissions')
        .setDescription('Configure who can manage DJ mode')
        .addBooleanOption((option) =>
          option
            .setName('strict')
            .setDescription('Require the DJ role to manage DJ mode')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Show current DJ configuration')
    ),

  async execute(interaction) {
    try
    {
      const guildId = interaction.guild.id;
      let config = djStore.getGuildConfig(guildId);

      if(!requireManagement(interaction, config))
      {
        const noAccessMessage = config.strictMode && config.roleId
          ? 'Only the DJ role can configure DJ mode.'
          : 'You need the Manage Server permission to configure DJ mode.';

        await respond(interaction, { embeds: [errorEmbed(noAccessMessage)] });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      if(subcommand === 'enable')
      {
        const suppliedRole = interaction.options.getRole('role');
        const roleInfo = await ensureDjRole(interaction, suppliedRole);

        if(!roleInfo.role)
        {
          await respond(interaction, { embeds: [errorEmbed('Unable to create or locate a DJ role. Make sure I can manage roles.')] });
          return;
        }

        const mode = interaction.options.getString('skipmode') ?? djStore.DEFAULT_CONFIG.skipMode;
        const thresholdPercent = interaction.options.getInteger('threshold');
        const threshold = thresholdPercent ? Math.max(0.1, Math.min(1, thresholdPercent / 100)) : djStore.DEFAULT_CONFIG.voteThreshold;

        djStore.setGuildConfig(guildId, {
          enabled: true,
          roleId: roleInfo.role.id,
          skipMode: mode,
          voteThreshold: threshold,
        });

        const description = [
          `Using role ${roleInfo.role}.`,
          roleInfo.created ? 'Created a new DJ role automatically.' : null,
          'Assign this role to trusted users so they can manage playback.',
        ].filter(Boolean).join('\n');

        Log.info('DJ mode enabled', '', 'guild=' + guildId, 'role=' + roleInfo.role.id, 'mode=' + mode, 'threshold=' + threshold);
        await respond(interaction, { embeds: [successEmbed('DJ mode enabled.', description)] });
        return;
      }

      if(subcommand === 'disable')
      {
        djStore.disableGuild(guildId);
        Log.info('DJ mode disabled', '', 'guild=' + guildId);
        await respond(interaction, { embeds: [successEmbed('DJ mode disabled.')] });
        return;
      }

      if(subcommand === 'setrole')
      {
        const role = interaction.options.getRole('role', true);
        djStore.setDjRole(guildId, role.id);
        Log.info('DJ role updated', '', 'guild=' + guildId, 'role=' + role.id);
        await respond(interaction, { embeds: [successEmbed('DJ role updated.', `Using role ${role}.`)] });
        return;
      }

      if(subcommand === 'skipmode')
      {
        const mode = interaction.options.getString('mode', true);
        const thresholdPercent = interaction.options.getInteger('threshold');
        const threshold = thresholdPercent ? Math.max(0.1, Math.min(1, thresholdPercent / 100)) : undefined;

        const patch = { skipMode: mode };
        if(mode !== 'dj' && threshold)
        {
          patch.voteThreshold = threshold;
        }
        else if(mode === 'dj')
        {
          patch.voteThreshold = djStore.DEFAULT_CONFIG.voteThreshold;
        }

        djStore.setGuildConfig(guildId, patch);
        await respond(interaction, { embeds: [successEmbed('Skip settings updated.')] });
        return;
      }

      if(subcommand === 'permissions')
      {
        const strict = interaction.options.getBoolean('strict');
        djStore.setStrictMode(guildId, strict);
        const message = strict
          ? 'Strict mode enabled. Only the DJ role can configure DJ settings.'
          : 'Strict mode disabled. Server managers can configure DJ settings.';
        await respond(interaction, { embeds: [successEmbed(message)] });
        return;
      }

      config = djStore.getGuildConfig(guildId);
      const lines = [
        'Enabled: ' + (config.enabled ? 'Yes' : 'No'),
        'Role: ' + (config.roleId ? '<@&' + config.roleId + '>' : 'Not set'),
        'Skip mode: ' + config.skipMode,
        'Vote threshold: ' + Math.round(config.voteThreshold * 100) + '%',
        'Strict permissions: ' + (config.strictMode ? (config.roleId ? 'DJ role only' : 'DJ role only (role not set)') : 'Server managers and DJ role'),
      ];

      await respond(interaction, { embeds: [successEmbed('DJ status', lines.join('\n'))] });
    }
    catch(error)
    {
      Log.error('Failed to execute /dj command', error, 'guild=' + interaction.guild?.id);
      await respond(interaction, { embeds: [errorEmbed('Could not update DJ settings.', 'Please try again later.')] });
    }
  }
};
