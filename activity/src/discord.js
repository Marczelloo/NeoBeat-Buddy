import { DiscordSDK } from "@discord/embedded-app-sdk";

const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || "1418000096221466715";
const devGuildId = import.meta.env.VITE_ACTIVITY_DEV_GUILD_ID || "demo";
const configuredGateway = String(import.meta.env.VITE_ACTIVITY_GATEWAY_URL || "").replace(/\/$/, "");
const isDevPreview = import.meta.env.DEV && String(import.meta.env.VITE_ACTIVITY_DEV_MODE || "true") !== "false";
const ACTIVITY_SCOPE = "rpc.activities.write";

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
  if (!clientId || isDevPreview) {
    return {
      mode: "local",
      guildId: devGuildId,
      accessToken: null,
      user: { id: "local-user", username: "Local Listener" },
      sdk: null,
      reason: !clientId
        ? "Missing VITE_DISCORD_CLIENT_ID"
        : "Local preview enabled",
    };
  }

  const sdk = new DiscordSDK(clientId);
  await withTimeout(sdk.ready(), 7000);

  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds", "applications.commands", ACTIVITY_SCOPE],
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

function cleanPresenceText(value, fallback, limit = 128) {
  const text = String(value || fallback).replace(/\s+/g, " ").trim();
  return text.slice(0, limit);
}

function presenceSourceLabel(source) {
  return ({
    deezer: "Deezer",
    youtube: "YouTube",
    spotify: "Spotify",
    soundcloud: "SoundCloud",
  })[source] || source || "Unknown source";
}

/**
 * Reflect the shared MewBit player in the Discord user's Rich Presence.
 * Discord automatically removes this when the Activity closes.
 */
export async function setMewbitPresence(sdk, player) {
  if (!sdk?.commands?.setActivity) return;

  const track = player?.currentTrack;
  const isPlaying = Boolean(track && player?.playing && !player?.paused);
  const positionMs = Math.max(0, Number(player?.positionMs) || 0);
  const durationMs = Math.max(positionMs, Number(player?.durationMs || track?.durationMs) || 0);
  const start = Date.now() - positionMs;
  const status = track
    ? `${player?.paused ? "Paused" : isPlaying ? "Playing" : "Ready"} · ${presenceSourceLabel(track.source)}`
    : "Waiting for a track";
  const modes = [
    player?.autoplay ? "Autoplay" : null,
    player?.loop && player.loop !== "NONE" ? `Loop ${String(player.loop).toLowerCase()}` : null,
    player?.shuffleActive ? "Shuffle" : null,
  ].filter(Boolean);
  const artwork = track?.artworkUrl || track?.artworkFallbackUrl;

  await sdk.commands.setActivity({
    activity: {
      type: 2,
      details: cleanPresenceText(track?.title, "Choosing a track"),
      state: cleanPresenceText(`${track?.author || "MewBit room"} · ${status}${modes.length ? ` · ${modes.join(" · ")}` : ""}`, "MewBit room"),
      timestamps: track && isPlaying
        ? { start, end: durationMs ? start + durationMs : undefined }
        : null,
      assets: artwork && /^https?:\/\//i.test(artwork)
        ? { large_image: artwork, large_text: cleanPresenceText(track?.title, "MewBit") }
        : null,
    },
  });
}
