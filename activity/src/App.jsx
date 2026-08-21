import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowBendUpRight,
  Check,
  Cloud,
  DotsSixVertical,
  Faders,
  Globe,
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
  SpinnerGap,
  Trash,
  UploadSimple,
  UsersThree,
  VinylRecord,
  SpeakerHigh,
  SpeakerSlash,
  Stop,
  Waveform,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { setMewbitPresence, setupDiscord } from "./discord.js";
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

function useBufferedSlider(externalValue, { acknowledgementTolerance = 0, optimisticLockMs = 5000 } = {}) {
  const [value, setValue] = useState(externalValue);
  const valueRef = useRef(externalValue);
  const isAdjustingRef = useRef(false);
  const pendingValueRef = useRef(null);
  const pendingUntilRef = useRef(0);

  useEffect(() => {
    if (isAdjustingRef.current) return;

    const pendingValue = pendingValueRef.current;
    if (pendingValue !== null) {
      if (Math.abs(externalValue - pendingValue) <= acknowledgementTolerance) {
        pendingValueRef.current = null;
      } else if (Date.now() < pendingUntilRef.current) {
        valueRef.current = pendingValue;
        setValue(pendingValue);
        return;
      } else {
        pendingValueRef.current = null;
      }
    }

    valueRef.current = externalValue;
    setValue(externalValue);
  }, [acknowledgementTolerance, externalValue]);

  const begin = useCallback(() => {
    isAdjustingRef.current = true;
  }, []);

  const update = useCallback((nextValue) => {
    const numericValue = Number(nextValue);
    if (!Number.isFinite(numericValue)) return valueRef.current;
    isAdjustingRef.current = true;
    pendingValueRef.current = null;
    valueRef.current = numericValue;
    setValue(numericValue);
    return numericValue;
  }, []);

  const commit = useCallback((nextValue) => {
    const committedValue = nextValue === undefined ? valueRef.current : update(nextValue);
    isAdjustingRef.current = false;
    pendingValueRef.current = committedValue;
    pendingUntilRef.current = Date.now() + optimisticLockMs;
    return committedValue;
  }, [optimisticLockMs, update]);

  return { value, begin, update, commit };
}

