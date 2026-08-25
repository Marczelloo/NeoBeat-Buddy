import { useEffect, useRef } from "react";
import { MusicNotes, UploadSimple } from "@phosphor-icons/react";

export default function LyricsPanel({ lyrics, position, onAction, PanelTitle }) {
  const lines = lyrics?.lines || [];
  const activeLine = lines.reduce((last, line, index) => line.timestamp <= position ? index : last, -1);
  const activeLineRef = useRef(null);

  useEffect(() => {
    if (activeLine >= 0) activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [activeLine]);

  return <div className="lyrics-panel">
    <PanelTitle icon={<MusicNotes size={18} aria-hidden="true" />} title="Live lyrics" description={lyrics ? `${lyrics.provider} ${lyrics.synced ? "synced" : "static"}` : "Nothing loaded for this track"} action={<button className="ghost-button" type="button" onClick={() => onAction("refresh_lyrics")}><UploadSimple size={15} aria-hidden="true" /> Refresh</button>} />
    {!lyrics ? <div className="empty-state"><MusicNotes size={38} weight="duotone" aria-hidden="true" /><strong>No lyrics loaded</strong><span>Ask MewBit to check the current track again.</span><button className="secondary-button" type="button" onClick={() => onAction("refresh_lyrics")}>Find lyrics</button></div> : null}
    {lyrics?.synced && lines.length ? <div className="lyrics-lines">{lines.map((line, index) => <p ref={index === activeLine ? activeLineRef : null} className={index === activeLine ? "is-current" : index < activeLine ? "is-past" : ""} key={`${line.timestamp}-${index}`}>{line.line}</p>)}</div> : null}
    {lyrics && !lyrics.synced ? <pre className="static-lyrics">{lyrics.text || "The provider returned no readable lyrics."}</pre> : null}
  </div>;
}
