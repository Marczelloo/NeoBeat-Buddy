import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CaretRight,
  Check,
  Cloud,
  DotsSixVertical,
  Faders,
  Headphones,
  Heart,
  ListDashes,
  MagnifyingGlass,
  MusicNotes,
  Pause,
  Play,
  Plus,
  Queue,
  Repeat,
  Rewind,
  Shuffle,
  SkipForward,
  SlidersHorizontal,
  Sparkle,
  Trash,
  UploadSimple,
  VinylRecord,
  SpeakerHigh,
  Waveform,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { setupDiscord } from "./discord.js";
import { connectActivitySocket, fetchActivityState, searchActivity, sendActivityAction } from "./api.js";
import { createMockState, mockSearchResults } from "./mockState.js";

const BAND_LABELS = ["60", "120", "250", "500", "1k", "2k", "4k", "8k", "16k", "31k", "63k", "125k", "250k", "500k", "1m"];
const SOURCE_NAMES = ["auto", "deezer", "youtube", "spotify", "soundcloud"];

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function useCompactViewport() {
  const query = "(max-width: 620px) and (max-height: 420px)";
  const readQuery = () => typeof window !== "undefined" && window.matchMedia(query).matches;
  const [isCompact, setIsCompact] = useState(readQuery);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return isCompact;
}

function sourceLabel(source) {
  return ({ deezer: "Deezer", youtube: "YouTube", spotify: "Spotify", soundcloud: "SoundCloud", auto: "Auto" })[source] || source || "Unknown";
}

function IconButton({ label, children, className = "", ...props }) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} type="button" {...props}>
      {children}
    </button>
  );
}

function SourceTag({ source }) {
  return <span className={`source-tag source-${source || "unknown"}`}>{sourceLabel(source)}</span>;
}

