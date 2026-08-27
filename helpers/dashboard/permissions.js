const { PermissionsBitField } = require("discord.js");

const ADMINISTRATOR_FLAG = 0x8n;

function hasAdminFromOauthGuild(guild) {
  if (!guild || typeof guild !== "object") return false;
  if (guild.owner === true) return true;
  try {
    return (BigInt(guild.permissions ?? 0) & ADMINISTRATOR_FLAG) === ADMINISTRATOR_FLAG;
  } catch {
    return false;
  }
}

function listManageableGuilds(client, oauthGuilds = []) {
  const results = [];
  for (const oauthGuild of oauthGuilds) {
    if (!hasAdminFromOauthGuild(oauthGuild)) continue;
    const live = client?.guilds?.cache?.get(oauthGuild.id);
    if (!live) continue;
    results.push({
      id: oauthGuild.id,
      name: live.name || oauthGuild.name || "Unknown server",
      icon: typeof live.iconURL === "function" ? live.iconURL({ size: 128 }) : null,
    });
  }
  return results;
}

async function assertGuildAdmin(client, guildId, userId) {
  const guild = client?.guilds?.cache?.get(guildId);
  if (!guild) {
    throw Object.assign(new Error("MewBit is not in this server."), { statusCode: 404 });
  }

  let member;
  try {
    member = await guild.members.fetch(userId);
  } catch {
    throw Object.assign(new Error("You are not a member of this server."), { statusCode: 403 });
  }

  if (guild.ownerId === userId) return member;
  if (member.permissions?.has?.(PermissionsBitField.Flags.Administrator)) return member;

  throw Object.assign(new Error("You need Administrator permission in this server."), { statusCode: 403 });
}

module.exports = { hasAdminFromOauthGuild, listManageableGuilds, assertGuildAdmin, ADMINISTRATOR_FLAG };
