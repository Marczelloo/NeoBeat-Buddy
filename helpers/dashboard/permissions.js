const accessStore = require("./access");

/**
 * Dashboard access is owner-first.
 *
 * The server owner always has it. The owner may name individual operators, who
 * then have it too. Discord's Administrator permission grants nothing here —
 * it is handed out too widely on most servers to be the gate for changing how
 * the bot behaves everywhere.
 *
 * Only ownership is checked against Discord; operator status is the bot's own
 * record. Both are verified per request against the live client, so a transfer
 * of ownership or a removed operator takes effect immediately rather than at
 * the visitor's next sign-in.
 */

function isGuildOwner(guild, userId) {
  return Boolean(guild) && guild.ownerId === userId;
}

/**
 * The servers to render in the rail.
 *
 * `oauthGuilds` is every guild the visitor is in, straight from the OAuth
 * `guilds` scope — it is not filtered by permission, because an operator does
 * not need any Discord permission to qualify. It only establishes that the
 * visitor is actually a member; the decision is made here and again on every
 * request that touches a guild.
 */
function listManageableGuilds(client, oauthGuilds = [], userId) {
  const results = [];
  for (const oauthGuild of oauthGuilds) {
    const live = client?.guilds?.cache?.get(oauthGuild.id);
    if (!live) continue;

    const owner = isGuildOwner(live, userId);
    const operator = accessStore.isOperator(oauthGuild.id, userId);
    if (!owner && !operator) continue;

    results.push({
      id: oauthGuild.id,
      name: live.name || oauthGuild.name || "Unknown server",
      icon: typeof live.iconURL === "function" ? live.iconURL({ size: 128 }) : null,
      role: owner ? "owner" : "operator",
    });
  }
  return results;
}

/**
 * Verifies the visitor may act on this guild, and says in what capacity.
 * Returns `{ role: "owner" | "operator" }`.
 */
async function assertGuildAccess(client, guildId, userId) {
  const guild = client?.guilds?.cache?.get(guildId);
  if (!guild) {
    throw Object.assign(new Error("MewBit is not in this server."), { statusCode: 404 });
  }

  if (isGuildOwner(guild, userId)) return { role: "owner" };

  if (accessStore.isOperator(guildId, userId)) {
    // An operator must still be a member. Leaving the server ends the access
    // without the owner having to prune the list.
    try {
      await guild.members.fetch(userId);
    } catch {
      throw Object.assign(new Error("You are not a member of this server."), { statusCode: 403 });
    }
    return { role: "operator" };
  }

  throw Object.assign(
    new Error("Only the server owner, and the people they have named, can change MewBit's settings here."),
    { statusCode: 403 }
  );
}

/** The operator list itself is the owner's alone — an operator cannot promote. */
function assertGuildOwner(client, guildId, userId) {
  const guild = client?.guilds?.cache?.get(guildId);
  if (!guild) throw Object.assign(new Error("MewBit is not in this server."), { statusCode: 404 });
  if (!isGuildOwner(guild, userId)) {
    throw Object.assign(new Error("Only the server owner can change who may use the dashboard."), { statusCode: 403 });
  }
}

module.exports = { isGuildOwner, listManageableGuilds, assertGuildAccess, assertGuildOwner };
