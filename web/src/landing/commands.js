import DeployResponse from "./responses/DeployResponse.jsx";
import DjResponse from "./responses/DjResponse.jsx";
import EqResponse from "./responses/EqResponse.jsx";
import FilterResponse from "./responses/FilterResponse.jsx";
import PlayResponse from "./responses/PlayResponse.jsx";
import QueueResponse from "./responses/QueueResponse.jsx";

export const COMMANDS = [
  {
    id: "play",
    signature: "/play <query>",
    match: "play search track song",
    blurb: "Search Deezer, Spotify, SoundCloud and YouTube at once.",
    note: "Example session",
    Response: PlayResponse,
  },
  {
    id: "queue",
    signature: "/queue",
    match: "queue autoplay next list",
    blurb: "See what is coming, and who put it there.",
    note: "Example session",
    Response: QueueResponse,
  },
  {
    id: "dj",
    signature: "/dj",
    match: "dj vote skip role permissions",
    blurb: "Role gating, vote skipping and strict mode.",
    note: "Example session",
    Response: DjResponse,
  },
  {
    id: "eq",
    signature: "/equalizer <preset>",
    match: "eq equalizer preset bass filter sound",
    blurb: "Fifteen bands, 22 presets, plus your own saved per user.",
    note: "Example session",
    Response: EqResponse,
  },
  {
    id: "filter",
    signature: "/filter <effect>",
    match: "filter effect nightcore vaporwave karaoke 8d robot meme fun",
    blurb: "Thirteen one-click effects, stacked on the EQ.",
    note: "Example session",
    Response: FilterResponse,
  },
  {
    id: "deploy",
    signature: "deploy",
    match: "deploy install self host docker clone github repo",
    blurb: "Run the whole thing on your own machine.",
    note: "Real commands",
    cta: true,
    Response: DeployResponse,
  },
];

export const DEFAULT_COMMAND_ID = "play";

export function findCommand(id) {
  return COMMANDS.find((command) => command.id === id) || COMMANDS[0];
}

export function filterCommands(query) {
  const term = query.trim().toLowerCase().replace(/^\//, "");
  if (!term) return COMMANDS;

  const matches = COMMANDS.filter(
    (command) => command.id.includes(term) || command.match.includes(term)
  );
  return matches.length > 0 ? matches : [];
}
