/**
 * Development-only API stub, for working on the dashboard without a live
 * Discord session. Enabled by adding ?mock=1 to the URL.
 *
 * `import.meta.env.DEV` is statically false in a production build, so Vite
 * removes this module's call site and tree-shakes the whole file out.
 */

const GUILDS = [
  { id: "857906909930455070", name: "Neon Arcade", icon: null },
  { id: "1348374895209222244", name: "Late Night Listening", icon: null },
  { id: "1442521642713747701", name: "Test Server", icon: null },
];

const CHANNELS = [
  { id: "100000000000000001", name: "music" },
  { id: "100000000000000002", name: "general" },
  { id: "100000000000000003", name: "bot-spam" },
];

const ROLES = [
  { id: "200000000000000001", name: "Selector" },
  { id: "200000000000000002", name: "Moderator" },
];

function freshSettings() {
  return {
    player: { playerChannel: "100000000000000001", autoplay: true, radio247: false },
    source: { defaultSource: "deezer" },
    announcements: { announcementChannel: "100000000000000002", announcementsEnabled: true },
    dj: { enabled: true, roleId: "200000000000000001", skipMode: "hybrid", voteThreshold: 0.6, strictMode: false },
    options: { channels: CHANNELS, roles: ROLES },
  };
}

export function installDevMock() {
  if (!import.meta.env.DEV) return;
  if (!new URLSearchParams(window.location.search).has("mock")) return;

  const store = new Map();
  const realFetch = window.fetch;

  const json = (body) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

  window.fetch = async (input, init = {}) => {
    const url = String(input);

    if (url.includes("/api/dashboard/me")) {
      return json({ ok: true, user: { id: "u1", username: "Marczelloo", avatar: null }, guilds: GUILDS });
    }

    const settingsMatch = /\/api\/dashboard\/guilds\/(\d+)\/settings/.exec(url);
    if (settingsMatch) {
      const guildId = settingsMatch[1];
      if (!store.has(guildId)) store.set(guildId, freshSettings());

      if (init.method === "PATCH") {
        const patch = JSON.parse(init.body);
        const current = store.get(guildId);
        for (const [group, values] of Object.entries(patch)) {
          current[group] = { ...current[group], ...values };
        }
        await new Promise((resolve) => setTimeout(resolve, 240));
      }

      return json({ ok: true, settings: store.get(guildId) });
    }

    return realFetch(input, init);
  };

  console.info("[mewbit] dev API mock active");
}