function Artwork({ track, size = "large" }) {
  const [broken, setBroken] = useState(false);
  const artworkUrl = track?.artworkUrl;

  if (!artworkUrl || broken) {
    return (
      <div className={`artwork artwork-${size} artwork-fallback`} aria-label="No artwork available">
        <MusicNotes size={size === "large" ? 56 : 26} weight="duotone" aria-hidden="true" />
        <span className="artwork-grid" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      className={`artwork artwork-${size}`}
      src={artworkUrl}
      alt={`${track.title} artwork`}
      onError={() => setBroken(true)}
    />
  );
}

function PanelTitle({ icon, title, description, action }) {
  return (
    <div className="panel-title">
      <div className="panel-heading">
        <span className="panel-icon">{icon}</span>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function StatusChip({ connection }) {
  const isLive = connection.status === "live";
  return (
    <div className={`status-chip status-${connection.status}`}>
      <span className="status-dot" aria-hidden="true" />
      <span>{isLive ? "Live sync" : connection.status === "preview" ? "Local preview" : "Connecting"}</span>
    </div>
  );
}

function TopBar({ state, context, connection }) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark"><MusicNotes size={21} weight="fill" aria-hidden="true" /></div>
        <div>
          <strong>MewBit</strong>
          <span>shared listening room</span>
        </div>
      </div>
      <div className="room-context">
        <div className="room-icon"><Headphones size={18} weight="duotone" aria-hidden="true" /></div>
        <div>
          <strong>{state.guild.name}</strong>
          <span>{state.guild.voiceChannelName || "Waiting for a voice channel"}</span>
        </div>
      </div>
      <div className="topbar-actions">
        <StatusChip connection={connection} />
        <div className="user-chip" title={context.user?.username || "Listener"}>
          <span>{String(context.user?.username || "Listener").slice(0, 1).toUpperCase()}</span>
        </div>
      </div>
    </header>
  );
}

function PlayerControls({ player, onAction, onTab }) {
  const isPlaying = player.playing && !player.paused;
  return (
    <div className="transport-controls">
      <IconButton label="Play previous track" onClick={() => onAction("previous")}>
        <Rewind size={20} weight="bold" aria-hidden="true" />
      </IconButton>
      <button className="play-button" type="button" aria-label={isPlaying ? "Pause track" : "Play track"} onClick={() => onAction("toggle")}>
        {isPlaying ? <Pause size={24} weight="fill" aria-hidden="true" /> : <Play size={24} weight="fill" aria-hidden="true" />}
      </button>
      <IconButton label="Skip track" onClick={() => onAction("skip")}>
        <SkipForward size={20} weight="bold" aria-hidden="true" />
      </IconButton>
      <span className="control-divider" aria-hidden="true" />
      <IconButton label={`Loop mode ${player.loop}`} className={player.loop !== "NONE" ? "is-active" : ""} onClick={() => onAction("loop")}>
        <Repeat size={19} weight={player.loop !== "NONE" ? "fill" : "regular"} aria-hidden="true" />
      </IconButton>
      <IconButton label="Shuffle queue" onClick={() => onAction("shuffle")}>
        <Shuffle size={19} aria-hidden="true" />
      </IconButton>
      <IconButton label="Open lyrics" onClick={() => onTab("lyrics")}>
        <MusicNotes size={19} aria-hidden="true" />
      </IconButton>
    </div>
  );
}

function NowPlaying({ state, position, onAction, onTab }) {
  const { player } = state;
  const track = player.currentTrack;
  const duration = Math.max(player.durationMs || track?.durationMs || 0, 1);
  const progress = clamp(position, 0, duration);
  const [seekValue, setSeekValue] = useState(progress);

  useEffect(() => setSeekValue(progress), [progress]);

  const commitSeek = () => onAction("seek", { positionMs: Number(seekValue) });
  const volume = clamp(Number(player.volume || 0), 0, 100);

  return (
    <section className="now-playing panel-surface">
      <div className="section-kicker"><Waveform size={14} weight="bold" aria-hidden="true" /> NOW PLAYING</div>
      <div className="now-playing-main">
        <div className={`cover-wrap ${player.playing ? "is-playing" : ""}`}>
          <Artwork track={track} size="large" />
          <div className="cover-signal" aria-hidden="true"><span /><span /><span /><span /></div>
        </div>
        <div className="track-copy">
          <div className="track-source-line"><SourceTag source={track?.source} /><span>{player.connected ? "streaming now" : "player offline"}</span></div>
          <h1>{track?.title || "Nothing is playing"}</h1>
          <p>{track?.author || "Pick a track from search to start the room"}</p>
          <div className="track-meta">
            <span>{track?.isStream ? "LIVE" : formatTime(track?.durationMs)}</span>
            {track?.requester ? <span>added by {track.requester}</span> : null}
          </div>
        </div>
      </div>
      <div className="progress-block">
        <input
          className="range range-progress"
          type="range"
          min="0"
          max={duration}
          value={seekValue}
          aria-label="Seek through current track"
          style={{ "--range-progress": `${(progress / duration) * 100}%` }}
          onChange={(event) => setSeekValue(Number(event.target.value))}
          onPointerUp={commitSeek}
          onKeyUp={(event) => {
            if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") commitSeek();
          }}
        />
        <div className="time-row"><span>{formatTime(seekValue)}</span><span>{formatTime(duration)}</span></div>
      </div>
      <PlayerControls player={player} onAction={onAction} onTab={onTab} />
      <div className="volume-row">
        <IconButton label={volume === 0 ? "Unmute" : "Mute"} className="subtle-icon" onClick={() => onAction("volume", { volume: volume === 0 ? 52 : 0 })}>
          <SpeakerHigh size={18} weight={volume === 0 ? "regular" : "fill"} aria-hidden="true" />
        </IconButton>
        <input
          className="range range-volume"
          type="range"
          min="0"
          max="100"
          value={volume}
          aria-label="Player volume"
          style={{ "--range-progress": `${volume}%` }}
          onChange={(event) => onAction("volume-preview", { volume: Number(event.target.value) })}
          onPointerUp={(event) => onAction("volume", { volume: Number(event.currentTarget.value) })}
          onKeyUp={(event) => {
            if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") onAction("volume", { volume: Number(event.currentTarget.value) });
          }}
        />
        <span className="volume-number">{Math.round(volume)}</span>
      </div>
      <div className="player-footer">
        <button className={`toggle-control ${player.autoplay ? "is-on" : ""}`} type="button" onClick={() => onAction("autoplay", { enabled: !player.autoplay })}>
          <Sparkle size={15} weight={player.autoplay ? "fill" : "regular"} aria-hidden="true" />
          Autoplay {player.autoplay ? "on" : "off"}
        </button>
        <div className="live-readout"><span className="status-dot" aria-hidden="true" /> synced {player.updatedAt ? "now" : "waiting"}</div>
      </div>
    </section>
  );
}

function CompactPlayer({ state, position, onAction, connection }) {
  const { player } = state;
  const track = player.currentTrack;
  const duration = Math.max(player.durationMs || track?.durationMs || 0, 1);
  const progress = clamp(position, 0, duration);
  const [seekValue, setSeekValue] = useState(progress);

  useEffect(() => setSeekValue(progress), [progress]);

  const commitSeek = () => onAction("seek", { positionMs: Number(seekValue) });
  const volume = clamp(Number(player.volume || 0), 0, 100);
  const isPlaying = player.playing && !player.paused;

  return (
    <section className="compact-player" aria-label="MewBit compact player">
      <div className="compact-header">
        <div className={`compact-artwork-wrap ${isPlaying ? "is-playing" : ""}`}>
          <Artwork track={track} size="compact" />
          <div className="compact-artwork-signal" aria-hidden="true"><span /><span /><span /></div>
        </div>
        <div className="compact-copy">
          <div className="compact-kicker"><Waveform size={12} weight="bold" aria-hidden="true" /> MEWBIT PLAYER</div>
          <strong title={track?.title || "Nothing is playing"}>{track?.title || "Nothing is playing"}</strong>
          <div className="compact-meta"><span title={track?.author || "Waiting for a track"}>{track?.author || "Waiting for a track"}</span><SourceTag source={track?.source} /></div>
        </div>
        <div className={`compact-status status-${connection.status}`} title={connection.message} aria-label={connection.message}>
          <span className="status-dot" aria-hidden="true" />
        </div>
      </div>
      <div className="compact-progress">
        <input
          className="range range-progress"
          type="range"
          min="0"
          max={duration}
          value={seekValue}
          aria-label="Seek through current track"
          style={{ "--range-progress": `${(progress / duration) * 100}%` }}
          onChange={(event) => setSeekValue(Number(event.target.value))}
          onPointerUp={commitSeek}
          onKeyUp={(event) => {
            if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") commitSeek();
          }}
        />
        <div className="compact-time"><span>{formatTime(seekValue)}</span><span>{formatTime(duration)}</span></div>
      </div>
      <div className="compact-controls">
        <IconButton label="Play previous track" onClick={() => onAction("previous")}><Rewind size={18} weight="bold" aria-hidden="true" /></IconButton>
        <button className="play-button compact-play" type="button" aria-label={isPlaying ? "Pause track" : "Play track"} onClick={() => onAction("toggle")}>
          {isPlaying ? <Pause size={19} weight="fill" aria-hidden="true" /> : <Play size={19} weight="fill" aria-hidden="true" />}
        </button>
        <IconButton label="Skip track" onClick={() => onAction("skip")}><SkipForward size={18} weight="bold" aria-hidden="true" /></IconButton>
        <IconButton label="Refresh lyrics" onClick={() => onAction("refresh_lyrics")}><MusicNotes size={18} aria-hidden="true" /></IconButton>
        <IconButton label={volume === 0 ? "Unmute" : "Mute"} onClick={() => onAction("volume", { volume: volume === 0 ? 52 : 0 })}>
          <SpeakerHigh size={18} weight={volume === 0 ? "regular" : "fill"} aria-hidden="true" />
        </IconButton>
      </div>
      <div className="compact-volume" aria-label="Player volume">
        <SpeakerHigh size={14} aria-hidden="true" />
        <input
          className="range range-volume"
          type="range"
          min="0"
          max="100"
          value={volume}
          aria-label="Player volume"
          style={{ "--range-progress": `${volume}%` }}
          onChange={(event) => onAction("volume-preview", { volume: Number(event.target.value) })}
          onPointerUp={(event) => onAction("volume", { volume: Number(event.currentTarget.value) })}
          onKeyUp={(event) => {
            if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") onAction("volume", { volume: Number(event.currentTarget.value) });
          }}
        />
        <span>{Math.round(volume)}</span>
      </div>
    </section>
  );
}

function QueuePanel({ queue, onAction }) {
  const [draggedIndex, setDraggedIndex] = useState(null);

  return (
    <div className="queue-list" onDragOver={(event) => event.preventDefault()}>
      {queue.length === 0 ? (
        <div className="empty-state compact"><Queue size={30} weight="duotone" aria-hidden="true" /><strong>Queue is clear</strong><span>Search for a track to keep the room moving.</span></div>
      ) : queue.map((track, index) => (
        <div
          className={`queue-row ${draggedIndex === index ? "is-dragged" : ""}`}
          key={`${track.id}-${index}`}
          draggable
          onDragStart={() => setDraggedIndex(index)}
          onDragEnd={() => setDraggedIndex(null)}
          onDrop={() => {
            if (draggedIndex !== null && draggedIndex !== index) onAction("move_queue", { from: draggedIndex, to: index });
            setDraggedIndex(null);
          }}
        >
          <div className="drag-handle" aria-label="Drag to reorder"><DotsSixVertical size={18} aria-hidden="true" /></div>
          <Artwork track={track} size="small" />
          <div className="queue-track-copy"><strong>{track.title}</strong><span>{track.author}</span></div>
          <SourceTag source={track.source} />
          {track.autoplay ? <span className="autoplay-mark" title="Added by autoplay"><Sparkle size={15} weight="fill" aria-hidden="true" /></span> : null}
          <span className="queue-duration">{formatTime(track.durationMs)}</span>
          <IconButton label={`Remove ${track.title} from queue`} className="queue-remove" onClick={() => onAction("remove_queue", { position: index })}>
            <Trash size={16} aria-hidden="true" />
          </IconButton>
        </div>
      ))}
      {queue.length ? <button className="clear-queue" type="button" onClick={() => onAction("clear_queue")}><Trash size={15} aria-hidden="true" /> Clear queue</button> : null}
    </div>
  );
}

function SearchPanel({ query, setQuery, source, setSource, results, status, onSearch, onAction }) {
  return (
    <div className="search-panel">
      <div className="search-bar-row">
        <div className="search-input-wrap"><MagnifyingGlass size={18} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }} placeholder="Search title, artist, or a direct link" aria-label="Search music" /></div>
        <select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Search source">
          {SOURCE_NAMES.map((name) => <option value={name} key={name}>{sourceLabel(name)}</option>)}
        </select>
        <button className="primary-button" type="button" onClick={onSearch}><MagnifyingGlass size={17} weight="bold" aria-hidden="true" /> Search</button>
      </div>
      <div className="search-caption"><span>{status === "searching" ? "Searching all providers" : status === "error" ? "Search needs attention" : "Results ranked by match quality and provider confidence"}</span><span className="source-coverage"><Cloud size={15} aria-hidden="true" /> Deezer + YouTube + Spotify + SoundCloud</span></div>
      {status === "searching" ? <div className="skeleton-list" aria-label="Loading search results"><span /><span /><span /></div> : null}
      {status === "error" ? <div className="inline-error"><WarningCircle size={18} aria-hidden="true" /> Search is temporarily unavailable. Check the Lavalink connection.</div> : null}
      {status === "empty" ? <div className="empty-state compact"><MagnifyingGlass size={30} weight="duotone" aria-hidden="true" /><strong>No close matches</strong><span>Try the artist name, a direct URL, or another source.</span></div> : null}
      {status !== "searching" && results.length > 0 ? <div className="search-results">{results.map((track) => (
        <div className="result-row" key={track.id}>
          <Artwork track={track} size="small" />
          <div className="result-copy"><strong>{track.title}</strong><span>{track.author}</span><div><SourceTag source={track.source} /> <span className="result-duration">{formatTime(track.durationMs)}</span></div></div>
          <button className="result-action" type="button" onClick={() => onAction("play", { query: track.playQuery || track.uri || `${track.title} ${track.author}`, source: track.source, prepend: false })}><Play size={16} weight="fill" aria-hidden="true" /> Play</button>
          <button className="result-next" type="button" onClick={() => onAction("play", { query: track.playQuery || track.uri || `${track.title} ${track.author}`, source: track.source, prepend: true })} title="Play next"><Plus size={17} weight="bold" aria-hidden="true" /></button>
        </div>
      ))}</div> : null}
    </div>
  );
}

