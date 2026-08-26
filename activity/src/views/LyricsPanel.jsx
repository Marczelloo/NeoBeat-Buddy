import { useEffect, useRef, useState } from "react";
import { ArrowCounterClockwise, MusicNotes, UploadSimple } from "@phosphor-icons/react";

const MIN_OFFSET_MS = -2000;
const MAX_OFFSET_MS = 2000;

function formatOffset(offsetMs) {
  const value = Math.abs(Number(offsetMs) || 0);
  if (!value) return "No offset";
  return `${value} ms ${Number(offsetMs) < 0 ? "later" : "earlier"}`;
}

export default function LyricsPanel({ lyrics, position, syncOffsetMs, defaultSyncOffsetMs = -450, onAction, isActionPending = () => false, PanelTitle }) {
  const lines = lyrics?.lines || [];
  const activeLine = lines.reduce((last, line, index) => line.timestamp <= position ? index : last, -1);
  const activeLineRef = useRef(null);
  const [timingOpen, setTimingOpen] = useState(false);
  const offsetMs = Number.isFinite(Number(syncOffsetMs)) ? Number(syncOffsetMs) : defaultSyncOffsetMs;
  const [timingDraft, setTimingDraft] = useState(offsetMs);

  useEffect(() => setTimingDraft(offsetMs), [offsetMs]);

  useEffect(() => {
    if (activeLine >= 0) activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [activeLine]);

  return <div className="lyrics-panel">
    <PanelTitle icon={<MusicNotes size={18} aria-hidden="true" />} title="Live lyrics" description={lyrics ? `${lyrics.provider} ${lyrics.synced ? "synced" : "static"}` : "Nothing loaded for this track"} action={<div className="lyrics-title-actions"><button className={`ghost-button ${timingOpen ? "is-active" : ""}`} type="button" onClick={() => setTimingOpen((open) => !open)} aria-expanded={timingOpen} aria-controls="lyrics-timing"><MusicNotes size={15} aria-hidden="true" /> Timing</button><button className="ghost-button" type="button" onClick={() => onAction("refresh_lyrics")} disabled={isActionPending("refresh_lyrics")}><UploadSimple size={15} aria-hidden="true" /> Refresh</button></div>} />
    {timingOpen ? <section id="lyrics-timing" className="lyrics-timing" aria-label="Lyrics timing calibration"><div className="lyrics-timing-copy"><strong>Lyrics timing</strong><span>{formatOffset(timingDraft)}</span></div><input className="range range-lyrics-timing" type="range" min={MIN_OFFSET_MS} max={MAX_OFFSET_MS} step="50" value={timingDraft} aria-label="Lyrics timing offset" style={{ "--range-progress": `${(((timingDraft - MIN_OFFSET_MS) / (MAX_OFFSET_MS - MIN_OFFSET_MS)) * 100).toFixed(2)}%` }} onChange={(event) => setTimingDraft(Number(event.target.value))} onPointerUp={(event) => onAction("set_lyrics_offset", { offsetMs: Number(event.currentTarget.value) })} onPointerCancel={(event) => onAction("set_lyrics_offset", { offsetMs: Number(event.currentTarget.value) })} onKeyUp={(event) => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") onAction("set_lyrics_offset", { offsetMs: Number(event.currentTarget.value) }); }} disabled={isActionPending("set_lyrics_offset")} /><button className="ghost-button lyrics-timing-reset" type="button" onClick={() => onAction("set_lyrics_offset", { offsetMs: defaultSyncOffsetMs })} disabled={isActionPending("set_lyrics_offset") || offsetMs === Number(defaultSyncOffsetMs)}><ArrowCounterClockwise size={15} aria-hidden="true" /> Default</button></section> : null}
    {!lyrics ? <div className="empty-state"><MusicNotes size={38} weight="duotone" aria-hidden="true" /><strong>No lyrics loaded</strong><span>Ask MewBit to check the current track again.</span><button className="secondary-button" type="button" onClick={() => onAction("refresh_lyrics")}>Find lyrics</button></div> : null}
    {lyrics?.synced && lines.length ? <div className="lyrics-lines">{lines.map((line, index) => <p ref={index === activeLine ? activeLineRef : null} className={index === activeLine ? "is-current" : index < activeLine ? "is-past" : ""} key={`${line.timestamp}-${index}`}>{line.line}</p>)}</div> : null}
    {lyrics && !lyrics.synced ? <pre className="static-lyrics">{lyrics.text || "The provider returned no readable lyrics."}</pre> : null}
  </div>;
}
