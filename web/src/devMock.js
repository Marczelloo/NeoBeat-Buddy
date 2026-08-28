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

const FREQUENCIES = [
  "25 Hz", "40 Hz", "63 Hz", "100 Hz", "160 Hz", "250 Hz", "400 Hz", "630 Hz",
  "1 kHz", "1.6 kHz", "2.5 kHz", "4 kHz", "6.3 kHz", "10 kHz", "16 kHz",
];

const PRESETS = [
  "flat", "acoustic", "bass", "bassboost", "classical", "dance", "deep", "electronic",
  "edm", "hiphop", "jazz", "latin", "lofi", "nightcore", "piano", "podcast", "pop",
  "rnb", "rock", "smallspeakers", "treble", "vocal",
];

function freshSettings(blank = false) {
  if (blank) return blankSettings();

  return {
    player: { playerChannel: "100000000000000001", autoplay: true, radio247: false },
    source: { defaultSource: "deezer" },
    announcements: { announcementChannel: "100000000000000002", announcementsEnabled: true },
    dj: { enabled: true, roleId: "200000000000000001", skipMode: "hybrid", voteThreshold: 0.6, strictMode: false },
    logs: {
      configured: true,
      enabled: true,
      categoryId: "900000000000000001",
      categories: { message: true, voice: true, server: true, bot: false },
      channels: {
        message: "100000000000000001",
        voice: "100000000000000002",
        server: "100000000000000003",
        bot: "100000000000000003",
      },
      accessRoles: ["200000000000000002"],
    },
    tickets: {
      enabled: true,
      channelId: "100000000000000002",
      roleId: "200000000000000002",
      openCount: 3,
      totalCount: 17,
    },
    equalizer: {
      preset: "bassboost",
      bands: [0.14, 0.14, 0.14, 0.14, 0.14, 0.09, 0.04, 0, 0, 0, 0, 0, 0.03, 0.06, 0.06],
      presets: PRESETS,
      frequencies: FREQUENCIES,
      minGain: -0.2,
      maxGain: 0.14,
    },
    stats: {
      hasData: true,
      songsPlayed: 1284,
      msPlayed: 291_400_000,
      songsSkipped: 213,
      streamsPlayed: 4,
      playlistsAdded: 11,
      totalSessions: 168,
      peakListeners: 7,
      uniqueListeners: 19,
      averageSessionMs: 1_734_000,
      firstPlayedAt: "2025-11-02T18:40:00.000Z",
      lastPlayedAt: "2026-08-27T23:12:00.000Z",
      topSources: [
        { source: "deezer", count: 701 },
        { source: "youtube", count: 388 },
        { source: "spotify", count: 195 },
      ],
      mostActiveHour: { hour: 22, count: 214 },
    },
    options: { channels: CHANNELS, roles: ROLES },
  };
}

function blankSettings() {
  return {
    player: { playerChannel: null, autoplay: false, radio247: false },
    source: { defaultSource: "deezer" },
    announcements: { announcementChannel: null, announcementsEnabled: true },
    dj: { enabled: false, roleId: null, skipMode: "hybrid", voteThreshold: 0.5, strictMode: false },
    logs: {
      configured: false,
      enabled: false,
      categoryId: null,
      categories: { message: false, voice: false, server: false, bot: false },
      channels: { message: null, voice: null, server: null, bot: null },
      accessRoles: [],
    },
    tickets: { enabled: false, channelId: null, roleId: null, openCount: 0, totalCount: 0 },
    equalizer: {
      preset: "flat",
      bands: new Array(15).fill(0),
      presets: PRESETS,
      frequencies: FREQUENCIES,
      minGain: -0.2,
      maxGain: 0.14,
    },
    stats: {
      hasData: false,
      songsPlayed: 0,
      msPlayed: 0,
      songsSkipped: 0,
      streamsPlayed: 0,
      playlistsAdded: 0,
      totalSessions: 0,
      peakListeners: 0,
      uniqueListeners: 0,
      averageSessionMs: 0,
      firstPlayedAt: null,
      lastPlayedAt: null,
      topSources: [],
      mostActiveHour: null,
    },
    options: { channels: CHANNELS, roles: ROLES },
  };
}

