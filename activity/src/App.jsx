import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CaretRight,
  Check,
  Cloud,
  DotsSixVertical,
  Faders,
  Heart,
  House,
  LinkSimple,
  ListDashes,
  MagnifyingGlass,
  MusicNotes,
  Pause,
  Play,
  Plus,
  Queue,
  Repeat,
  SkipBack,
  Shuffle,
  SkipForward,
  SlidersHorizontal,
  Sparkle,
  Trash,
  UploadSimple,
  VinylRecord,
  SpeakerHigh,
  SpeakerSlash,
  Stop,
  Waveform,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { setupDiscord } from "./discord.js";
import { connectActivitySocket, fetchActivityState, searchActivity, sendActivityAction } from "./api.js";
import { parseMusicLink } from "./musicLink.js";
import { createMockState, mockSearchResults } from "./mockState.js";

const BAND_LABELS = ["60", "120", "250", "500", "1k", "2k", "4k", "8k", "16k", "31k", "63k", "125k", "250k", "500k", "1m"];
const SOURCE_NAMES = ["auto", "youtube", "soundcloud", "deezer", "spotify"];
const COMPACT_STATUS_FALLBACKS = [
  "neon ears engaged",
  "the bassline has been peer reviewed",
  "catgirl-approved queue detected",
  "MewBit is judging this transition",
  "algorithmically silly, emotionally loud",
];

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatEqGain(gain) {
  const value = Number(gain) || 0;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
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
  return ({ deezer: "Deezer", youtube: "YouTube", spotify: "Spotify", soundcloud: "SoundCloud", auto: "YouTube first", direct: "Direct link" })[source] || source || "Unknown";
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

function resolveArtworkUrl(artworkUrl) {
  if (!artworkUrl) return null;

  try {
    const parsed = new URL(artworkUrl, window.location.origin);
    if (["data:", "blob:"].includes(parsed.protocol) || parsed.origin === window.location.origin) return parsed.toString();
    return `/api/activity/artwork?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return null;
  }
}

function Artwork({ track, size = "large" }) {
  const [broken, setBroken] = useState(false);
  const artworkUrl = track?.artworkUrl;
  const resolvedArtworkUrl = resolveArtworkUrl(artworkUrl);

  useEffect(() => setBroken(false), [artworkUrl]);

  if (!resolvedArtworkUrl || broken) {
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
      src={resolvedArtworkUrl}
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

function PlayerControls({ player, volume, onAction, onTab }) {
  const isPlaying = player.playing && !player.paused;
  return (
    <div className="player-control-deck">
      <div className="player-control-side player-control-left">
        <button className={`autoplay-control ${player.autoplay ? "is-on" : ""}`} type="button" onClick={() => onAction("autoplay", { enabled: !player.autoplay })} aria-pressed={player.autoplay}>
          <Sparkle size={16} weight={player.autoplay ? "fill" : "regular"} aria-hidden="true" />
          <span>Autoplay</span>
        </button>
      </div>
      <div className="transport-controls">
        <IconButton label={`Loop mode ${player.loop}`} className={player.loop !== "NONE" ? "is-active" : ""} onClick={() => onAction("loop")}>
          <Repeat size={19} weight={player.loop !== "NONE" ? "fill" : "regular"} aria-hidden="true" />
        </IconButton>
        <IconButton label="Play previous track" onClick={() => onAction("previous")}>
          <SkipBack size={20} weight="regular" aria-hidden="true" />
        </IconButton>
        <button className="play-button" type="button" aria-label={isPlaying ? "Pause track" : "Play track"} onClick={() => onAction("toggle")}>
          {isPlaying ? <Pause size={24} weight="fill" aria-hidden="true" /> : <Play size={24} weight="fill" aria-hidden="true" />}
        </button>
        <IconButton label="Stop playback and clear queue" onClick={() => onAction("stop")} disabled={!player.currentTrack}>
          <Stop size={19} weight="fill" aria-hidden="true" />
        </IconButton>
        <IconButton label="Skip track" onClick={() => onAction("skip")}>
          <SkipForward size={20} weight="regular" aria-hidden="true" />
        </IconButton>
        <IconButton label="Shuffle queue" onClick={() => onAction("shuffle")}>
          <Shuffle size={19} weight="regular" aria-hidden="true" />
        </IconButton>
      </div>
      <div className="player-control-side player-control-right">
        <IconButton label="Open lyrics" onClick={() => onTab("lyrics")}>
          <MusicNotes size={19} weight="regular" aria-hidden="true" />
        </IconButton>
        <IconButton label={volume === 0 ? "Unmute" : "Mute"} onClick={() => onAction("volume", { volume: volume === 0 ? 52 : 0 })}>
          {volume === 0 ? <SpeakerSlash size={18} weight="regular" aria-hidden="true" /> : <SpeakerHigh size={18} weight="fill" aria-hidden="true" />}
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
    </div>
  );
}

function NowPlaying({ state, position, onAction, onTab, className = "" }) {
  const { player } = state;
  const track = player.currentTrack;
  const duration = Math.max(player.durationMs || track?.durationMs || 0, 1);
  const progress = clamp(position, 0, duration);
  const [seekValue, setSeekValue] = useState(progress);

  useEffect(() => setSeekValue(progress), [progress]);

  const commitSeek = () => onAction("seek", { positionMs: Number(seekValue) });
  const volume = clamp(Number(player.volume || 0), 0, 100);

  return (
    <section className={`now-playing panel-surface ${className}`}>
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
      <PlayerControls player={player} volume={volume} onAction={onAction} onTab={onTab} />
    </section>
  );
}

function CompactPlayer({ state, position }) {
  const { player } = state;
  const track = player.currentTrack;
  const duration = Math.max(player.durationMs || track?.durationMs || 0, 1);
  const progress = clamp(position, 0, duration);
  const lines = player.lyrics?.lines || [];
  const lyricIndex = lines.reduce((last, line, index) => line.timestamp <= position ? index : last, -1);
  const currentLyricIndex = lyricIndex >= 0 ? lyricIndex : 0;
  const activeLyric = lines[currentLyricIndex]?.line || player.lyrics?.text?.split("\n").find(Boolean);
  const previousLyric = lines[currentLyricIndex - 1]?.line;
  const upcomingLyric = lines[currentLyricIndex + 1]?.line;
  const hasLyrics = Boolean(activeLyric);
  const statusSeed = `${track?.id || "mewbit"}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const statusLine = state.botStatus || COMPACT_STATUS_FALLBACKS[statusSeed % COMPACT_STATUS_FALLBACKS.length];

  if (hasLyrics) {
    return (
      <section className="compact-player compact-lyrics-preview" aria-label="MewBit compact lyrics">
        <div className="compact-lyrics-stack" aria-live="polite" aria-atomic="true">
          <span className={`compact-lyrics-line is-adjacent ${previousLyric ? "" : "is-empty"}`}>{previousLyric || "·"}</span>
          <p className="compact-lyrics-line is-current" key={`${currentLyricIndex}-${activeLyric}`}>{activeLyric}</p>
          <span className={`compact-lyrics-line is-adjacent ${upcomingLyric ? "" : "is-empty"}`}>{upcomingLyric || "·"}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="compact-player compact-now-playing" aria-label="MewBit compact player">
      <div className="compact-header">
        <div className="compact-artwork-wrap">
          <Artwork track={track} size="compact" />
        </div>
        <div className="compact-copy">
          <strong title={track?.title || "Nothing is playing"}>{track?.title || "Nothing is playing"}</strong>
          <div className="compact-meta"><span title={track?.author || "Waiting for a track"}>{track?.author || "Waiting for a track"}</span><SourceTag source={track?.source} /></div>
        </div>
      </div>
      <div className="compact-progress" role="progressbar" aria-label="Track progress" aria-valuemin="0" aria-valuemax={duration} aria-valuenow={progress}>
        <span style={{ "--compact-progress": `${(progress / duration) * 100}%` }} />
      </div>
      <div className="compact-flags" aria-label="Player modes">
        <span className={player.autoplay ? "is-on" : ""}>Autoplay {player.autoplay ? "on" : "off"}</span>
        <span className={player.loop !== "NONE" ? "is-on" : ""}>Loop {player.loop !== "NONE" ? player.loop.toLowerCase() : "off"}</span>
        <span className={player.shuffleActive ? "is-on" : ""}>Shuffle {player.shuffleActive ? "on" : "off"}</span>
      </div>
      <p className="compact-presence">{statusLine}</p>
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
          <div className="queue-track-copy">
            <strong>{track.title}</strong>
            <span>{track.author}</span>
            <div className="queue-track-meta">
              <SourceTag source={track.source} />
              {track.autoplay ? <span className="autoplay-mark" title="Added by autoplay"><Sparkle size={13} weight="fill" aria-hidden="true" /></span> : null}
              <span className="queue-duration">{formatTime(track.durationMs)}</span>
            </div>
          </div>
          <IconButton label={`Remove ${track.title} from queue`} className="queue-remove" onClick={() => onAction("remove_queue", { position: index })}>
            <Trash size={16} aria-hidden="true" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

function SearchPanel({ query, setQuery, source, setSource, results, status, onSearch, onAction, showSearchBar = true }) {
  const directLink = parseMusicLink(query);
  const directSource = directLink?.source === "direct" ? "auto" : directLink?.source;

  return (
    <div className="search-panel">
      {showSearchBar ? <div className="search-bar-row">
        <div className="search-input-wrap"><MagnifyingGlass size={18} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }} placeholder="Search title, artist, or a direct link" aria-label="Search music" /></div>
        <select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Search source">
          {SOURCE_NAMES.map((name) => <option value={name} key={name}>{sourceLabel(name)}</option>)}
        </select>
        <button className="primary-button" type="button" onClick={onSearch}><MagnifyingGlass size={17} weight="bold" aria-hidden="true" /> Search</button>
      </div> : null}
      <div className="search-caption"><span>{directLink ? "Direct link detected — the source picker is ignored" : status === "searching" ? "Searching the selected source" : status === "error" ? "Search needs attention" : "One source at a time — YouTube first in automatic mode"}</span><span className="source-coverage"><Cloud size={15} aria-hidden="true" /> YouTube → SoundCloud → Deezer → Spotify</span></div>
      {status === "searching" ? <div className="skeleton-list" aria-label="Loading search results"><span /><span /><span /></div> : null}
      {status === "error" ? <div className="inline-error"><WarningCircle size={18} aria-hidden="true" /> Search is temporarily unavailable. Check the Lavalink connection.</div> : null}
      {directLink ? <section className="direct-link-card" aria-label="Direct music link ready">
        <div className="direct-link-icon"><LinkSimple size={22} weight="bold" aria-hidden="true" /></div>
        <div className="direct-link-copy">
          <strong>Ready to play this link</strong>
          <span><SourceTag source={directLink.source} /> Original provider resolution — no search substitute.</span>
          <code title={directLink.url}>{directLink.url}</code>
        </div>
        <div className="direct-link-actions">
          <button className="result-action" type="button" onClick={() => onAction("play", { query: directLink.url, source: directSource, playNow: true })}><Play size={16} weight="fill" aria-hidden="true" /> Play now</button>
          <button className="secondary-button" type="button" onClick={() => onAction("play", { query: directLink.url, source: directSource })}><Plus size={16} weight="bold" aria-hidden="true" /> Add to queue</button>
        </div>
      </section> : null}
      {!directLink && status === "empty" ? <div className="empty-state compact"><MagnifyingGlass size={30} weight="duotone" aria-hidden="true" /><strong>No close matches</strong><span>Try the artist name, a direct URL, or another source.</span></div> : null}
      {!directLink && status !== "searching" && results.length > 0 ? <div className="search-results">{results.map((track) => (
        <div className="result-row" key={track.id}>
          <Artwork track={track} size="small" />
          <div className="result-copy"><strong>{track.title}</strong><span>{track.author}</span><div><SourceTag source={track.source} /> <span className="result-duration">{formatTime(track.durationMs)}</span></div></div>
          <button className="result-action" type="button" onClick={() => onAction("play", { query: track.playQuery || track.uri || `${track.title} ${track.author}`, source: track.source, playNow: true })}><Play size={16} weight="fill" aria-hidden="true" /> Play</button>
          <button className="result-next" type="button" onClick={() => onAction("play", { query: track.playQuery || track.uri || `${track.title} ${track.author}`, source: track.source })} title="Add to queue"><Plus size={17} weight="bold" aria-hidden="true" /></button>
        </div>
      ))}</div> : null}
    </div>
  );
}

function FiltersPanel({ filters, filterPresets, onAction, activeSection = "effects" }) {
  const values = useMemo(() => Array.from({ length: 15 }, (_, index) => filters.equalizer?.find((band) => band.band === index)?.gain ?? 0), [filters.equalizer]);
  const [bands, setBands] = useState(values);
  useEffect(() => setBands(values), [values]);

  const commitBands = () => onAction("equalizer", { bands: bands.map((gain, band) => ({ band, gain })) });
  return (
    <div className="filters-panel">
      {activeSection === "effects" ? <div className="filter-section"><div className="filter-label-row"><div><strong>Fun filters</strong><span>One-click Lavalink effects</span></div><button className="ghost-button" type="button" onClick={() => onAction("filter", { preset: "off" })}>Reset</button></div><div className="filter-grid">{(filterPresets || []).map((preset) => <button type="button" key={preset} className={`filter-tile ${filters.effectPreset === preset ? "is-selected" : ""}`} onClick={() => onAction("filter", { preset })}><Faders size={17} aria-hidden="true" /><span>{preset}</span>{filters.effectPreset === preset ? <Check size={15} weight="bold" aria-hidden="true" /> : null}</button>)}</div></div> : null}
      {activeSection === "equalizer" ? <div className="filter-section eq-section"><div className="filter-label-row"><div><strong>15-band EQ</strong><span>{filters.preset === "custom" ? "Custom curve" : `${filters.preset || "flat"} preset`}</span></div><button className="ghost-button" type="button" onClick={() => { setBands(Array(15).fill(0)); onAction("equalizer", { bands: [] }); }}>Flat</button></div><div className="eq-grid">{bands.map((gain, index) => <label className="eq-band" key={index}><span className="eq-band-label">{BAND_LABELS[index]}</span><span className="eq-slider-control"><input type="range" min="-0.25" max="1" step="0.01" value={gain} aria-label={`${BAND_LABELS[index]} Hz EQ band, ${formatEqGain(gain)} gain`} onChange={(event) => setBands((current) => current.map((value, band) => band === index ? Number(event.target.value) : value))} onPointerUp={commitBands} onKeyUp={(event) => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") commitBands(); }} /></span><span className="eq-band-value">{formatEqGain(gain)}</span></label>)}</div></div> : null}
    </div>
  );
}

function LyricsPanel({ lyrics, position, onAction }) {
  const lines = lyrics?.lines || [];
  const activeLine = lines.reduce((last, line, index) => line.timestamp <= position ? index : last, -1);
  const activeLineRef = useRef(null);

  useEffect(() => {
    if (activeLine < 0) return;
    activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [activeLine]);

  return (
    <div className="lyrics-panel">
      <PanelTitle icon={<MusicNotes size={18} aria-hidden="true" />} title="Live lyrics" description={lyrics ? `${lyrics.provider} ${lyrics.synced ? "synced" : "static"}` : "Nothing loaded for this track"} action={<button className="ghost-button" type="button" onClick={() => onAction("refresh_lyrics")}><UploadSimple size={15} aria-hidden="true" /> Refresh</button>} />
      {!lyrics ? <div className="empty-state"><MusicNotes size={38} weight="duotone" aria-hidden="true" /><strong>No lyrics loaded</strong><span>Ask MewBit to check the current track again.</span><button className="secondary-button" type="button" onClick={() => onAction("refresh_lyrics")}>Find lyrics</button></div> : null}
      {lyrics?.synced && lines.length ? <div className="lyrics-lines">{lines.map((line, index) => <p ref={index === activeLine ? activeLineRef : null} className={index === activeLine ? "is-current" : index < activeLine ? "is-past" : ""} key={`${line.timestamp}-${index}`}>{line.line}</p>)}</div> : null}
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

function GlobalSearch({ query, setQuery, source, setSource, onSearch, onFocus }) {
  return (
    <div className="global-search">
      <MagnifyingGlass size={18} aria-hidden="true" />
      <input
        value={query}
        onFocus={onFocus}
        onChange={(event) => { onFocus?.(); setQuery(event.target.value); }}
        onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }}
        placeholder="What do you want to play?"
        aria-label="Search music"
      />
      <select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Search source">
        {SOURCE_NAMES.map((name) => <option value={name} key={name}>{sourceLabel(name)}</option>)}
      </select>
      <button className="global-search-submit" type="button" onClick={onSearch} aria-label="Search music" title="Search music">
        <MagnifyingGlass size={17} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
}

function DrawerToggle({ side, open, count, onClick }) {
  const isLeft = side === "left";
  return (
    <button
      className={`drawer-toggle drawer-toggle-${side} ${open ? "is-open" : ""}`}
      type="button"
      onClick={onClick}
      aria-label={isLeft ? "Toggle playlists" : "Toggle queue"}
      title={isLeft ? "Playlists" : "Queue"}
    >
      {isLeft ? <VinylRecord size={17} aria-hidden="true" /> : <ListDashes size={17} aria-hidden="true" />}
      {!isLeft ? <span className="drawer-count">{count}</span> : null}
    </button>
  );
}

function PlaylistSidebar({ playlists, selectedPlaylist, onSelect, onView, loading = false }) {
  return (
    <div className="sidebar-content">
      <div className="sidebar-heading">
        <div><span className="sidebar-kicker">YOUR LIBRARY</span><h2>Playlists</h2></div>
        <button className="icon-button" type="button" onClick={() => onView("playlists")} disabled={loading} aria-label="Create or edit playlists" title="Create or edit playlists"><Plus size={18} weight="bold" aria-hidden="true" /></button>
      </div>
      <button className={`library-home ${!selectedPlaylist ? "is-active" : ""}`} type="button" onClick={() => onSelect(null)} disabled={loading}>
        <House size={18} weight={!selectedPlaylist ? "fill" : "regular"} aria-hidden="true" />
        <span>All playlists</span>
      </button>
      {loading ? <div className="sidebar-skeletons" aria-label="Loading playlists"><span /><span /><span /></div> : <div className="playlist-nav-list">
        {(playlists || []).map((playlist) => (
          <button className={`playlist-nav-row ${selectedPlaylist === playlist.id ? "is-active" : ""}`} type="button" key={playlist.id} onClick={() => onSelect(playlist.id)}>
            <Artwork track={{ title: playlist.name, artworkUrl: playlist.thumbnail }} size="small" />
            <span><strong>{playlist.name}</strong><small>{playlist.trackCount} tracks</small></span>
          </button>
        ))}
      </div>}
      <button className="sidebar-footer-action" type="button" onClick={() => onView("playlists")} disabled={loading}><Plus size={16} aria-hidden="true" /> New playlist</button>
    </div>
  );
}

function QueueSidebar({ queue, onAction, loading = false }) {
  return (
    <div className="sidebar-content queue-sidebar-content">
      <div className="sidebar-heading">
        <div><span className="sidebar-kicker">UP NEXT</span><h2>Queue <b>{loading ? "…" : queue.length}</b></h2></div>
        <button className="icon-button" type="button" onClick={() => onAction("clear_queue")} disabled={loading || !queue.length} aria-label="Clear queue" title="Clear queue"><Trash size={16} aria-hidden="true" /></button>
      </div>
      {loading ? <div className="queue-skeletons" aria-label="Loading queue"><span /><span /><span /></div> : <QueuePanel queue={queue} onAction={onAction} />}
    </div>
  );
}

function HomePanel({ onView, loading = false }) {
  if (loading) {
    return (
      <section className="home-panel home-panel-loading panel-surface" aria-busy="true" aria-label="Synchronizing MewBit Activity">
        <div className="home-orbit" aria-hidden="true"><span /><span /><span /></div>
        <div className="home-loading-copy"><span /><strong /><strong /><i /><i /><div><b /><b /></div></div>
        <div className="home-signal" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /></div>
      </section>
    );
  }

  return (
    <section className="home-panel panel-surface">
      <div className="home-orbit" aria-hidden="true"><span /><span /><span /></div>
      <div className="home-copy">
        <span className="home-kicker"><Waveform size={14} weight="bold" aria-hidden="true" /> MEWBIT RADIO</span>
        <h1>Make the room<br /><em>sound like you.</em></h1>
        <p>Search a track, open a playlist, or tune the signal. MewBit keeps the whole room in sync.</p>
        <div className="home-actions">
          <button className="primary-button" type="button" onClick={() => onView("search")}><MagnifyingGlass size={17} weight="bold" aria-hidden="true" /> Find a track</button>
          <button className="secondary-button" type="button" onClick={() => onView("playlists")}><VinylRecord size={17} aria-hidden="true" /> Browse playlists</button>
        </div>
      </div>
      <div className="home-signal" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /></div>
    </section>
  );
}

function ActivityLoader({ message, leaving }) {
  return (
    <section
      className={`activity-loader ${leaving ? "is-leaving" : ""}`}
      aria-label="MewBit is connecting to the listening room"
      aria-live="polite"
      aria-busy="true"
    >
        <div className="loader-ambient loader-ambient-cyan" aria-hidden="true" />
        <div className="loader-ambient loader-ambient-magenta" aria-hidden="true" />
        <div className="loader-content">
          <div className="loader-signal" aria-hidden="true">
            <div className="loader-signal-echo loader-signal-echo-back" />
            <div className="loader-signal-echo loader-signal-echo-mid" />
            <div className="loader-signal-panel">
              <div className="loader-signal-heading">
                <Waveform size={15} weight="bold" />
                <span>ROOM SIGNAL</span>
              </div>
              <div className="loader-spectrum">
                {Array.from({ length: 13 }, (_, index) => <i key={index} style={{ "--bar-index": index }} />)}
              </div>
              <div className="loader-scan" />
              <div className="loader-signal-footer">
                <span>MEWBIT</span>
                <div><i /><i /><i /></div>
              </div>
            </div>
            <div className="loader-packets"><i /><i /><i /></div>
          </div>
        <div className="loader-copy">
          <span className="loader-kicker"><i /> MEWBIT LINK</span>
          <h1>Tuning into the room</h1>
          <p>{message || "Synchronizing player state"}</p>
        </div>
        <div className="loader-progress" role="progressbar" aria-label="Connecting">
          <span />
        </div>
        <div className="loader-steps" aria-hidden="true">
          <span>Discord</span><i />
          <span>Gateway</span><i />
          <span>Player</span>
        </div>
      </div>
    </section>
  );
}

function PlayerBar({ state, position, onAction, onView }) {
  const { player } = state;
  const track = player.currentTrack;
  const duration = Math.max(player.durationMs || track?.durationMs || 0, 1);
  const progress = clamp(position, 0, duration);
  const [seekValue, setSeekValue] = useState(progress);
  const volume = clamp(Number(player.volume || 0), 0, 100);
  const isPlaying = player.playing && !player.paused;

  useEffect(() => setSeekValue(progress), [progress]);

  const commitSeek = () => onAction("seek", { positionMs: Number(seekValue) });
  return (
    <footer className="player-bar">
      <div className="player-bar-leading">
        <button className="player-bar-track" type="button" onClick={() => onView("home")} aria-label="Open full player">
          <Artwork track={track} size="small" />
          <span><strong>{track?.title || "Nothing is playing"}</strong><small>{track?.author || "Choose a track to start the room"}</small></span>
        </button>
        <IconButton label={player.autoplay ? "Disable autoplay" : "Enable autoplay"} className={`bar-autoplay ${player.autoplay ? "is-active" : ""}`} onClick={() => onAction("autoplay", { enabled: !player.autoplay })} aria-pressed={player.autoplay}>
          <Sparkle size={16} weight={player.autoplay ? "fill" : "regular"} aria-hidden="true" />
        </IconButton>
      </div>
      <div className="player-bar-center">
        <div className="bar-controls">
          <IconButton label={`Loop mode ${player.loop}`} className={player.loop !== "NONE" ? "is-active" : ""} onClick={() => onAction("loop")} disabled={!track}><Repeat size={16} weight={player.loop !== "NONE" ? "fill" : "regular"} aria-hidden="true" /></IconButton>
          <IconButton label="Play previous track" onClick={() => onAction("previous")} disabled={!track}><SkipBack size={17} weight="regular" aria-hidden="true" /></IconButton>
          <button className="bar-play" type="button" aria-label={isPlaying ? "Pause track" : "Play track"} onClick={() => onAction("toggle")} disabled={!track}>{isPlaying ? <Pause size={18} weight="fill" aria-hidden="true" /> : <Play size={18} weight="fill" aria-hidden="true" />}</button>
          <IconButton label="Stop playback and clear queue" onClick={() => onAction("stop")} disabled={!track}><Stop size={16} weight="fill" aria-hidden="true" /></IconButton>
          <IconButton label="Skip track" onClick={() => onAction("skip")} disabled={!track}><SkipForward size={17} weight="regular" aria-hidden="true" /></IconButton>
          <IconButton label="Shuffle queue" onClick={() => onAction("shuffle")} disabled={!track}><Shuffle size={16} weight="regular" aria-hidden="true" /></IconButton>
        </div>
        <div className="bar-progress">
          <span>{formatTime(seekValue)}</span>
          <input className="range range-progress" type="range" min="0" max={duration} value={seekValue} aria-label="Seek through current track" style={{ "--range-progress": `${(progress / duration) * 100}%` }} onChange={(event) => setSeekValue(Number(event.target.value))} onPointerUp={commitSeek} onKeyUp={(event) => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") commitSeek(); }} disabled={!track} />
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <div className="player-bar-actions">
        {track ? <SourceTag source={track.source} /> : null}
        <IconButton label="Open lyrics" onClick={() => onView("lyrics")} disabled={!track}><MusicNotes size={16} weight="regular" aria-hidden="true" /></IconButton>
        <IconButton label={volume === 0 ? "Unmute" : "Mute"} onClick={() => onAction("volume", { volume: volume === 0 ? 52 : 0 })}><SpeakerHigh size={17} weight={volume === 0 ? "regular" : "fill"} aria-hidden="true" /></IconButton>
        <input className="range range-volume bar-volume" type="range" min="0" max="100" value={volume} aria-label="Player volume" style={{ "--range-progress": `${volume}%` }} onChange={(event) => onAction("volume-preview", { volume: Number(event.target.value) })} onPointerUp={(event) => onAction("volume", { volume: Number(event.currentTarget.value) })} />
      </div>
    </footer>
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
  const [activeTab, setActiveTab] = useState("home");
  const [soundSection, setSoundSection] = useState("effects");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 900);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [clock, setClock] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSource, setSearchSource] = useState("auto");
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState("idle");
  const [isHydrating, setIsHydrating] = useState(true);
  const [showLoader, setShowLoader] = useState(true);
  const syncAt = useRef(Date.now());
  const hydrationStartedAt = useRef(Date.now());
  const hydrationTimer = useRef(null);
  const isCompact = useCompactViewport();

  const goToView = useCallback((view) => {
    setActiveTab(view);
  }, []);

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

  const finishHydration = useCallback(() => {
    const remaining = Math.max(0, 720 - (Date.now() - hydrationStartedAt.current));
    window.clearTimeout(hydrationTimer.current);
    hydrationTimer.current = window.setTimeout(() => setIsHydrating(false), remaining);
  }, []);

  useEffect(() => {
    if (isHydrating) return undefined;
    const timer = window.setTimeout(() => setShowLoader(false), 320);
    return () => window.clearTimeout(timer);
  }, [isHydrating]);

  useEffect(() => {
    let stopSocket = null;
    let alive = true;

    setupDiscord()
      .then(async (nextContext) => {
        if (!alive) return;
        setContext(nextContext);

        const connectLocalPreview = nextContext.mode === "local" && Boolean(import.meta.env.VITE_ACTIVITY_CONNECT_LOCAL);
        if (nextContext.mode === "local" && !connectLocalPreview) {
          setConnection({ status: "preview", message: nextContext.reason || "Local Activity preview" });
          finishHydration();
          return;
        }

        try {
          const response = await fetchActivityState(nextContext);
          if (alive && response.state) applyState(response.state);
          if (alive) setConnection({ status: "live", message: "Realtime gateway connected" });
        } catch (error) {
          if (alive) {
            if (nextContext.mode === "local") {
              setConnection({ status: "preview", message: error.message });
            } else {
              setConnection({ status: "error", message: error.message });
              showToast(`Live Activity gateway unavailable: ${error.message}`, "error");
            }
          }
        } finally {
          if (alive) finishHydration();
        }

        stopSocket = connectActivitySocket({
          ...nextContext,
          onState: (nextState) => { if (alive) { applyState(nextState); setConnection({ status: "live", message: "Realtime gateway connected" }); finishHydration(); } },
          onReady: () => { if (alive) setConnection({ status: "live", message: "Realtime gateway connected" }); },
          onError: (error) => { if (alive && nextContext.mode === "discord") setConnection({ status: "preview", message: error.message }); },
        });
      })
      .catch((error) => {
        if (alive) {
          setConnection({ status: "error", message: error.message });
          showToast(`Discord Activity connection failed: ${error.message}`, "error");
          finishHydration();
        }
      });

    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => { alive = false; stopSocket?.(); window.clearInterval(timer); window.clearTimeout(hydrationTimer.current); };
  }, [applyState, finishHydration, showToast]);

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
      if (action === "stop") { next.player.currentTrack = null; next.player.queue = []; next.player.playing = false; next.player.paused = true; next.player.positionMs = 0; }
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
      if (action === "shuffle") { next.player.queue.sort(() => Math.random() - 0.5); next.player.shuffleActive = true; }
      if (action === "remove_queue") next.player.queue.splice(payload.position, 1);
      if (action === "clear_queue") next.player.queue = [];
      if (action === "move_queue") { const [track] = next.player.queue.splice(payload.from, 1); next.player.queue.splice(payload.to, 0, track); }
      if (action === "filter") next.player.filters.effectPreset = payload.preset;
      if (action === "equalizer") { next.player.filters.equalizer = payload.bands; next.player.filters.preset = "custom"; }
      if (action === "play") {
        const result = searchResults.find((track) => track.playQuery === payload.query);
        if (result && next.player.currentTrack) {
          if (payload.playNow) {
            next.player.queue.unshift(next.player.currentTrack);
            next.player.currentTrack = result;
            next.player.durationMs = result.durationMs;
            next.player.positionMs = 0;
            next.player.playing = true;
            next.player.paused = false;
          } else {
            const autoplayIndex = next.player.queue.findIndex((track) => track.autoplayed || track.userData?.autoplay);
            if (autoplayIndex === -1) next.player.queue.push(result);
            else next.player.queue.splice(autoplayIndex, 0, result);
          }
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
        const successMessage = action === "play"
          ? (payload.playNow ? "Playing now" : "Added to queue")
          : action === "stop"
            ? "Playback stopped"
            : null;
        if (successMessage) showToast(successMessage, "success");
      } else {
        localMutation(action, payload);
        if (action === "play") showToast(payload.playNow ? "Playing now" : "Added to queue", "info");
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
    if (parseMusicLink(query)) {
      setSearchResults([]);
      setSearchStatus("direct");
      return;
    }
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

  const viewState = { ...state, player: { ...state.player, positionMs: position } };

  return (
    <main className={`activity-app ${isCompact ? "is-compact" : ""} ${isHydrating ? "is-hydrating" : ""}`}>
      {showLoader ? <ActivityLoader message={connection.message} leaving={!isHydrating} /> : null}
      {isCompact ? <CompactPlayer state={viewState} position={position} /> : <>
        <div className={`app-shell ${leftSidebarOpen ? "left-open" : "left-closed"} ${rightSidebarOpen ? "right-open" : "right-closed"}`}>
          <aside className="sidebar sidebar-left" aria-label="Playlists sidebar">
            <DrawerToggle side="left" open={leftSidebarOpen} onClick={() => setLeftSidebarOpen((value) => !value)} />
            <PlaylistSidebar
              playlists={state.playlists}
              selectedPlaylist={selectedPlaylist}
              onSelect={(playlistId) => { setSelectedPlaylist(playlistId); goToView("playlists"); }}
              onView={goToView}
              loading={isHydrating}
            />
          </aside>
          <section className="main-stage">
            <div className="stage-toolbar">
              <div className="stage-toolbar-inner">
                <div className="stage-navigation" aria-label="Activity navigation">
                  <IconButton label="Home" className={activeTab === "home" ? "is-active" : ""} onClick={() => goToView("home")}><House size={17} weight={activeTab === "home" ? "fill" : "regular"} aria-hidden="true" /></IconButton>
                </div>
                <GlobalSearch {...searchProps} onFocus={() => goToView("search")} />
                <div className="stage-actions" aria-label="Player tools">
                  <IconButton label="Sound settings" className={activeTab === "filters" ? "is-active" : ""} onClick={() => goToView("filters")}><SlidersHorizontal size={17} aria-hidden="true" /></IconButton>
                </div>
              </div>
            </div>
            <div className={`main-content main-view-${activeTab}`}>
              {activeTab === "home" ? (isHydrating ? <HomePanel loading /> : state.player.currentTrack ? <NowPlaying className="now-playing-stage" state={viewState} position={position} onAction={onAction} onTab={goToView} /> : <HomePanel onView={goToView} />) : null}
              {activeTab === "search" ? <section className="content-panel panel-surface"><PanelTitle icon={<MagnifyingGlass size={18} aria-hidden="true" />} title="Find a track" description="Search providers together, then choose the exact source" /><SearchPanel {...searchProps} showSearchBar={false} onAction={onAction} /></section> : null}
              {activeTab === "filters" ? <section className={`content-panel panel-surface filters-surface filters-surface-${soundSection}`}><PanelTitle icon={<SlidersHorizontal size={18} aria-hidden="true" />} title="Shape the sound" description="EQ and playful filters are applied to the live player" action={<div className="sound-mode-actions" role="tablist" aria-label="Sound controls"><button type="button" role="tab" aria-selected={soundSection === "effects"} className={soundSection === "effects" ? "is-active" : ""} onClick={() => setSoundSection("effects")}><Faders size={15} aria-hidden="true" /><span>Effects</span></button><button type="button" role="tab" aria-selected={soundSection === "equalizer"} className={soundSection === "equalizer" ? "is-active" : ""} onClick={() => setSoundSection("equalizer")}><SlidersHorizontal size={15} aria-hidden="true" /><span>Equalizer</span></button></div>} /><FiltersPanel filters={state.player.filters} filterPresets={state.filterPresets} activeSection={soundSection} onAction={onAction} /></section> : null}
              {activeTab === "lyrics" ? <section className="content-panel panel-surface"><LyricsPanel lyrics={state.player.lyrics} position={state.player.positionMs} onAction={onAction} /></section> : null}
              {activeTab === "playlists" ? <section className="content-panel panel-surface"><PlaylistsPanel playlists={state.playlists} currentTrack={state.player.currentTrack} onAction={onAction} /></section> : null}
            </div>
          </section>
          <aside className="sidebar sidebar-right" aria-label="Queue sidebar">
            <DrawerToggle side="right" open={rightSidebarOpen} count={isHydrating ? 0 : state.player.queue.length} onClick={() => setRightSidebarOpen((value) => !value)} />
            <QueueSidebar queue={state.player.queue} onAction={onAction} loading={isHydrating} />
          </aside>
        </div>
        {activeTab === "home" ? null : <PlayerBar state={viewState} position={position} onAction={onAction} onView={goToView} />}
      </>}
      {toast ? <div className={`toast toast-${toast.type}`} role="status"><span>{toast.type === "error" ? <WarningCircle size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}</span>{toast.message}<button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={16} aria-hidden="true" /></button></div> : null}
    </main>
  );
}

export default App;
