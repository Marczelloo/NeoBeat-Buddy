import { DiscordSDK } from "@discord/embedded-app-sdk";

const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
const devGuildId = import.meta.env.VITE_ACTIVITY_DEV_GUILD_ID || "demo";
const configuredGateway = String(import.meta.env.VITE_ACTIVITY_GATEWAY_URL || "").replace(/\/$/, "");
const isDevPreview = import.meta.env.DEV && String(import.meta.env.VITE_ACTIVITY_DEV_MODE || "true") !== "false";

function readLaunchContext() {
  const query = new URLSearchParams(window.location.search);
  return {
    frameId: query.get("frame_id"),
    instanceId: query.get("instance_id"),
    platform: query.get("platform"),
  };
}

function getMissingLaunchParameter(launchContext) {
  if (!launchContext.frameId) return "frame_id";
  if (!launchContext.instanceId) return "instance_id";
  if (!launchContext.platform) return "platform";
  return null;
}

function readGuildId(sdk) {
  const query = new URLSearchParams(window.location.search);
  return sdk?.guildId || query.get("guild_id") || query.get("guildId") || devGuildId;
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Discord SDK handshake timed out.")), timeoutMs)),
  ]);
}

async function readJsonResponse(response, context) {
  const body = await response.text();
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new Error(`${context} returned non-JSON data (${response.status}). Use the production Activity mapping at https://mewbit.marczelloo.dev.`);
  }
}

function activityUrl(path) {
  return `${configuredGateway}${path}`;
}

export async function setupDiscord() {
  const launchContext = readLaunchContext();
  const missingLaunchParameter = getMissingLaunchParameter(launchContext);

  if (!clientId || isDevPreview || missingLaunchParameter) {
    return {
      mode: "local",
      guildId: devGuildId,
      accessToken: null,
      user: { id: "local-user", username: "Local Listener" },
      sdk: null,
      reason: !clientId
        ? "Missing VITE_DISCORD_CLIENT_ID"
        : isDevPreview
          ? "Local preview enabled"
          : `Opened outside Discord Activity (${missingLaunchParameter} launch parameter missing)`,
    };
  }

  const sdk = new DiscordSDK(clientId);
  await withTimeout(sdk.ready(), 7000);

  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds", "applications.commands"],
  });

  const response = await fetch(activityUrl("/api/token"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const tokenPayload = await readJsonResponse(response, "Discord token exchange");
  if (!response.ok || !tokenPayload.access_token) {
    throw new Error(tokenPayload.error_description || tokenPayload.error || "Discord token exchange failed.");
  }

  const auth = await sdk.commands.authenticate({ access_token: tokenPayload.access_token });
  if (!auth) throw new Error("Discord Activity authentication failed.");

  return {
    mode: "discord",
    guildId: readGuildId(sdk),
    accessToken: tokenPayload.access_token,
    user: auth.user || { id: "discord-user", username: "Discord user" },
    sdk,
    instanceId: sdk.instanceId,
  };
}
