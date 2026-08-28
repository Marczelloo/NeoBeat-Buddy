/**
 * Who may operate a server's dashboard.
 *
 * The default is the server owner and nobody else. The owner may then name
 * individual operators. Discord's Administrator permission is deliberately not
 * the gate: on many servers it is handed out widely, and dashboard access is a
 * narrower thing than "can do anything in Discord".
 *
 * The consequence runs the other way too, and the UI has to say so plainly: an
 * operator does not need Administrator, so naming one grants settings access
 * the slash commands would refuse them. That is the owner's decision to make,
 * but it must be a decision rather than a surprise.
 *
 * Only the owner can change the operator list. An operator changing settings
 * cannot promote anyone, including themselves.
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const { backupCorruptFile, writeJsonAtomic } = require("../data/atomicJson");
const Log = require("../logs/log");

const DATA_FILE = path.join(__dirname, "..", "data", "dashboardAccess.json");
const MAX_OPERATORS = 25;
const MAX_LOG_ENTRIES = 200;
const SNOWFLAKE = /^\d{5,25}$/;

const state = { guilds: {} };
let saveTimer = null;

function emptyGuild() {
  return { operators: [], log: [] };
}

function normalizeGuild(raw) {
  const guild = emptyGuild();
  if (!raw || typeof raw !== "object") return guild;

  if (Array.isArray(raw.operators)) {
    guild.operators = [...new Set(raw.operators.filter((id) => typeof id === "string" && SNOWFLAKE.test(id)))].slice(
      0,
      MAX_OPERATORS
    );
  }
  if (Array.isArray(raw.log)) {
    guild.log = raw.log.filter((entry) => entry && typeof entry === "object").slice(-MAX_LOG_ENTRIES);
  }
  return guild;
}

async function init() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    if (!raw || raw.trim() === "") return;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.guilds && typeof parsed.guilds === "object") {
      for (const [guildId, guild] of Object.entries(parsed.guilds)) {
        state.guilds[guildId] = normalizeGuild(guild);
      }
    }
  } catch (error) {
    if (error.code === "ENOENT") return;
    if (error instanceof SyntaxError) {
      const backupPath = await backupCorruptFile(DATA_FILE).catch(() => null);
      Log.warning(`Dashboard access file corrupted and preserved at ${backupPath || "an unavailable backup path"}`);
      return;
    }
    Log.error("Failed to load dashboard access config", error);
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await writeJsonAtomic(DATA_FILE, state);
    } catch (error) {
      Log.error("Failed to persist dashboard access config", error);
    }
  }, 2000).unref?.();
}

function ensureGuild(guildId) {
  const key = String(guildId || "");
  if (!key) return emptyGuild();
  if (!state.guilds[key]) state.guilds[key] = emptyGuild();
  return state.guilds[key];
}

function getOperators(guildId) {
  return [...ensureGuild(guildId).operators];
}

function isOperator(guildId, userId) {
  if (!userId) return false;
  return ensureGuild(guildId).operators.includes(String(userId));
}

function setOperators(guildId, userIds) {
  const guild = ensureGuild(guildId);
  guild.operators = [...new Set((userIds || []).map(String).filter((id) => SNOWFLAKE.test(id)))].slice(0, MAX_OPERATORS);
  scheduleSave();
  return [...guild.operators];
}

/**
 * Appends one change to the guild's trail.
 *
 * Values are stored already rendered for display. The point is answering "who
 * turned this off and when", not reconstructing state, and keeping raw payloads
 * would quietly accumulate channel and role ids nobody asked to retain.
 */
function recordChange(guildId, { userId, username, section, field, from, to }) {
  const guild = ensureGuild(guildId);
  guild.log.push({
    at: new Date().toISOString(),
    userId: String(userId || ""),
    username: String(username || "Unknown"),
    section: String(section || ""),
    field: String(field || ""),
    from: from === undefined ? null : from,
    to: to === undefined ? null : to,
  });
  if (guild.log.length > MAX_LOG_ENTRIES) guild.log.splice(0, guild.log.length - MAX_LOG_ENTRIES);
  scheduleSave();
}

function getChangeLog(guildId, limit = 50) {
  const log = ensureGuild(guildId).log;
  return log.slice(Math.max(0, log.length - limit)).reverse();
}

function resetGuildAccess(guildId) {
  delete state.guilds[String(guildId || "")];
  scheduleSave();
}

module.exports = {
  init,
  getOperators,
  isOperator,
  setOperators,
  recordChange,
  getChangeLog,
  resetGuildAccess,
  MAX_OPERATORS,
};
