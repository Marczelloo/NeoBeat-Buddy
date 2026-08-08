const artwork = "https://picsum.photos/seed/mewbit-neon-cat/720/720";

const tracks = [
  { id: "mock-current", title: "Tamagotchi", author: "TACONAFIDE", durationMs: 205000, artworkUrl: artwork, source: "soundcloud", sourceLabel: "SoundCloud", requester: "Local Listener", autoplay: false },
  { id: "mock-queue-1", title: "Hit Em Up", author: "2Pac", durationMs: 311000, artworkUrl: artwork, source: "youtube", sourceLabel: "YouTube", requester: "MewBit", autoplay: false },
  { id: "mock-queue-2", title: "Ciepłe Dranie", author: "Kuki", durationMs: 190000, artworkUrl: artwork, source: "soundcloud", sourceLabel: "SoundCloud", requester: "Neko", autoplay: true },
  { id: "mock-queue-3", title: "Afterglow Circuit", author: "MewBit Radio", durationMs: 226000, artworkUrl: artwork, source: "deezer", sourceLabel: "Deezer", requester: "MewBit", autoplay: true },
];

export function createMockState() {
  return {
    guild: { id: "demo", name: "MewBit test room", iconUrl: null, voiceChannelName: "Neon Listening Room" },
    botStatus: "the bassline has been peer reviewed",
    player: {
      connected: true,
      paused: false,
      playing: true,
      positionMs: 73500,
      durationMs: tracks[0].durationMs,
      volume: 52,
      loop: "NONE",
      shuffleActive: false,
      autoplay: true,
      currentTrack: tracks[0],
      queue: tracks.slice(1).map((track, index) => ({ ...track, index })),
      filters: {
        preset: "rnb",
        effectPreset: "off",
        equalizer: [
          { band: 0, gain: 0.08 },
          { band: 1, gain: 0.12 },
          { band: 2, gain: 0.1 },
          { band: 3, gain: 0.03 },
        ],
      },
      lyrics: {
        provider: "LRCLIB",
        synced: true,
        text: "Signal in the midnight\nNeon in the rain",
        lines: [
          { timestamp: 65000, line: "Signal in the midnight" },
          { timestamp: 70500, line: "Neon in the rain" },
          { timestamp: 79000, line: "Keep the room alive" },
          { timestamp: 85500, line: "Let the bassline guide" },
        ],
      },
      updatedAt: Date.now(),
    },
    playlists: [
      { id: "liked", name: "Liked Songs", type: "user", description: "Your saved tracks", trackCount: 42, thumbnail: artwork, public: false, collaborative: false, isDefault: true },
      { id: "night-drive", name: "Night Drive.exe", type: "user", description: "Blue lights, no skips", trackCount: 18, thumbnail: artwork, public: true, collaborative: true, isDefault: false },
    ],
    filterPresets: ["nightcore", "vaporwave", "chipmunk", "deepvoice", "eightd", "karaoke", "wobble", "vibrato", "robot", "telephone", "mono", "surround", "meme"],
  };
}

export const mockSearchResults = [
  { ...tracks[1], id: "search-2pac", title: "Hit Em Up", author: "2Pac", source: "youtube", sourceLabel: "YouTube", playQuery: "https://www.youtube.com/watch?v=41qC3w3UUkU" },
  { ...tracks[0], id: "search-taco", title: "Tamagotchi", author: "TACONAFIDE", source: "soundcloud", sourceLabel: "SoundCloud", playQuery: "Tamagotchi TACONAFIDE" },
  { ...tracks[2], id: "search-kuki", title: "Ciepłe Dranie", author: "Kuki", source: "soundcloud", sourceLabel: "SoundCloud", playQuery: "Ciepłe Dranie Kuki" },
];
