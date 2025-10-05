const fs = require('node:fs/promises');
const path = require('node:path');
const { PermissionsBitField } = require('discord.js');
const Log = require('../logs/log');

const DATA_FILE = path.join(__dirname, '..', 'data', 'dj.json');
const DEFAULT_CONFIG = {
  enabled: false,
  roleId: null,
  skipMode: 'vote',
  voteThreshold: 0.5,
  strictMode: false,
};

const state = { guilds: {} };
let saveTimer = null;
let ready = false;

const ALLOWED_SKIP_MODES = new Set(['dj', 'vote', 'hybrid']);

function ensureDataDir()
{
  return fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
}

function normalizeThreshold(value)
{
  const parsed = Number(value);
  if(!Number.isFinite(parsed)) return DEFAULT_CONFIG.voteThreshold;
  const clamped = Math.min(Math.max(parsed, 0.1), 1);
  return Number.isFinite(clamped) ? clamped : DEFAULT_CONFIG.voteThreshold;
}

function normalizeConfig(raw)
{
  const cfg = { ...DEFAULT_CONFIG };
  if(!raw || typeof raw !== 'object') return cfg;

  if(typeof raw.enabled === 'boolean') cfg.enabled = raw.enabled;
  if(typeof raw.roleId === 'string') cfg.roleId = raw.roleId;
  if(ALLOWED_SKIP_MODES.has(raw.skipMode)) cfg.skipMode = raw.skipMode;
  if(typeof raw.strictMode === 'boolean') cfg.strictMode = raw.strictMode;
  if(raw.voteThreshold != null) cfg.voteThreshold = normalizeThreshold(raw.voteThreshold);

  return cfg;
}

async function init()
{
  if(ready) return;

  try
  {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if(parsed && typeof parsed === 'object' && parsed.guilds && typeof parsed.guilds === 'object')
    {
      for(const [guildId, cfg] of Object.entries(parsed.guilds))
      {
        state.guilds[guildId] = normalizeConfig(cfg);
      }
    }
  }
  catch(error)
  {
    if(error.code !== 'ENOENT') throw error;
    await ensureDataDir();
    await persist();
  }

  ready = true;
}

function scheduleSave()
{
  if(saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try
    {
      await persist();
    }
    catch(error)
    {
      Log.error('Failed to persist DJ config', error);
    }
  }, 2000).unref?.();
}

async function persist()
{
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function ensureGuildConfig(guildId)
{
  if(!guildId) throw new Error('ensureGuildConfig requires guildId');
  if(!state.guilds[guildId])
  {
    state.guilds[guildId] = { ...DEFAULT_CONFIG };
  }
  return state.guilds[guildId];
}

function getGuildConfig(guildId)
{
  const config = ensureGuildConfig(guildId);
  return { ...config };
}

function setGuildConfig(guildId, updates = {})
{
  const current = ensureGuildConfig(guildId);
  const next = { ...current };

  if(Object.prototype.hasOwnProperty.call(updates, 'enabled'))
  {
    next.enabled = Boolean(updates.enabled);
  }

  if(Object.prototype.hasOwnProperty.call(updates, 'roleId'))
  {
    const value = updates.roleId;
    next.roleId = typeof value === 'string' ? value : null;
  }

  if(Object.prototype.hasOwnProperty.call(updates, 'skipMode'))
  {
    const mode = updates.skipMode;
    if(ALLOWED_SKIP_MODES.has(mode)) next.skipMode = mode;
  }

  if(Object.prototype.hasOwnProperty.call(updates, 'voteThreshold'))
  {
    next.voteThreshold = normalizeThreshold(updates.voteThreshold);
  }

  if(Object.prototype.hasOwnProperty.call(updates, 'strictMode'))
  {
    next.strictMode = Boolean(updates.strictMode);
  }

  state.guilds[guildId] = next;
  scheduleSave();
  return { ...next };
}

function setDjRole(guildId, roleId)
{
  return setGuildConfig(guildId, { roleId: roleId || null });
}

function disableGuild(guildId)
{
  return setGuildConfig(guildId, { enabled: false });
}

function isDjModeEnabled(guildId)
{
  return ensureGuildConfig(guildId).enabled;
}

function ensureConfig(configOrGuildId)
{
  if(typeof configOrGuildId === 'string') return ensureGuildConfig(configOrGuildId);
  if(configOrGuildId && typeof configOrGuildId === 'object') return configOrGuildId;
  return { ...DEFAULT_CONFIG };
}

function hasDjPermissions(member, config)
{
  if(!member) return false;
  const cfg = ensureConfig(config);
  if(!cfg.enabled) return true;

  if(cfg.strictMode && cfg.roleId)
  {
    if(member.roles?.cache?.has?.(cfg.roleId)) return true;

    const strictGuild = member.guild;
    if(strictGuild?.ownerId && member.id === strictGuild.ownerId) return true;

    return false;
  }

  if(cfg.roleId && member.roles?.cache?.has?.(cfg.roleId)) return true;

  const guild = member.guild;
  if(guild?.ownerId && member.id === guild.ownerId) return true;

  const perms = member.permissions;
  if(!perms) return false;

  if(perms.has(PermissionsBitField.Flags.Administrator)) return true;
  if(perms.has(PermissionsBitField.Flags.ManageGuild)) return true;
  if(perms.has(PermissionsBitField.Flags.ManageChannels)) return true;

  return false;
}

function getSkipSettings(guildId)
{
  const config = ensureGuildConfig(guildId);
  return {
    mode: config.skipMode,
    threshold: config.voteThreshold,
  };
}

function setStrictMode(guildId, strict)
{
  return setGuildConfig(guildId, { strictMode: Boolean(strict) });
}

function getDjRoleMention(configOrGuildId)
{
  if(typeof configOrGuildId === 'string')
  {
    const config = getGuildConfig(configOrGuildId);
    return config.roleId ? '<@&' + config.roleId + '>' : 'the DJ';
  }

  if(configOrGuildId && typeof configOrGuildId === 'object')
  {
    return configOrGuildId.roleId ? '<@&' + configOrGuildId.roleId + '>' : 'the DJ';
  }

  return 'the DJ';
}

module.exports = {
  init,
  getGuildConfig,
  setGuildConfig,
  setDjRole,
  setStrictMode,
  disableGuild,
  isDjModeEnabled,
  hasDjPermissions,
  getSkipSettings,
  getDjRoleMention,
  DEFAULT_CONFIG,
  ALLOWED_SKIP_MODES,
};