function usePlayerPosition(player) {
  const [now, setNow] = useState(() => Date.now());
  const anchorRef = useRef({ positionMs: Number(player?.positionMs) || 0, receivedAt: Date.now() });
  const trackId = player?.currentTrack?.id;
  const shouldTick = Boolean(player?.playing && !player?.paused && trackId);

  useEffect(() => {
    anchorRef.current = { positionMs: Number(player?.positionMs) || 0, receivedAt: Date.now() };
    setNow(Date.now());
  }, [player?.positionMs, player?.updatedAt, player?.playing, player?.paused, trackId]);

  useEffect(() => {
    if (!shouldTick) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [shouldTick]);

  if (!shouldTick) return Number(player?.positionMs) || 0;
  const anchor = anchorRef.current;
  return clamp(anchor.positionMs + (now - anchor.receivedAt), 0, Number(player?.durationMs) || Number.MAX_SAFE_INTEGER);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatEqGain(gain) {
  const value = Number(gain) || 0;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function useCompactViewport() {
  const query = "(max-height: 360px), (max-width: 620px) and (max-height: 420px)";
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

const IconButton = forwardRef(function IconButton({ label, children, className = "", loading = false, disabled = false, ...props }, ref) {
  return (
    <button ref={ref} className={`icon-button ${className} ${loading ? "is-loading" : ""}`} aria-label={label} title={label} type="button" disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <SpinnerGap className="button-spinner" size={17} aria-hidden="true" /> : children}
    </button>
  );
});

function getTrackLikeKey(track) {
  const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  return `${normalize(track?.title)}::${normalize(track?.author)}`;
}

function isAutoplayQueueTrack(track) {
  return Boolean(track?.autoplay);
}

function partitionQueueForDisplay(queue = []) {
  const manual = [];
  const autoplay = [];
  for (const track of queue) (isAutoplayQueueTrack(track) ? autoplay : manual).push(track);
  return [...manual, ...autoplay];
}

function moveQueueTrackForDisplay(queue = [], from, to) {
  const tracks = partitionQueueForDisplay(queue);
  const moving = tracks[from];
  const target = tracks[to];
  if (!moving || !target) return tracks;

  const autoplay = isAutoplayQueueTrack(moving);
  const segment = tracks.filter((track) => isAutoplayQueueTrack(track) === autoplay);
  const sourceIndex = segment.indexOf(moving);
  const crossesDivider = isAutoplayQueueTrack(target) !== autoplay;
  let targetIndex = crossesDivider ? (autoplay ? 0 : segment.length) : segment.indexOf(target);
  segment.splice(sourceIndex, 1);
  if (!crossesDivider && sourceIndex < targetIndex) targetIndex -= 1;
  segment.splice(Math.max(0, Math.min(segment.length, targetIndex)), 0, moving);
  const partition = partitionQueueForDisplay(tracks);
  return autoplay ? [...partition.filter((track) => !isAutoplayQueueTrack(track)), ...segment] : [...segment, ...partition.filter(isAutoplayQueueTrack)];
}

function getActionPendingKey(action, payload = {}) {
  if (action === "remove_queue" || action === "play_next") return `${action}:${Number(payload.position)}`;
  return action;
}

function PlaylistMenu({ track, playlists, onAction, className = "" }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const closeTimerRef = useRef(null);
  const triggerRef = useRef(null);

  const clearCloseTimer = () => window.clearTimeout(closeTimerRef.current);
  const closeMenu = (returnFocus = false) => {
    clearCloseTimer();
    setOpen(false);
    if (returnFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => closeMenu(), 260);
  };
  const toggleMenu = (event) => {
    clearCloseTimer();
    if (open) {
      closeMenu(true);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = Math.min(320, 56 + Math.max(1, playlists.length) * 37);
    const openAbove = window.innerHeight - rect.bottom < menuHeight + 14;
    setMenuPosition({
      top: openAbove ? Math.max(10, rect.top - menuHeight - 8) : Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 10),
      left: Math.max(10, Math.min(rect.right - 220, window.innerWidth - 230)),
      });
    setOpen(true);
  };

  useEffect(() => {
    const closeOnOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) closeMenu();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      clearCloseTimer();
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const focusMenuItem = (direction) => {
      const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      const nextIndex = direction === "first" ? 0
        : direction === "last" ? items.length - 1
          : (index + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        focusMenuItem(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusMenuItem(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusMenuItem("first");
      } else if (event.key === "End") {
        event.preventDefault();
        focusMenuItem("last");
      } else if (event.key === "Tab") {
        closeMenu();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const focusTimer = window.requestAnimationFrame(() => focusMenuItem("first"));
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(focusTimer);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`playlist-menu-anchor ${className}`}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleClose}
      onFocus={clearCloseTimer}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose(); }}
    >
      <IconButton ref={triggerRef} label="Add to playlist" className={open ? "is-active" : ""} onClick={toggleMenu} disabled={!track} aria-expanded={open} aria-haspopup="menu">
        <span className="playlist-add-icon"><VinylRecord size={16} aria-hidden="true" /><Plus size={9} weight="bold" aria-hidden="true" /></span>
      </IconButton>
      {open && menuPosition ? createPortal(
        <div ref={menuRef} className="playlist-context-menu" style={menuPosition} role="menu" aria-label={`Add ${track?.title || "track"} to playlist`} onMouseEnter={clearCloseTimer} onMouseLeave={scheduleClose}>
          <span className="playlist-menu-title">Add to playlist</span>
          {playlists.length ? playlists.map((playlist) => <button type="button" role="menuitem" key={playlist.id} onClick={() => { onAction("add_to_playlist", { name: playlist.name, track }); closeMenu(true); }}><VinylRecord size={14} aria-hidden="true" /><span>{playlist.name}</span></button>) : <span className="playlist-menu-empty">Create a playlist first</span>}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function TrackSaveActions({ track, playlists = [], likedTrackIds = [], onAction, isActionPending = () => false, className = "" }) {
  if (!track) return null;
  const isLiked = likedTrackIds.includes(track.id) || likedTrackIds.includes(getTrackLikeKey(track));
  return (
    <div className={`track-save-actions ${className}`}>
      <IconButton label={isLiked ? "Remove from liked songs" : "Add to liked songs"} className={`like-button ${isLiked ? "is-liked" : ""}`} loading={isActionPending("toggle_like")} onClick={() => onAction("toggle_like", { track })} aria-pressed={isLiked}>
        <Heart size={16} weight={isLiked ? "fill" : "regular"} aria-hidden="true" />
      </IconButton>
      <PlaylistMenu track={track} playlists={playlists} onAction={onAction} />
    </div>
  );
}

function SourceTag({ source }) {
  return <span className={`source-tag source-${source || "unknown"}`}>{sourceLabel(source)}</span>;
}

function TrackBadges({ track, className = "" }) {
  const text = `${track?.title || ""} ${track?.author || ""}`.toLowerCase();
  const badges = [
    (track?.explicit || /\bexplicit\b|\buncensored\b|\buncut\b/.test(text)) && "Explicit",
    /\bclean\b|\bcensored\b|radio edit/.test(text) && "Clean",
    /\blive\b|\bconcert\b|\bsession\b/.test(text) && "Live",
    /\bremix\b|\bremaster(?:ed)?\b/.test(text) && "Remix",
  ].filter(Boolean);
  if (!badges.length) return null;
  return <span className={`track-badges ${className}`} aria-label={`Track versions: ${badges.join(", ")}`}>{badges.map((badge) => <span key={badge} className={`track-badge track-badge-${badge.toLowerCase()}`}>{badge}</span>)}</span>;
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
  const [attempt, setAttempt] = useState(0);
  const artworkUrl = track?.artworkUrl;
  const artworkCandidates = [...new Set([artworkUrl, track?.artworkFallbackUrl].filter(Boolean))];
  const resolvedArtworkUrl = resolveArtworkUrl(artworkCandidates[attempt]);

  useEffect(() => setAttempt(0), [artworkUrl, track?.artworkFallbackUrl]);

  if (!resolvedArtworkUrl) {
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
      onError={() => setAttempt((current) => current + 1)}
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

function PlayerControls({ player, volume, playlists = [], likedTrackIds = [], onAction, onTab, isActionPending = () => false }) {
  const isPlaying = player.playing && !player.paused;
  const volumeSlider = useBufferedSlider(volume);
  const previewVolume = (nextValue) => {
    const nextVolume = volumeSlider.update(nextValue);
    onAction("volume-preview", { volume: nextVolume });
  };
  const commitVolume = (nextValue) => onAction("volume", { volume: volumeSlider.commit(nextValue) });

  return (
    <div className="player-control-deck">
      <div className="player-control-side player-control-left">
        <button className={`autoplay-control ${player.autoplay ? "is-on" : ""}`} type="button" onClick={() => onAction("autoplay", { enabled: !player.autoplay })} disabled={isActionPending("autoplay")} aria-busy={isActionPending("autoplay") || undefined} aria-pressed={player.autoplay}>
          {isActionPending("autoplay") ? <SpinnerGap className="button-spinner" size={16} aria-hidden="true" /> : <Sparkle size={16} weight={player.autoplay ? "fill" : "regular"} aria-hidden="true" />}
          <span>Autoplay</span>
        </button>
        <TrackSaveActions track={player.currentTrack} playlists={playlists} likedTrackIds={likedTrackIds} onAction={onAction} isActionPending={isActionPending} className="main-save-actions" />
      </div>
      <div className="transport-controls">
        <IconButton label={`Loop mode ${player.loop}`} className={player.loop !== "NONE" ? "is-active" : ""} loading={isActionPending("loop")} onClick={() => onAction("loop")}>
          <Repeat size={19} weight={player.loop !== "NONE" ? "fill" : "regular"} aria-hidden="true" />
        </IconButton>
        <IconButton label="Play previous track" loading={isActionPending("previous")} onClick={() => onAction("previous")}>
          <SkipBack size={20} weight="regular" aria-hidden="true" />
        </IconButton>
        <button className="play-button" type="button" aria-label={isPlaying ? "Pause track" : "Play track"} onClick={() => onAction("toggle")} disabled={isActionPending("toggle")} aria-busy={isActionPending("toggle") || undefined}>
          {isActionPending("toggle") ? <SpinnerGap className="button-spinner" size={24} aria-hidden="true" /> : isPlaying ? <Pause size={24} weight="fill" aria-hidden="true" /> : <Play size={24} weight="fill" aria-hidden="true" />}
        </button>
        <IconButton label="Stop playback and clear queue" loading={isActionPending("stop")} onClick={() => onAction("stop")} disabled={!player.currentTrack}>
          <Stop size={19} weight="fill" aria-hidden="true" />
        </IconButton>
        <IconButton label="Skip track" loading={isActionPending("skip")} onClick={() => onAction("skip", { expectedTrackId: player.currentTrack?.id })}>
          <SkipForward size={20} weight="regular" aria-hidden="true" />
        </IconButton>
        <IconButton label="Shuffle queue" loading={isActionPending("shuffle")} onClick={() => onAction("shuffle")}>
          <Shuffle size={19} weight="regular" aria-hidden="true" />
        </IconButton>
      </div>
      <div className="player-control-side player-control-right">
        <IconButton label="Open lyrics" onClick={() => onTab("lyrics")}>
          <MusicNotes size={19} weight="regular" aria-hidden="true" />
        </IconButton>
        <IconButton label={volumeSlider.value === 0 ? "Unmute" : "Mute"} loading={isActionPending("volume")} onClick={() => onAction("volume", { volume: volumeSlider.value === 0 ? 52 : 0 })}>
          {volumeSlider.value === 0 ? <SpeakerSlash size={18} weight="regular" aria-hidden="true" /> : <SpeakerHigh size={18} weight="fill" aria-hidden="true" />}
        </IconButton>
        <input
          className="range range-volume"
          type="range"
          min="0"
          max="100"
          value={volumeSlider.value}
          aria-label="Player volume"
          style={{ "--range-progress": `${volumeSlider.value}%` }}
          onPointerDown={volumeSlider.begin}
          onPointerCancel={(event) => commitVolume(event.currentTarget.value)}
          onChange={(event) => previewVolume(event.target.value)}
          onPointerUp={(event) => commitVolume(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") volumeSlider.begin();
          }}
          onKeyUp={(event) => {
            if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") commitVolume(event.currentTarget.value);
          }}
        />
        <span className="volume-number">{Math.round(volumeSlider.value)}</span>
      </div>
    </div>
  );
}

function NowPlaying({ state, onAction, onTab, isActionPending, className = "" }) {
  const { player } = state;
  const position = usePlayerPosition(player);
  const track = player.currentTrack;
  const duration = Math.max(player.durationMs || track?.durationMs || 0, 1);
  const progress = clamp(position, 0, duration);
  const seekSlider = useBufferedSlider(progress, { acknowledgementTolerance: 1500, optimisticLockMs: 1800 });
  const commitSeek = (nextValue) => onAction("seek", { positionMs: seekSlider.commit(nextValue) });
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
          value={seekSlider.value}
          aria-label="Seek through current track"
          style={{ "--range-progress": `${(seekSlider.value / duration) * 100}%` }}
          onPointerDown={seekSlider.begin}
          onPointerCancel={(event) => commitSeek(event.currentTarget.value)}
          onChange={(event) => seekSlider.update(event.target.value)}
          onPointerUp={(event) => commitSeek(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") seekSlider.begin();
          }}
          onKeyUp={(event) => {
            if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") commitSeek();
          }}
        />
        <div className="time-row"><span>{formatTime(seekSlider.value)}</span><span>{formatTime(duration)}</span></div>
      </div>
      <PlayerControls player={player} volume={volume} playlists={state.playlists} likedTrackIds={state.likedTrackIds} onAction={onAction} onTab={onTab} isActionPending={isActionPending} />
    </section>
  );
}

function CompactPlayer({ state }) {
  const { player } = state;
  const position = usePlayerPosition(player);
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

function QueuePanel({ queue, onAction, isActionPending = () => false }) {
  const [draggedIndex, setDraggedIndex] = useState(null);

  return (
    <div className="queue-list" onDragOver={(event) => event.preventDefault()}>
      {queue.length === 0 ? (
        <div className="empty-state compact"><Queue size={30} weight="duotone" aria-hidden="true" /><strong>Queue is clear</strong><span>Search for a track to keep the room moving.</span></div>
      ) : queue.map((track, index) => <div key={`${track.id}-${index}`}>
        {track.autoplay && index > 0 && !queue[index - 1]?.autoplay ? <div className="queue-autoplay-divider" role="separator"><span>Autoplay buffer</span><i /></div> : null}
        <div
          className={`queue-row ${draggedIndex === index ? "is-dragged" : ""}`}
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
              <TrackBadges track={track} />
              {track.autoplay ? <span className="autoplay-mark" title="Added by autoplay"><Sparkle size={13} weight="fill" aria-hidden="true" /></span> : null}
              <span className="queue-duration">{formatTime(track.durationMs)}</span>
            </div>
          </div>
          <IconButton label={`Play ${track.title} next`} className="queue-play-next" loading={isActionPending(`play_next:${index}`)} onClick={() => onAction("play_next", { position: index })}>
            <ArrowBendUpRight size={16} aria-hidden="true" />
          </IconButton>
          <IconButton label={`Remove ${track.title} from queue`} className="queue-remove" loading={isActionPending(`remove_queue:${index}`)} onClick={() => onAction("remove_queue", { position: index })}>
            <Trash size={16} aria-hidden="true" />
          </IconButton>
        </div>
      </div>)}
    </div>
  );
}

function SearchPanel({ query, setQuery, source, setSource, results, status, onSearch, onAction, playlists = [], likedTrackIds = [], isActionPending = () => false, showSearchBar = true }) {
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
      <div className="search-caption"><span>{directLink ? "Direct link detected — the source picker is ignored" : status === "searching" ? "Searching the selected source" : status === "error" ? "Search needs attention" : "YouTube-led search — verified matches from all providers"}</span><span className="source-coverage"><Cloud size={15} aria-hidden="true" /> YouTube → SoundCloud → Deezer → Spotify</span></div>
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
          <button className="result-action" type="button" onClick={() => onAction("play", { query: directLink.url, source: directSource, playNow: true })} disabled={isActionPending("play")} aria-busy={isActionPending("play") || undefined}>{isActionPending("play") ? <SpinnerGap className="button-spinner" size={16} aria-hidden="true" /> : <Play size={16} weight="fill" aria-hidden="true" />} Play now</button>
          <button className="secondary-button" type="button" onClick={() => onAction("play", { query: directLink.url, source: directSource })} disabled={isActionPending("play")} aria-busy={isActionPending("play") || undefined}>{isActionPending("play") ? <SpinnerGap className="button-spinner" size={16} aria-hidden="true" /> : <Plus size={16} weight="bold" aria-hidden="true" />} Add to queue</button>
        </div>
      </section> : null}
      {!directLink && status === "empty" ? <div className="empty-state compact"><MagnifyingGlass size={30} weight="duotone" aria-hidden="true" /><strong>No close matches</strong><span>Try the artist name, a direct URL, or another source.</span></div> : null}
      {!directLink && status !== "searching" && results.length > 0 ? <div className="search-results">{results.map((track) => (
        <div className="result-row" key={track.id}>
          <Artwork track={track} size="small" />
          <div className="result-copy"><strong>{track.title}</strong><span>{track.author}</span><div><span className="result-duration">{formatTime(track.durationMs)}</span><TrackBadges track={track} /></div></div>
          <button className="result-action" type="button" onClick={() => onAction("play", { query: track.playQuery || track.uri || `${track.title} ${track.author}`, source: track.source, playNow: true })} disabled={isActionPending("play")} aria-busy={isActionPending("play") || undefined}>{isActionPending("play") ? <SpinnerGap className="button-spinner" size={16} aria-hidden="true" /> : <Play size={16} weight="fill" aria-hidden="true" />} Play</button>
          <button className="result-next" type="button" onClick={() => onAction("play", { query: track.playQuery || track.uri || `${track.title} ${track.author}`, source: track.source })} disabled={isActionPending("play")} title="Add to queue"><Plus size={17} weight="bold" aria-hidden="true" /></button>
          <TrackSaveActions track={track} playlists={playlists} likedTrackIds={likedTrackIds} onAction={onAction} isActionPending={isActionPending} className="result-save-actions" />
          <SourceTag source={track.source} />
        </div>
      ))}</div> : null}
    </div>
  );
}

function FiltersPanel({ filters, filterPresets, equalizerPresets = [], onAction, isActionPending = () => false, activeSection = "effects" }) {
  const values = useMemo(() => Array.from({ length: 15 }, (_, index) => filters.equalizer?.find((band) => band.band === index)?.gain ?? 0), [filters.equalizer]);
  const [bands, setBands] = useState(values);
  const bandsRef = useRef(values);
  const isAdjustingRef = useRef(false);
  const pendingBandsRef = useRef(null);
  const pendingBandsUntilRef = useRef(0);

  useEffect(() => {
    if (isAdjustingRef.current) return;

    const pendingBands = pendingBandsRef.current;
    if (pendingBands) {
      const acknowledged = pendingBands.every((gain, index) => Math.abs((values[index] || 0) - gain) < 0.0001);
      if (acknowledged) {
        pendingBandsRef.current = null;
      } else if (Date.now() < pendingBandsUntilRef.current) {
        bandsRef.current = pendingBands;
        setBands(pendingBands);
        return;
      } else {
        pendingBandsRef.current = null;
      }
    }

    bandsRef.current = values;
    setBands(values);
  }, [values]);

  const updateBand = (index, nextGain) => {
    isAdjustingRef.current = true;
    pendingBandsRef.current = null;
    const nextBands = bandsRef.current.map((gain, band) => (band === index ? Number(nextGain) : gain));
    bandsRef.current = nextBands;
    setBands(nextBands);
  };

  const resetBands = () => {
    const flatBands = Array(15).fill(0);
    isAdjustingRef.current = false;
    pendingBandsRef.current = flatBands;
    pendingBandsUntilRef.current = Date.now() + 5000;
    bandsRef.current = flatBands;
    setBands(flatBands);
    onAction("equalizer", { bands: [] });
  };

  const commitBands = () => {
    isAdjustingRef.current = false;
    const committedBands = [...bandsRef.current];
    pendingBandsRef.current = committedBands;
    pendingBandsUntilRef.current = Date.now() + 5000;
    onAction("equalizer", { bands: committedBands.map((gain, band) => ({ band, gain })) });
  };
  return (
    <div className="filters-panel">
      {activeSection === "effects" ? <div className="filter-section"><div className="filter-label-row"><div><strong>Fun filters</strong><span>One-click Lavalink effects</span></div><button className="ghost-button" type="button" onClick={() => onAction("filter", { preset: "off" })} disabled={isActionPending("filter")}>{isActionPending("filter") ? <SpinnerGap className="button-spinner" size={15} aria-hidden="true" /> : null}Reset</button></div><div className="filter-grid">{(filterPresets || []).map((preset) => <button type="button" key={preset} className={`filter-tile ${filters.effectPreset === preset ? "is-selected" : ""}`} onClick={() => onAction("filter", { preset })} disabled={isActionPending("filter")}>{isActionPending("filter") && filters.effectPreset === preset ? <SpinnerGap className="button-spinner" size={17} aria-hidden="true" /> : <Faders size={17} aria-hidden="true" />}<span>{preset}</span>{filters.effectPreset === preset ? <Check size={15} weight="bold" aria-hidden="true" /> : null}</button>)}</div></div> : null}
      {activeSection === "equalizer" ? <div className="filter-section eq-section"><div className="filter-label-row"><div><strong>15-band EQ</strong><span>{filters.preset === "custom" ? "Custom curve" : `${filters.preset || "flat"} preset`}</span></div><div className="eq-actions"><label className="eq-preset-control"><span>Preset</span><select value={filters.preset === "custom" ? "custom" : filters.preset || "flat"} onChange={(event) => { if (event.target.value !== "custom") onAction("equalizer_preset", { preset: event.target.value }); }} disabled={isActionPending("equalizer_preset")} aria-label="Equalizer preset"><option value="custom" disabled>Custom curve</option>{equalizerPresets.map((preset) => <option value={preset.name} key={`${preset.custom ? "custom" : "built-in"}-${preset.name}`}>{preset.name}{preset.custom ? " • custom" : ""}</option>)}</select></label><button className="ghost-button" type="button" onClick={resetBands} disabled={isActionPending("equalizer")}>{isActionPending("equalizer") ? <SpinnerGap className="button-spinner" size={15} aria-hidden="true" /> : null}Flat</button></div></div><div className="eq-grid">{bands.map((gain, index) => <label className="eq-band" key={index}><span className="eq-band-label">{BAND_LABELS[index]}</span><span className="eq-slider-control"><input type="range" min="-0.25" max="0.2" step="0.01" value={gain} aria-label={`${BAND_LABELS[index]} Hz EQ band, ${formatEqGain(gain)} gain`} onPointerDown={() => { isAdjustingRef.current = true; }} onPointerCancel={commitBands} onChange={(event) => updateBand(index, event.target.value)} onPointerUp={commitBands} onKeyDown={(event) => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") isAdjustingRef.current = true; }} onKeyUp={(event) => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") commitBands(); }} /></span><span className="eq-band-value">{formatEqGain(gain)}</span></label>)}</div></div> : null}
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

function LiveLyricsPanel({ player, onAction }) {
  const position = usePlayerPosition(player);
  return <LyricsPanel lyrics={player.lyrics} position={position} onAction={onAction} />;
}

function PlaylistsPanel({ playlists, currentTrack, selectedPlaylist, playlistDetail, likedTrackIds = [], composerOpen = false, onComposerClose, onAction }) {
  const [name, setName] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importName, setImportName] = useState("");
  const [composerTab, setComposerTab] = useState("create");
  const [editor, setEditor] = useState(null);
  const [sortMode, setSortMode] = useState("recent");
  const composerRef = useRef(null);
  const composerReturnFocusRef = useRef(null);
  const selectedSummary = playlists.find((playlist) => playlist.name === selectedPlaylist) || playlists.find((playlist) => playlist.id === selectedPlaylist);

  useEffect(() => {
    if (selectedPlaylist === null) {
      setEditor(null);
      setSortMode("recent");
    }
  }, [selectedPlaylist]);

  useEffect(() => {
    if (playlistDetail) setEditor({ ...playlistDetail, newName: playlistDetail.name });
  }, [playlistDetail]);

  useEffect(() => {
    if (composerOpen) setComposerTab("create");
  }, [composerOpen]);

  const closeComposer = useCallback(() => {
    onComposerClose?.();
    window.requestAnimationFrame(() => composerReturnFocusRef.current?.focus?.());
  }, [onComposerClose]);

  useEffect(() => {
    if (!composerOpen) return undefined;
    composerReturnFocusRef.current = document.activeElement;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeComposer();
        return;
      }
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && document.activeElement?.getAttribute("role") === "tab") {
        event.preventDefault();
        const nextTab = composerTab === "create" ? "import" : "create";
        setComposerTab(nextTab);
        window.requestAnimationFrame(() => composerRef.current?.querySelector(`[data-composer-tab="${nextTab}"]`)?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(composerRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
      if (!focusable.length) return;
      const currentIndex = focusable.indexOf(document.activeElement);
      if (event.shiftKey && (currentIndex <= 0 || currentIndex === -1)) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeComposer, composerOpen, composerTab]);

  const sortedTracks = useMemo(() => {
    const tracks = (editor?.tracks || []).map((track, index) => ({ track, index }));
    return tracks.sort((left, right) => {
      const a = left.track;
      const b = right.track;
      if (sortMode === "title") {
        return String(a.title || "").localeCompare(String(b.title || ""), undefined, { numeric: true, sensitivity: "base" }) || left.index - right.index;
      }
      if (sortMode === "artist") {
        return String(a.author || "").localeCompare(String(b.author || ""), undefined, { numeric: true, sensitivity: "base" })
          || String(a.title || "").localeCompare(String(b.title || ""), undefined, { numeric: true, sensitivity: "base" })
          || left.index - right.index;
      }
      if (sortMode === "duration-desc") return Number(b.durationMs || 0) - Number(a.durationMs || 0) || left.index - right.index;
      if (sortMode === "duration-asc") return Number(a.durationMs || 0) - Number(b.durationMs || 0) || left.index - right.index;
      return (Number(b.addedAt) || right.index) - (Number(a.addedAt) || left.index) || right.index - left.index;
    });
  }, [editor?.tracks, sortMode]);

  const submit = () => { if (!name.trim()) return; onAction("create_playlist", { name: name.trim() }); setName(""); closeComposer(); };
  const submitImport = () => { if (!importUrl.trim()) return; onAction("import_playlist", { url: importUrl.trim(), name: importName.trim() }); setImportUrl(""); setImportName(""); closeComposer(); };
  const selectedName = editor?.name || selectedSummary?.name;
  const saveEditor = () => {
    if (!editor || !selectedName) return;
    onAction("update_playlist", {
      name: selectedName,
      newName: editor.newName,
      description: editor.description,
      thumbnail: editor.thumbnail,
      public: editor.public,
      collaborative: editor.collaborative,
    });
  };
  return (
    <div className="playlists-panel">
      {editor ? <section className="playlist-detail" aria-label={`${editor.name} playlist editor`}>
        <div className="playlist-detail-heading"><div><span className="sidebar-kicker">PLAYLIST EDITOR</span><h3>{editor.name}</h3><span>{editor.tracks?.length || 0} tracks</span></div><div className="playlist-detail-actions"><button className="primary-button" type="button" onClick={() => onAction("play_playlist", { name: editor.name })}><Play size={15} weight="fill" aria-hidden="true" /> Play</button><button className="secondary-button" type="button" onClick={() => onAction("play_playlist", { name: editor.name, shuffle: true })}><Shuffle size={15} aria-hidden="true" /> Shuffle</button>{!editor.isDefault ? <button className="ghost-button danger-button" type="button" onClick={() => onAction("delete_playlist", { name: editor.name })}><Trash size={15} aria-hidden="true" /> Delete</button> : null}</div></div>
        <div className="playlist-editor-grid"><label>Name<input value={editor.newName ?? editor.name} disabled={editor.isDefault} onChange={(event) => setEditor((value) => ({ ...value, newName: event.target.value }))} /></label><label>Description<textarea value={editor.description || ""} onChange={(event) => setEditor((value) => ({ ...value, description: event.target.value }))} rows="2" /></label><label>Artwork URL<input value={editor.thumbnail || ""} onChange={(event) => setEditor((value) => ({ ...value, thumbnail: event.target.value }))} placeholder="https://…" /></label><div className="playlist-checks"><label className={`playlist-check-toggle ${editor.public ? "is-on" : ""}`}><input type="checkbox" checked={Boolean(editor.public)} disabled={editor.isDefault} onChange={(event) => setEditor((value) => ({ ...value, public: event.target.checked }))} /><Globe size={16} aria-hidden="true" /><span><strong>Public</strong><small>Visible to shared listeners</small></span></label><label className={`playlist-check-toggle ${editor.collaborative ? "is-on" : ""}`}><input type="checkbox" checked={Boolean(editor.collaborative)} disabled={editor.isDefault} onChange={(event) => setEditor((value) => ({ ...value, collaborative: event.target.checked }))} /><UsersThree size={16} aria-hidden="true" /><span><strong>Collaborative</strong><small>Let others add tracks</small></span></label><button className="secondary-button" type="button" onClick={saveEditor}><Check size={15} weight="bold" aria-hidden="true" /> Save changes</button></div></div>
        <div className="playlist-detail-toolbar"><strong>Tracks</strong><label className="playlist-sort-control"><span>Sort</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value)} aria-label="Sort playlist tracks"><option value="recent">Recently added</option><option value="title">Title A–Z</option><option value="artist">Artist A–Z</option><option value="duration-desc">Longest first</option><option value="duration-asc">Shortest first</option></select></label></div>
        <div className="playlist-track-list">{sortedTracks.length ? sortedTracks.map(({ track, index }) => <div className="playlist-track-row" key={`${track.id}-${index}`}><Artwork track={track} size="small" /><div className="playlist-track-copy"><strong>{track.title}</strong><span>{track.author}</span><SourceTag source={track.source} /></div><span className="playlist-track-duration">{formatTime(track.durationMs)}</span><TrackSaveActions track={track} playlists={playlists} likedTrackIds={likedTrackIds} onAction={onAction} className="playlist-track-save-actions" /><button className="playlist-action danger-button" type="button" onClick={() => onAction("remove_playlist_track", { name: editor.name, position: index })} title="Remove track"><Trash size={15} aria-hidden="true" /></button></div>) : <div className="empty-state compact"><MusicNotes size={30} weight="duotone" aria-hidden="true" /><strong>Playlist is empty</strong><span>Add the current track or save one from search.</span></div>}</div>
      </section> : null}
      {!editor ? <div className="empty-state compact playlist-selection-empty"><VinylRecord size={30} weight="duotone" aria-hidden="true" /><strong>{selectedSummary ? `Opening ${selectedSummary.name}` : "Select a playlist to edit"}</strong><span>Choose a playlist from Your Library on the left.</span></div> : null}
      {composerOpen ? <div className="playlist-composer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeComposer(); }}>
        <section ref={composerRef} className="playlist-composer" role="dialog" aria-modal="true" aria-labelledby="playlist-composer-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="playlist-composer-heading"><div><span className="sidebar-kicker">YOUR LIBRARY</span><h3 id="playlist-composer-title">Add a playlist</h3></div><button className="icon-button" type="button" onClick={closeComposer} aria-label="Close playlist dialog" title="Close"><X size={17} aria-hidden="true" /></button></div>
          <div className="playlist-composer-tabs" role="tablist" aria-label="Playlist actions"><button data-composer-tab="create" id="playlist-tab-create" type="button" role="tab" aria-controls="playlist-panel-create" aria-selected={composerTab === "create"} className={composerTab === "create" ? "is-active" : ""} onClick={() => setComposerTab("create")}><Plus size={15} weight="bold" aria-hidden="true" /> Create</button><button data-composer-tab="import" id="playlist-tab-import" type="button" role="tab" aria-controls="playlist-panel-import" aria-selected={composerTab === "import"} className={composerTab === "import" ? "is-active" : ""} onClick={() => setComposerTab("import")}><UploadSimple size={15} aria-hidden="true" /> Import</button></div>
          {composerTab === "create" ? <form id="playlist-panel-create" className="playlist-composer-form" role="tabpanel" aria-labelledby="playlist-tab-create" onSubmit={(event) => { event.preventDefault(); submit(); }}><label>Playlist name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Night Drive" aria-label="New playlist name" /></label><div className="playlist-composer-actions"><button className="secondary-button" type="button" onClick={closeComposer}>Cancel</button><button className="primary-button" type="submit" disabled={!name.trim()}><Plus size={15} weight="bold" aria-hidden="true" /> Create playlist</button></div></form> : <form id="playlist-panel-import" className="playlist-composer-form" role="tabpanel" aria-labelledby="playlist-tab-import" onSubmit={(event) => { event.preventDefault(); submitImport(); }}><label>Playlist URL<input autoFocus value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="Paste Spotify, YouTube, SoundCloud or Deezer URL" aria-label="Playlist URL" /></label><label>Playlist name <span className="field-hint">optional</span><input value={importName} onChange={(event) => setImportName(event.target.value)} placeholder="Use the provider name if empty" aria-label="Imported playlist name" /></label><div className="playlist-composer-actions"><button className="secondary-button" type="button" onClick={closeComposer}>Cancel</button><button className="primary-button" type="submit" disabled={!importUrl.trim()}><UploadSimple size={15} aria-hidden="true" /> Import playlist</button></div></form>}
        </section>
      </div> : null}
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

function PlaylistSidebar({ playlists, selectedPlaylist, onSelect, onCreate, loading = false }) {
  return (
    <div className="sidebar-content">
      <div className="sidebar-heading">
        <div><span className="sidebar-kicker">YOUR LIBRARY</span><h2>Playlists</h2></div>
        <button className="icon-button" type="button" onClick={onCreate} disabled={loading} aria-label="Create playlist" title="Create playlist"><Plus size={18} weight="bold" aria-hidden="true" /></button>
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
    </div>
  );
}

function QueueSidebar({ queue, onAction, isActionPending, loading = false }) {
  return (
    <div className="sidebar-content queue-sidebar-content">
      <div className="sidebar-heading">
        <div><span className="sidebar-kicker">UP NEXT</span><h2>Queue <b>{loading ? "…" : queue.length}</b></h2></div>
        <IconButton label="Clear queue" loading={isActionPending("clear_queue")} onClick={() => onAction("clear_queue")} disabled={loading || !queue.length}><Trash size={16} aria-hidden="true" /></IconButton>
      </div>
      {loading ? <div className="queue-skeletons" aria-label="Loading queue"><span /><span /><span /></div> : <QueuePanel queue={queue} onAction={onAction} isActionPending={isActionPending} />}
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

function PlayerBar({ state, onAction, onView, isActionPending }) {
  const { player } = state;
  const position = usePlayerPosition(player);
  const track = player.currentTrack;
  const duration = Math.max(player.durationMs || track?.durationMs || 0, 1);
  const progress = clamp(position, 0, duration);
  const volume = clamp(Number(player.volume || 0), 0, 100);
  const isPlaying = player.playing && !player.paused;
  const seekSlider = useBufferedSlider(progress, { acknowledgementTolerance: 1500, optimisticLockMs: 1800 });
  const volumeSlider = useBufferedSlider(volume);

  const commitSeek = (nextValue) => onAction("seek", { positionMs: seekSlider.commit(nextValue) });
  const previewVolume = (nextValue) => {
    const nextVolume = volumeSlider.update(nextValue);
    onAction("volume-preview", { volume: nextVolume });
  };
  const commitVolume = (nextValue) => onAction("volume", { volume: volumeSlider.commit(nextValue) });

  return (
    <footer className="player-bar">
      <div className="player-bar-leading">
        <button className="player-bar-track" type="button" onClick={() => onView("home")} aria-label="Open full player">
          <Artwork track={track} size="small" />
          <span><strong>{track?.title || "Nothing is playing"}</strong><small>{track?.author || "Choose a track to start the room"}</small></span>
        </button>
        <IconButton label={player.autoplay ? "Disable autoplay" : "Enable autoplay"} className={`bar-autoplay ${player.autoplay ? "is-active" : ""}`} loading={isActionPending("autoplay")} onClick={() => onAction("autoplay", { enabled: !player.autoplay })} aria-pressed={player.autoplay}>
          <Sparkle size={16} weight={player.autoplay ? "fill" : "regular"} aria-hidden="true" />
        </IconButton>
      </div>
      <div className="player-bar-center">
        <div className="bar-controls">
          <IconButton label={`Loop mode ${player.loop}`} className={`bar-loop ${player.loop !== "NONE" ? "is-active" : ""}`} loading={isActionPending("loop")} onClick={() => onAction("loop")} disabled={!track}><Repeat size={16} weight={player.loop !== "NONE" ? "fill" : "regular"} aria-hidden="true" /></IconButton>
          <IconButton label="Play previous track" className="bar-previous" loading={isActionPending("previous")} onClick={() => onAction("previous")} disabled={!track}><SkipBack size={17} weight="regular" aria-hidden="true" /></IconButton>
          <button className="bar-play" type="button" aria-label={isPlaying ? "Pause track" : "Play track"} onClick={() => onAction("toggle")} disabled={!track || isActionPending("toggle")} aria-busy={isActionPending("toggle") || undefined}>{isActionPending("toggle") ? <SpinnerGap className="button-spinner" size={18} aria-hidden="true" /> : isPlaying ? <Pause size={18} weight="fill" aria-hidden="true" /> : <Play size={18} weight="fill" aria-hidden="true" />}</button>
          <IconButton label="Stop playback and clear queue" className="bar-stop" loading={isActionPending("stop")} onClick={() => onAction("stop")} disabled={!track}><Stop size={16} weight="fill" aria-hidden="true" /></IconButton>
          <IconButton label="Skip track" className="bar-skip" loading={isActionPending("skip")} onClick={() => onAction("skip", { expectedTrackId: track?.id })} disabled={!track}><SkipForward size={17} weight="regular" aria-hidden="true" /></IconButton>
          <IconButton label="Shuffle queue" className="bar-shuffle" loading={isActionPending("shuffle")} onClick={() => onAction("shuffle")} disabled={!track}><Shuffle size={16} weight="regular" aria-hidden="true" /></IconButton>
        </div>
        <div className="bar-progress">
          <span>{formatTime(seekSlider.value)}</span>
          <input className="range range-progress" type="range" min="0" max={duration} value={seekSlider.value} aria-label="Seek through current track" style={{ "--range-progress": `${(seekSlider.value / duration) * 100}%` }} onPointerDown={seekSlider.begin} onPointerCancel={(event) => commitSeek(event.currentTarget.value)} onChange={(event) => seekSlider.update(event.target.value)} onPointerUp={(event) => commitSeek(event.currentTarget.value)} onKeyDown={(event) => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") seekSlider.begin(); }} onKeyUp={(event) => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") commitSeek(); }} disabled={!track} />
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <div className="player-bar-actions">
        <TrackSaveActions track={track} playlists={state.playlists} likedTrackIds={state.likedTrackIds} onAction={onAction} isActionPending={isActionPending} className="bar-save-actions" />
        {track ? <SourceTag source={track.source} /> : null}
        <IconButton label="Open lyrics" onClick={() => onView("lyrics")} disabled={!track}><MusicNotes size={16} weight="regular" aria-hidden="true" /></IconButton>
        <IconButton label={volumeSlider.value === 0 ? "Unmute" : "Mute"} loading={isActionPending("volume")} onClick={() => onAction("volume", { volume: volumeSlider.value === 0 ? 52 : 0 })}><SpeakerHigh size={17} weight={volumeSlider.value === 0 ? "regular" : "fill"} aria-hidden="true" /></IconButton>
        <input className="range range-volume bar-volume" type="range" min="0" max="100" value={volumeSlider.value} aria-label="Player volume" style={{ "--range-progress": `${volumeSlider.value}%` }} onPointerDown={volumeSlider.begin} onPointerCancel={(event) => commitVolume(event.currentTarget.value)} onChange={(event) => previewVolume(event.target.value)} onPointerUp={(event) => commitVolume(event.currentTarget.value)} onKeyDown={(event) => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") volumeSlider.begin(); }} onKeyUp={(event) => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") commitVolume(event.currentTarget.value); }} />
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
        {activeTab === "lyrics" ? <LiveLyricsPanel player={state.player} onAction={onAction} /> : null}
        {activeTab === "playlists" ? <PlaylistsPanel playlists={state.playlists} currentTrack={state.player.currentTrack} likedTrackIds={state.likedTrackIds || []} onAction={onAction} /> : null}
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
  const [selectedPlaylistDetail, setSelectedPlaylistDetail] = useState(null);
  const [playlistComposerOpen, setPlaylistComposerOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [pendingActions, setPendingActions] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSource, setSearchSource] = useState("auto");
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState("idle");
  const [isHydrating, setIsHydrating] = useState(true);
  const [showLoader, setShowLoader] = useState(true);
  const hydrationStartedAt = useRef(Date.now());
  const hydrationTimer = useRef(null);
  const appliedSnapshot = useRef({ revision: -1, generatedAt: -1 });
  const searchRequest = useRef({ id: 0, controller: null });
  const actionQueue = useRef(Promise.resolve());
  const coalescedActions = useRef(new Map());
  const pendingActionCounts = useRef(new Map());
  const localUndoSnapshots = useRef(new Map());
  const stateRef = useRef(state);
  const isCompact = useCompactViewport();

  const goToView = useCallback((view) => {
    setActiveTab(view);
  }, []);

  const showToast = useCallback((message, type = "info", action = null) => {
    setToast({ message, type, action });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const applyState = useCallback((nextState) => {
    if (!nextState) return;
    const revision = Number(nextState.revision ?? 0);
    const generatedAt = Number(nextState.generatedAt ?? nextState.player?.updatedAt ?? 0);
    const current = appliedSnapshot.current;
    if (revision < current.revision || (revision === current.revision && generatedAt < current.generatedAt)) return;
    appliedSnapshot.current = { revision, generatedAt };
    setState(nextState);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Rich Presence is a per-user Discord Activity feature. Keep the payload
  // event-driven so the 4 Hz player clock does not spam Discord RPC.
  useEffect(() => {
    if (context.mode !== "discord" || !context.sdk) return undefined;
    setMewbitPresence(context.sdk, state.player).catch(() => {
      // Presence is an enhancement; a denied scope or an older Discord client
      // must not make the shared player appear broken.
    });
    return undefined;
  }, [
    context.mode,
    context.sdk,
    state.player.currentTrack?.id,
    state.player.currentTrack?.title,
    state.player.currentTrack?.author,
    state.player.currentTrack?.source,
    state.player.currentTrack?.artworkUrl,
    state.player.currentTrack?.artworkFallbackUrl,
    state.player.playing,
    state.player.paused,
    state.player.autoplay,
    state.player.loop,
    state.player.shuffleActive,
  ]);

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

    return () => { alive = false; stopSocket?.(); window.clearTimeout(hydrationTimer.current); };
  }, [applyState, finishHydration, showToast]);

  const updateActionPending = useCallback((key, change) => {
    const nextCount = Math.max(0, (pendingActionCounts.current.get(key) || 0) + change);
    if (nextCount) pendingActionCounts.current.set(key, nextCount);
    else pendingActionCounts.current.delete(key);
    setPendingActions(Object.fromEntries(pendingActionCounts.current));
  }, []);

  const isActionPending = useCallback((key) => Boolean(pendingActions[key]), [pendingActions]);

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
      if (action === "shuffle") {
        const manual = next.player.queue.filter((track) => !isAutoplayQueueTrack(track)).sort(() => Math.random() - 0.5);
        const autoplay = next.player.queue.filter(isAutoplayQueueTrack).sort(() => Math.random() - 0.5);
        next.player.queue = [...manual, ...autoplay];
        next.player.shuffleActive = true;
      }
      if (action === "remove_queue") { next.player.queue.splice(payload.position, 1); next.player.queue = partitionQueueForDisplay(next.player.queue); }
      if (action === "clear_queue") next.player.queue = [];
      if (action === "play_next") { const [track] = next.player.queue.splice(payload.position, 1); if (track) { track.autoplay = false; next.player.queue.unshift(track); } next.player.queue = partitionQueueForDisplay(next.player.queue); }
      if (action === "move_queue") next.player.queue = moveQueueTrackForDisplay(next.player.queue, payload.from, payload.to);
      if (action === "undo_queue") {
        const snapshot = localUndoSnapshots.current.get(payload.token);
        if (snapshot) {
          next.player.queue = partitionQueueForDisplay(structuredClone(snapshot));
          localUndoSnapshots.current.delete(payload.token);
        }
      }
      if (action === "filter") next.player.filters.effectPreset = payload.preset;
      if (action === "equalizer") { next.player.filters.equalizer = payload.bands; next.player.filters.preset = "custom"; }
      if (action === "equalizer_preset") {
        const preset = next.equalizerPresets?.find((item) => item.name === payload.preset);
        next.player.filters.equalizer = preset?.bands || [];
        next.player.filters.preset = payload.preset;
      }
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
            const autoplayIndex = next.player.queue.findIndex((track) => track.autoplay);
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

  const onAction = useCallback((action, payload = {}) => {
    if (action === "volume-preview") { localMutation(action, payload); return; }
    const pendingKey = getActionPendingKey(action, payload);
    const execute = async (nextPayload = payload) => {
      try {
        const shouldHitGateway = context.mode === "discord" || Boolean(import.meta.env.VITE_ACTIVITY_GATEWAY_URL || import.meta.env.VITE_ACTIVITY_CONNECT_LOCAL);
        if (shouldHitGateway) {
          const response = await sendActivityAction({ ...context, action, payload: nextPayload });
          applyState(response.state);
          if (response.result?.success === false) throw new Error(response.result.error || "Activity action failed.");
          if (response.result?.playlist) setSelectedPlaylistDetail(response.result.playlist);
          if (action === "delete_playlist" && response.result?.success) { setSelectedPlaylistDetail(null); setSelectedPlaylist(null); }
          if (action === "get_playlist" && response.result?.playlist) { setSelectedPlaylist(response.result.playlist.id || response.result.playlist.name); setActiveTab("playlists"); }
          const successMessage = action === "play" ? (nextPayload.playNow ? "Playing now" : "Added to queue") : action === "stop" ? "Playback stopped" : null;
          if (successMessage) showToast(successMessage, "success");
          if ((action === "remove_queue" || action === "clear_queue") && response.result?.undoToken) {
            showToast(action === "clear_queue" ? "Queue cleared" : "Track removed", "info", { label: "Undo", action: "undo_queue", payload: { token: response.result.undoToken } });
          }
          if (action === "undo_queue" && response.result?.success) showToast("Queue restored", "success");
        } else {
          let undoToken = null;
          if (action === "remove_queue" || action === "clear_queue") {
            undoToken = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            localUndoSnapshots.current.set(undoToken, structuredClone(stateRef.current.player.queue || []));
          }
          localMutation(action, nextPayload);
          if (action === "play") showToast(nextPayload.playNow ? "Playing now" : "Added to queue", "info");
          if (undoToken) showToast(action === "clear_queue" ? "Queue cleared" : "Track removed", "info", { label: "Undo", action: "undo_queue", payload: { token: undoToken } });
          if (action === "undo_queue") showToast("Queue restored", "success");
        }
      } catch (error) {
        if (context.mode === "local") { localMutation(action, nextPayload); showToast("Local preview updated. The live gateway is offline.", "info"); }
        else showToast(error.message, "error");
      }
    };
    const enqueue = (task) => {
      updateActionPending(pendingKey, 1);
      const queued = actionQueue.current.then(task, task);
      actionQueue.current = queued.catch(() => undefined);
      return queued.finally(() => updateActionPending(pendingKey, -1));
    };
    if (action === "seek" || action === "volume") {
      const queuedAction = coalescedActions.current.get(action);
      if (queuedAction) {
        queuedAction.payload = payload;
        return queuedAction.promise;
      }
      const holder = { payload, promise: null };
      holder.promise = enqueue(() => execute(holder.payload)).finally(() => coalescedActions.current.delete(action));
      coalescedActions.current.set(action, holder);
      return holder.promise;
    }
    return enqueue(() => execute(payload));
  }, [applyState, context, localMutation, showToast, updateActionPending]);

  const runSearch = useCallback(async () => {
    const query = searchQuery.trim();
    searchRequest.current.controller?.abort();
    const requestId = searchRequest.current.id + 1;
    searchRequest.current = { id: requestId, controller: null };

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
        const controller = new AbortController();
        searchRequest.current = { id: requestId, controller };
        const response = await searchActivity({ ...context, query, source: searchSource, signal: controller.signal });
        if (searchRequest.current.id !== requestId) return;
        const nextResults = response.tracks || [];
        setSearchResults(nextResults);
        setSearchStatus(nextResults.length ? "idle" : "empty");
      }
    } catch (error) {
      if (error?.name === "AbortError" || searchRequest.current.id !== requestId) return;
      setSearchResults([]);
      setSearchStatus("error");
      showToast(error.message, "error");
    }
  }, [context, searchQuery, searchSource, showToast]);

  useEffect(() => {
    if (activeTab !== "search" || searchQuery.trim().length < 2) {
      searchRequest.current.id += 1;
      searchRequest.current.controller?.abort();
      searchRequest.current.controller = null;
      if (activeTab === "search") {
        setSearchResults([]);
        setSearchStatus("idle");
      }
      return undefined;
    }
    const timer = window.setTimeout(runSearch, 560);
    return () => {
      window.clearTimeout(timer);
      searchRequest.current.id += 1;
      searchRequest.current.controller?.abort();
      searchRequest.current.controller = null;
    };
  }, [activeTab, runSearch, searchQuery, searchSource]);

  const searchProps = {
    query: searchQuery,
    setQuery: setSearchQuery,
    source: searchSource,
    setSource: setSearchSource,
    results: searchResults,
    status: searchStatus,
    onSearch: runSearch,
    playlists: state.playlists,
    likedTrackIds: state.likedTrackIds || [],
    isActionPending,
  };

  const closePlaylistComposer = useCallback(() => setPlaylistComposerOpen(false), []);

  return (
    <main className={`activity-app ${isCompact ? "is-compact" : ""} ${isHydrating ? "is-hydrating" : ""}`}>
      {showLoader ? <ActivityLoader message={connection.message} leaving={!isHydrating} /> : null}
      {isCompact ? <CompactPlayer state={state} /> : <>
        <div className={`app-shell ${leftSidebarOpen ? "left-open" : "left-closed"} ${rightSidebarOpen ? "right-open" : "right-closed"}`}>
          <aside className="sidebar sidebar-left" aria-label="Playlists sidebar">
            <DrawerToggle side="left" open={leftSidebarOpen} onClick={() => setLeftSidebarOpen((value) => !value)} />
            <PlaylistSidebar
              playlists={state.playlists}
              selectedPlaylist={selectedPlaylist}
              onSelect={(playlistId) => { setPlaylistComposerOpen(false); setSelectedPlaylist(playlistId); setSelectedPlaylistDetail(null); goToView("playlists"); const playlist = state.playlists.find((item) => item.id === playlistId); if (playlist) onAction("get_playlist", { name: playlist.name }); }}
              onCreate={() => { setPlaylistComposerOpen(true); goToView("playlists"); }}
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
              {activeTab === "home" ? (isHydrating ? <HomePanel loading /> : state.player.currentTrack ? <NowPlaying className="now-playing-stage" state={state} onAction={onAction} onTab={goToView} isActionPending={isActionPending} /> : <HomePanel onView={goToView} />) : null}
              {activeTab === "search" ? <section className="content-panel panel-surface"><PanelTitle icon={<MagnifyingGlass size={18} aria-hidden="true" />} title="Find a track" description="Search providers together, then choose the exact source" /><SearchPanel {...searchProps} showSearchBar={false} onAction={onAction} /></section> : null}
              {activeTab === "filters" ? <section className={`content-panel panel-surface filters-surface filters-surface-${soundSection}`}><PanelTitle icon={<SlidersHorizontal size={18} aria-hidden="true" />} title="Shape the sound" description="EQ and playful filters are applied to the live player" action={<div className="sound-mode-actions" role="tablist" aria-label="Sound controls"><button type="button" role="tab" aria-selected={soundSection === "effects"} className={soundSection === "effects" ? "is-active" : ""} onClick={() => setSoundSection("effects")}><Faders size={15} aria-hidden="true" /><span>Effects</span></button><button type="button" role="tab" aria-selected={soundSection === "equalizer"} className={soundSection === "equalizer" ? "is-active" : ""} onClick={() => setSoundSection("equalizer")}><SlidersHorizontal size={15} aria-hidden="true" /><span>Equalizer</span></button></div>} /><FiltersPanel filters={state.player.filters} filterPresets={state.filterPresets} equalizerPresets={state.equalizerPresets} activeSection={soundSection} onAction={onAction} isActionPending={isActionPending} /></section> : null}
              {activeTab === "lyrics" ? <section className="content-panel panel-surface"><LiveLyricsPanel player={state.player} onAction={onAction} /></section> : null}
              {activeTab === "playlists" ? <section className="content-panel panel-surface"><PlaylistsPanel playlists={state.playlists} currentTrack={state.player.currentTrack} likedTrackIds={state.likedTrackIds || []} selectedPlaylist={selectedPlaylistDetail?.name || selectedPlaylist} playlistDetail={selectedPlaylistDetail} composerOpen={playlistComposerOpen} onComposerClose={closePlaylistComposer} onAction={onAction} /></section> : null}
            </div>
          </section>
          <aside className="sidebar sidebar-right" aria-label="Queue sidebar">
            <DrawerToggle side="right" open={rightSidebarOpen} count={isHydrating ? 0 : state.player.queue.length} onClick={() => setRightSidebarOpen((value) => !value)} />
            <QueueSidebar queue={state.player.queue} onAction={onAction} isActionPending={isActionPending} loading={isHydrating} />
          </aside>
        </div>
        {activeTab === "home" ? null : <PlayerBar state={state} onAction={onAction} onView={goToView} isActionPending={isActionPending} />}
      </>}
      {toast ? <div className={`toast toast-${toast.type}`} role="status"><span>{toast.type === "error" ? <WarningCircle size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}</span><span className="toast-message">{toast.message}</span>{toast.action ? <button className="toast-action" type="button" onClick={() => { const action = toast.action; setToast(null); onAction(action.action, action.payload); }}>{toast.action.label}</button> : null}<button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={16} aria-hidden="true" /></button></div> : null}
    </main>
  );
}

export default App;