export function installDevMock() {
  if (!import.meta.env.DEV) return;
  if (!new URLSearchParams(window.location.search).has("mock")) return;

  const store = new Map();
  const accessStore = new Map();
  const playlistStore = new Map();
  const realFetch = window.fetch;

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  /* The gateway refuses a few states outright. The mock has to refuse them too:
     a stub that accepts what the real server rejects teaches the UI a shape it
     will never actually be given. */
  function reject(patch, current) {
    const tickets = { ...current.tickets, ...(patch.tickets || {}) };
    if (tickets.enabled && !tickets.channelId) return "Choose a channel before turning the ticket system on.";

    for (const [key, value] of Object.entries(patch.logs?.channels || {})) {
      if (!value) return `A channel is required for ${key} logs.`;
    }
    return null;
  }

  window.fetch = async (input, init = {}) => {
    const url = String(input);

    if (url.includes("/api/dashboard/instance")) {
      return json({
        ok: true,
        instance: {
          healthy: false,
          issues: ["Elevated memory usage: 78.4%"],
          version: "1.1.4",
          uptime: "3d 4h 12m",
          uptimeMs: 274_320_000,
          servers: 3,
          lavalink: { connected: true, lastCheck: Date.now(), reconnects: 2, latency: 34 },
          performance: { lastMemoryUsage: { heapUsed: "184.2 MB", heapTotal: "235.0 MB" }, eventLoopLag: 3 },
          commands: { total: 4187, successful: 4102, failed: 85 },
          tracks: { played: 3910, failed: 41, skipped: 612 },
          errorCount: 7,
          warningCount: 23,
        },
      });
    }

    if (url.includes("/api/dashboard/public/stats")) {
      return json({
        ok: true,
        instance: {
          servers: 3,
          songsPlayed: 4187,
          msPlayed: 913_000_000,
          songsSkipped: 612,
          playlistsAdded: 24,
          totalSessions: 486,
          peakListeners: 9,
          uniqueListeners: 37,
          averageSessionMs: 1_878_000,
          firstPlayedAt: "2025-09-14T20:11:00.000Z",
          topSources: [
            { source: "deezer", count: 2410 },
            { source: "youtube", count: 1102 },
            { source: "soundcloud", count: 448 },
            { source: "spotify", count: 227 },
          ],
          uptimeMs: 7_412_000,
          version: "1.1.4",
        },
      });
    }

    const playlistMatch = /\/api\/dashboard\/guilds\/(\d+)\/playlists(?:\/([\w-]+))?/.exec(url);
    if (playlistMatch) {
      const guildId = playlistMatch[1];
      const playlistId = playlistMatch[2];
      if (!playlistStore.has(guildId)) {
        // The third server has none, so the empty state is reachable.
        playlistStore.set(
          guildId,
          guildId === GUILDS[2].id
            ? []
            : [
                {
                  id: "s-1",
                  name: "Friday Night",
                  description: "Loud things for the weekend",
                  createdBy: "400000000000000001",
                  createdByName: "Nova",
                  trackCount: 2,
                  durationMs: 621_000,
                  tracks: [
                    { title: "Loser", author: "Tame Impala", durationMs: 210_000 },
                    { title: "Rosemary", author: "Deftones", durationMs: 411_000 },
                  ],
                },
                {
                  id: "s-2",
                  name: "Study",
                  description: "",
                  createdBy: "400000000000000099",
                  // Unresolved on purpose: the creator has left the server.
                  createdByName: null,
                  trackCount: 0,
                  durationMs: 0,
                  tracks: [],
                },
              ]
        );
      }

      const list = playlistStore.get(guildId);

      if (init.method === "DELETE") {
        playlistStore.set(guildId, list.filter((playlist) => playlist.id !== playlistId));
        await new Promise((resolve) => setTimeout(resolve, 240));
      } else if (init.method === "PATCH") {
        const patch = JSON.parse(init.body);
        const name = String(patch.name || "").trim();
        if (!name) return json({ ok: false, error: "A playlist needs a name." }, 400);
        if (list.some((playlist) => playlist.id !== playlistId && playlist.name.toLowerCase() === name.toLowerCase())) {
          return json({ ok: false, error: `This server already has a playlist called "${name}".` }, 400);
        }
        const target = list.find((playlist) => playlist.id === playlistId);
        if (target) {
          target.name = name;
          target.description = patch.description || "";
        }
        await new Promise((resolve) => setTimeout(resolve, 240));
      }

      return json({ ok: true, playlists: playlistStore.get(guildId) });
    }

    if (/\/api\/dashboard\/guilds\/\d+\/embed/.test(url)) {
      if (init.method === "POST") {
        const body = JSON.parse(init.body);
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (!body.channelId) return json({ ok: false, error: "Choose a channel to post in." }, 400);
        const channel = CHANNELS.find((entry) => entry.id === body.channelId);
        return json({
          ok: true,
          sent: { messageId: "1500000000000000001", url: "https://discord.com/channels/0/0/0", channelName: channel?.name || "unknown" },
        });
      }
      return json({
        ok: true,
        options: {
          // The third channel stands in for one MewBit cannot post in, so the
          // blocked path is reachable without editing permissions in Discord.
          channels: CHANNELS.map((entry, index) => ({ ...entry, canPost: index !== 2 })),
          colors: [
            { value: "#19E6FF", label: "MewBit cyan" },
            { value: "#FF2BD6", label: "MewBit magenta" },
            { value: "#5865F2", label: "Blurple" },
            { value: "#57F287", label: "Green" },
            { value: "#ED4245", label: "Red" },
          ],
          defaultColor: "#19E6FF",
          limits: { title: 256, description: 4000, footer: 2048, author: 256 },
        },
      });
    }

    const accessMatch = /\/api\/dashboard\/guilds\/(\d+)\/access/.exec(url);
    if (accessMatch) {
      const guildId = accessMatch[1];
      if (!accessStore.has(guildId)) {
        accessStore.set(guildId, {
          // The third server stands in for one the visitor does not own, so the
          // read-only view of this section is reachable too.
          viewerIsOwner: guildId !== GUILDS[2].id,
          operators: guildId === GUILDS[0].id ? [{ id: "400000000000000001", name: "Nova", present: true }] : [],
          log: [],
        });
      }
      const entry = accessStore.get(guildId);

      if (init.method === "PUT") {
        if (!entry.viewerIsOwner) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return json({ ok: false, error: "Only the server owner can change who may use the dashboard." }, 403);
        }
        const wanted = JSON.parse(init.body).operators || [];
        const before = entry.operators.map((operator) => operator.id);
        entry.operators = wanted.map(
          (id) => entry.operators.find((operator) => operator.id === id) || { id, name: `Member ${id.slice(-4)}`, present: true }
        );
        for (const id of wanted.filter((value) => !before.includes(value))) {
          entry.log.unshift({ at: new Date().toISOString(), username: "Marczelloo", section: "access", field: "operator", from: "no access", to: `dashboard access for ${id}` });
        }
        for (const id of before.filter((value) => !wanted.includes(value))) {
          entry.log.unshift({ at: new Date().toISOString(), username: "Marczelloo", section: "access", field: "operator", from: "dashboard access", to: `no access for ${id}` });
        }
        await new Promise((resolve) => setTimeout(resolve, 240));
      }

      return json({
        ok: true,
        access: {
          ownerId: "400000000000000000",
          ownerName: entry.viewerIsOwner ? "Marczelloo" : "Someone else",
          viewerIsOwner: entry.viewerIsOwner,
          operators: entry.operators,
          maxOperators: 25,
        },
        log: entry.log,
      });
    }

    if (url.includes("/api/dashboard/me")) {
      return json({ ok: true, user: { id: "u1", username: "Marczelloo", avatar: null }, guilds: GUILDS });
    }

    const settingsMatch = /\/api\/dashboard\/guilds\/(\d+)\/settings/.exec(url);
    if (settingsMatch) {
      const guildId = settingsMatch[1];
      // "Test Server" stands in for a server nobody has set anything up in.
      // The empty states are what every new install sees first, so they have to
      // be reachable in the mock rather than only in production.
      if (!store.has(guildId)) store.set(guildId, freshSettings(guildId === GUILDS[2].id));

      if (init.method === "PATCH") {
        const patch = JSON.parse(init.body);
        const current = store.get(guildId);

        const refusal = reject(patch, current);
        if (refusal) {
          await new Promise((resolve) => setTimeout(resolve, 240));
          return json({ ok: false, error: refusal }, 400);
        }

        for (const [group, values] of Object.entries(patch)) {
          // logs.categories and logs.channels are a level deeper than the rest,
          // so a shallow merge here would drop the three keys not being changed
          // and the mock would disagree with the real gateway.
          const merged = { ...current[group] };
          for (const [key, value] of Object.entries(values)) {
            merged[key] =
              value && typeof value === "object" && !Array.isArray(value)
                ? { ...merged[key], ...value }
                : value;
          }
          current[group] = merged;
        }
        // Mirror the gateway's rule rather than letting the mock drift from it.
        if (current.logs && !Object.values(current.logs.categories).some(Boolean)) current.logs.enabled = false;
        if (current.equalizer && patch.equalizer?.bands) current.equalizer.preset = "custom";

        // Mirror the gateway attributing every write, so the Access section has
        // something to show without hand-editing the mock.
        const entry = accessStore.get(guildId);
        if (entry) {
          for (const [section, values] of Object.entries(patch)) {
            for (const [field, value] of Object.entries(values)) {
              entry.log.unshift({
                at: new Date().toISOString(),
                username: "Marczelloo",
                section,
                field,
                from: "previous",
                to: typeof value === "boolean" ? (value ? "on" : "off") : String(value).slice(0, 40),
              });
            }
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 240));
      }

      return json({ ok: true, settings: store.get(guildId), warnings: [] });
    }

    return realFetch(input, init);
  };

  console.info("[mewbit] dev API mock active");
}