function FiltersPanel({ filters, filterPresets, onAction }) {
  const values = useMemo(() => Array.from({ length: 15 }, (_, index) => filters.equalizer?.find((band) => band.band === index)?.gain ?? 0), [filters.equalizer]);
  const [bands, setBands] = useState(values);
  useEffect(() => setBands(values), [values]);

  const commitBands = () => onAction("equalizer", { bands: bands.map((gain, band) => ({ band, gain })) });
  return (
    <div className="filters-panel">
      <div className="filter-section"><div className="filter-label-row"><div><strong>Fun filters</strong><span>One-click Lavalink effects</span></div><button className="ghost-button" type="button" onClick={() => onAction("filter", { preset: "off" })}>Reset</button></div><div className="filter-grid">{(filterPresets || []).map((preset) => <button type="button" key={preset} className={`filter-tile ${filters.effectPreset === preset ? "is-selected" : ""}`} onClick={() => onAction("filter", { preset })}><Faders size={17} aria-hidden="true" /><span>{preset}</span>{filters.effectPreset === preset ? <Check size={15} weight="bold" aria-hidden="true" /> : null}</button>)}</div></div>
      <div className="filter-section eq-section"><div className="filter-label-row"><div><strong>15-band EQ</strong><span>{filters.preset === "custom" ? "Custom curve" : `${filters.preset || "flat"} preset`}</span></div><button className="ghost-button" type="button" onClick={() => { setBands(Array(15).fill(0)); onAction("equalizer", { bands: [] }); }}>Flat</button></div><div className="eq-grid">{bands.map((gain, index) => <label className="eq-band" key={index}><input type="range" min="-0.25" max="1" step="0.01" value={gain} aria-label={`${BAND_LABELS[index]} Hz EQ band`} onChange={(event) => setBands((current) => current.map((value, band) => band === index ? Number(event.target.value) : value))} onPointerUp={commitBands} onKeyUp={(event) => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") commitBands(); }} /><span>{BAND_LABELS[index]}</span></label>)}</div></div>
    </div>
  );
}

function LyricsPanel({ lyrics, position, onAction }) {
  const lines = lyrics?.lines || [];
  const activeLine = lines.reduce((last, line, index) => line.timestamp <= position ? index : last, -1);
  return (
    <div className="lyrics-panel">
      <PanelTitle icon={<MusicNotes size={18} aria-hidden="true" />} title="Live lyrics" description={lyrics ? `${lyrics.provider} ${lyrics.synced ? "synced" : "static"}` : "Nothing loaded for this track"} action={<button className="ghost-button" type="button" onClick={() => onAction("refresh_lyrics")}><UploadSimple size={15} aria-hidden="true" /> Refresh</button>} />
      {!lyrics ? <div className="empty-state"><MusicNotes size={38} weight="duotone" aria-hidden="true" /><strong>No lyrics loaded</strong><span>Ask MewBit to check the current track again.</span><button className="secondary-button" type="button" onClick={() => onAction("refresh_lyrics")}>Find lyrics</button></div> : null}
      {lyrics?.synced && lines.length ? <div className="lyrics-lines">{lines.map((line, index) => <p className={index === activeLine ? "is-current" : index < activeLine ? "is-past" : ""} key={`${line.timestamp}-${index}`}>{line.line}</p>)}</div> : null}
      {lyrics && !lyrics.synced ? <pre className="static-lyrics">{lyrics.text || "The provider returned no readable lyrics."}</pre> : null}
    </div>
  );
}

function PlaylistsPanel({ playlists, currentTrack, onAction }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const submit = () => { if (!name.trim()) return; onAction("create_playlist", { name: name.trim() }); setName(""); setCreating(false); };
  return (
    <div className="playlists-panel">
      <PanelTitle icon={<VinylRecord size={18} aria-hidden="true" />} title="Playlists" description="Keep a room's best moments close" action={<button className="ghost-button" type="button" onClick={() => setCreating((value) => !value)}><Plus size={15} aria-hidden="true" /> New</button>} />
      {creating ? <div className="create-playlist"><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} placeholder="Playlist name" aria-label="New playlist name" /><button className="primary-button" type="button" onClick={submit}>Create</button></div> : null}
      <div className="playlist-list">{playlists.length ? playlists.map((playlist) => <div className="playlist-row" key={playlist.id}><Artwork track={{ title: playlist.name, artworkUrl: playlist.thumbnail }} size="small" /><div className="playlist-copy"><strong>{playlist.name}</strong><span>{playlist.trackCount} tracks {playlist.collaborative ? "• collaborative" : ""}</span></div><button className="playlist-action" type="button" onClick={() => onAction("play_playlist", { name: playlist.name })}><CaretRight size={18} weight="bold" aria-hidden="true" /></button><button className="playlist-action" type="button" disabled={!currentTrack} onClick={() => onAction("add_to_playlist", { name: playlist.name })} title="Save current track"><Heart size={17} aria-hidden="true" /></button></div>) : <div className="empty-state compact"><VinylRecord size={30} weight="duotone" aria-hidden="true" /><strong>No playlists yet</strong><span>Create one for this server.</span></div>}</div>
    </div>
  );
}

function Workspace({ state, activeTab, setActiveTab, search, onAction }) {
  const tabs = [
    ["queue", "Queue", <ListDashes size={17} aria-hidden="true" />],
    ["search", "Search", <MagnifyingGlass size={17} aria-hidden="true" />],
    ["filters", "Sound", <SlidersHorizontal size={17} aria-hidden="true" />],
    ["lyrics", "Lyrics", <MusicNotes size={17} aria-hidden="true" />],
    ["playlists", "Playlists", <VinylRecord size={17} aria-hidden="true" />],
  ];
  return (
    <section className="workspace panel-surface">
      <nav className="workspace-tabs" aria-label="Activity workspace">
        {tabs.map(([value, label, icon]) => <button type="button" className={activeTab === value ? "is-active" : ""} key={value} onClick={() => setActiveTab(value)}>{icon}<span>{label}</span>{value === "queue" ? <b>{state.player.queue.length}</b> : null}</button>)}
      </nav>
      <div className="workspace-body">
        {activeTab === "queue" ? <><PanelTitle icon={<Queue size={18} aria-hidden="true" />} title="Up next" description={`${state.player.queue.length} tracks in the room`} action={<button className="ghost-button" type="button" onClick={() => onAction("clear_queue")} disabled={!state.player.queue.length}><Trash size={15} aria-hidden="true" /> Clear</button>} /><QueuePanel queue={state.player.queue} onAction={onAction} /></> : null}
        {activeTab === "search" ? <><PanelTitle icon={<MagnifyingGlass size={18} aria-hidden="true" />} title="Find a track" description="Search providers together, then choose the exact source" /><SearchPanel {...search} onAction={onAction} /></> : null}
        {activeTab === "filters" ? <><PanelTitle icon={<SlidersHorizontal size={18} aria-hidden="true" />} title="Shape the sound" description="EQ and playful filters are applied to the live player" /><FiltersPanel filters={state.player.filters} filterPresets={state.filterPresets} onAction={onAction} /></> : null}
        {activeTab === "lyrics" ? <LyricsPanel lyrics={state.player.lyrics} position={state.player.positionMs} onAction={onAction} /> : null}
        {activeTab === "playlists" ? <PlaylistsPanel playlists={state.playlists} currentTrack={state.player.currentTrack} onAction={onAction} /> : null}
      </div>
    </section>
  );
}

function App() {
  const [state, setState] = useState(() => createMockState());
  const [context, setContext] = useState({ mode: "local", guildId: "demo", accessToken: null, user: { username: "Local Listener" } });
  const [connection, setConnection] = useState({ status: "connecting", message: "Starting Activity" });
  const [activeTab, setActiveTab] = useState("queue");
  const [clock, setClock] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSource, setSearchSource] = useState("auto");
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState("idle");
  const syncAt = useRef(Date.now());
  const isCompact = useCompactViewport();

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const applyState = useCallback((nextState) => {
    if (!nextState) return;
    syncAt.current = Date.now();
    setState(nextState);
  }, []);

  useEffect(() => {
    let stopSocket = null;
    let alive = true;

    setupDiscord()
      .then(async (nextContext) => {
        if (!alive) return;
        setContext(nextContext);
        try {
          const response = await fetchActivityState(nextContext);
          if (alive && response.state) applyState(response.state);
          if (alive) setConnection({ status: "live", message: "Realtime gateway connected" });
        } catch (error) {
          if (alive) {
            setConnection({ status: "preview", message: error.message });
            showToast("Showing the local Activity preview. Start the gateway for live controls.", "info");
          }
        }

        stopSocket = connectActivitySocket({
          ...nextContext,
          onState: (nextState) => { if (alive) { applyState(nextState); setConnection({ status: "live", message: "Realtime gateway connected" }); } },
          onReady: () => { if (alive) setConnection({ status: "live", message: "Realtime gateway connected" }); },
          onError: (error) => { if (alive && nextContext.mode === "discord") setConnection({ status: "preview", message: error.message }); },
        });
      })
      .catch((error) => {
        if (alive) {
          setConnection({ status: "preview", message: error.message });
          showToast(error.message, "error");
        }
      });

    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => { alive = false; stopSocket?.(); window.clearInterval(timer); };
  }, [applyState, showToast]);

  const position = useMemo(() => {
    const player = state.player;
    if (!player.playing || player.paused) return player.positionMs;
    return clamp(player.positionMs + (clock - syncAt.current), 0, player.durationMs || Number.MAX_SAFE_INTEGER);
  }, [clock, state.player]);

  const localMutation = useCallback((action, payload) => {
    setState((current) => {
      const next = structuredClone(current);
      if (action === "toggle") next.player.playing = !next.player.playing, next.player.paused = !next.player.playing;
      if (action === "pause") next.player.playing = false, next.player.paused = true;
      if (action === "resume") next.player.playing = true, next.player.paused = false;
      if (action === "volume") next.player.volume = payload.volume;
      if (action === "volume-preview") next.player.volume = payload.volume;
      if (action === "seek") next.player.positionMs = payload.positionMs;
      if (action === "autoplay") next.player.autoplay = payload.enabled;
      if (action === "loop") next.player.loop = next.player.loop === "NONE" ? "TRACK" : next.player.loop === "TRACK" ? "QUEUE" : "NONE";
      if (action === "skip") {
        const [nextTrack, ...remaining] = next.player.queue;
        if (nextTrack) {
          next.player.currentTrack = nextTrack;
          next.player.durationMs = nextTrack.durationMs;
          next.player.positionMs = 0;
          next.player.queue = remaining;
          next.player.playing = true;
          next.player.paused = false;
        } else {
          next.player.playing = false;
          next.player.paused = true;
        }
      }
      if (action === "previous") next.player.positionMs = 0;
      if (action === "shuffle") next.player.queue.sort(() => Math.random() - 0.5);
      if (action === "remove_queue") next.player.queue.splice(payload.position, 1);
      if (action === "clear_queue") next.player.queue = [];
      if (action === "move_queue") { const [track] = next.player.queue.splice(payload.from, 1); next.player.queue.splice(payload.to, 0, track); }
      if (action === "filter") next.player.filters.effectPreset = payload.preset;
      if (action === "equalizer") { next.player.filters.equalizer = payload.bands; next.player.filters.preset = "custom"; }
      if (action === "play") {
        const result = searchResults.find((track) => track.playQuery === payload.query);
        if (result && next.player.currentTrack) {
          if (payload.prepend) next.player.queue.unshift(result);
          else next.player.queue.push(result);
        } else if (result) {
          next.player.currentTrack = result;
          next.player.durationMs = result.durationMs;
          next.player.positionMs = 0;
          next.player.playing = true;
          next.player.paused = false;
        }
      }
      next.player.updatedAt = Date.now();
      return next;
    });
  }, [searchResults]);

  const onAction = useCallback(async (action, payload = {}) => {
    if (action === "volume-preview") { localMutation(action, payload); return; }
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const shouldHitGateway = context.mode === "discord" || Boolean(import.meta.env.VITE_ACTIVITY_GATEWAY_URL || import.meta.env.VITE_ACTIVITY_CONNECT_LOCAL);
      if (shouldHitGateway) {
        const response = await sendActivityAction({ ...context, action, payload });
        applyState(response.state);
        showToast(action === "play" ? "Added to the room" : "Player updated", "success");
      } else {
        localMutation(action, payload);
        showToast("Local preview updated", "info");
      }
    } catch (error) {
      if (context.mode === "local") {
        localMutation(action, payload);
        showToast("Local preview updated. The live gateway is offline.", "info");
      } else {
        showToast(error.message, "error");
      }
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, applyState, context, localMutation, showToast]);

  const runSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (query.length < 2) { setSearchResults([]); setSearchStatus("idle"); return; }
    setSearchStatus("searching");
    try {
      if (context.mode === "local" && !import.meta.env.VITE_ACTIVITY_CONNECT_LOCAL) {
        const normalized = query.toLowerCase();
        const localResults = mockSearchResults.filter((track) => `${track.title} ${track.author}`.toLowerCase().includes(normalized) || normalized.split(" ").some((token) => `${track.title} ${track.author}`.toLowerCase().includes(token)));
        setSearchResults(localResults);
        setSearchStatus(localResults.length ? "idle" : "empty");
      } else {
        const response = await searchActivity({ ...context, query, source: searchSource });
        const nextResults = response.tracks || [];
        setSearchResults(nextResults);
        setSearchStatus(nextResults.length ? "idle" : "empty");
      }
    } catch (error) {
      setSearchResults([]);
      setSearchStatus("error");
      showToast(error.message, "error");
    }
  }, [context, searchQuery, searchSource, showToast]);

  useEffect(() => {
    if (activeTab !== "search" || searchQuery.trim().length < 2) return undefined;
    const timer = window.setTimeout(runSearch, 380);
    return () => window.clearTimeout(timer);
  }, [activeTab, runSearch, searchQuery]);

  const searchProps = {
    query: searchQuery,
    setQuery: setSearchQuery,
    source: searchSource,
    setSource: setSearchSource,
    results: searchResults,
    status: searchStatus,
    onSearch: runSearch,
  };

  return (
    <main className={`activity-app ${isCompact ? "is-compact" : ""}`}>
      {isCompact ? <CompactPlayer state={{ ...state, player: { ...state.player, positionMs: position } }} position={position} onAction={onAction} connection={connection} /> : <>
        <TopBar state={state} context={context} connection={connection} />
        <div className="activity-body">
          <NowPlaying state={{ ...state, player: { ...state.player, positionMs: position } }} position={position} onAction={onAction} onTab={setActiveTab} />
          <Workspace state={{ ...state, player: { ...state.player, positionMs: position } }} activeTab={activeTab} setActiveTab={setActiveTab} search={searchProps} onAction={onAction} />
        </div>
        <footer className="activity-footer"><span><span className="status-dot" aria-hidden="true" /> MewBit keeps the bot and Lavalink in control</span><span>{actionBusy ? "Applying change" : connection.message}</span></footer>
      </>}
      {toast ? <div className={`toast toast-${toast.type}`} role="status"><span>{toast.type === "error" ? <WarningCircle size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}</span>{toast.message}<button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={16} aria-hidden="true" /></button></div> : null}
    </main>
  );
}

export default App;
