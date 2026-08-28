import { useEffect, useState } from "react";
import { deleteServerPlaylist, getServerPlaylists, patchServerPlaylist } from "../../api.js";

function formatDuration(ms) {
  const minutes = Math.round(Number(ms) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/**
 * The playlists this server shares, as opposed to the ones its members keep.
 *
 * Tracks are shown but not edited: adding one means resolving it against a
 * provider, which is the player's job. What belongs here is the part `/playlist`
 * cannot do — tidying up a server playlist whose creator has left.
 */
export default function PlaylistsSection({ guildId }) {
  const [playlists, setPlaylists] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPlaylists(null);
    setError(null);
    setOpenId(null);
    setEditing(null);

    getServerPlaylists(guildId)
      .then((payload) => {
        if (!cancelled) setPlaylists(payload.playlists);
      })
      .catch((apiError) => {
        if (!cancelled) setError(apiError.message);
      });

    return () => {
      cancelled = true;
    };
  }, [guildId]);

  if (error && !playlists) return <p className="panel-error">{error}</p>;

  if (!playlists) {
    return (
      <div aria-busy="true">
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line is-short" />
      </div>
    );
  }

  async function run(work) {
    setPending(true);
    setError(null);
    try {
      const payload = await work();
      setPlaylists(payload.playlists);
      setEditing(null);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setPending(false);
    }
  }

  if (playlists.length === 0) {
    return (
      <div className="notice">
        <b>This server has no shared playlists yet.</b>
        <p>
          Anyone can make one in Discord with{" "}
          <code className="mono">/playlist create scope:Server Playlist</code>. Personal playlists belong to their
          owner and are not shown here.
        </p>
      </div>
    );
  }

  return (
    <>
      {error ? <p className="panel-error">{error}</p> : null}

      <ul className="plists">
        {playlists.map((playlist) => {
          const open = openId === playlist.id;
          const isEditing = editing?.id === playlist.id;

          return (
            <li className="plist" key={playlist.id}>
              <div className="plist-head">
                <span className="plist-text">
                  <b>{playlist.name}</b>
                  <small>
                    {playlist.trackCount} {playlist.trackCount === 1 ? "track" : "tracks"} ·{" "}
                    {formatDuration(playlist.durationMs)} · made by{" "}
                    {playlist.createdByName || <span className="mono">{playlist.createdBy || "someone"}</span>}
                    {playlist.createdByName ? null : " (no longer in this server)"}
                  </small>
                  {playlist.description ? <small className="plist-desc">{playlist.description}</small> : null}
                </span>

                <span className="plist-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setOpenId(open ? null : playlist.id)}
                    aria-expanded={open}
                  >
                    {open ? "Hide tracks" : "Tracks"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={pending}
                    onClick={() =>
                      setEditing(
                        isEditing ? null : { id: playlist.id, name: playlist.name, description: playlist.description }
                      )
                    }
                  >
                    {isEditing ? "Cancel" : "Rename"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost is-danger"
                    disabled={pending}
                    onClick={() => {
                      // Deleting a server playlist is not undoable and can wipe
                      // hours of someone's work, so it asks first.
                      const ok = window.confirm(
                        `Delete "${playlist.name}" and its ${playlist.trackCount} tracks? This cannot be undone.`
                      );
                      if (ok) run(() => deleteServerPlaylist(guildId, playlist.id));
                    }}
                  >
                    Delete
                  </button>
                </span>
              </div>

              {isEditing ? (
                <form
                  className="plist-edit"
                  onSubmit={(event) => {
                    event.preventDefault();
                    run(() =>
                      patchServerPlaylist(guildId, playlist.id, {
                        name: editing.name,
                        description: editing.description,
                      })
                    );
                  }}
                >
                  <input
                    className="input"
                    value={editing.name}
                    maxLength={80}
                    aria-label="Playlist name"
                    onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))}
                  />
                  <input
                    className="input"
                    value={editing.description}
                    maxLength={300}
                    placeholder="Description (optional)"
                    aria-label="Playlist description"
                    onChange={(event) => setEditing((current) => ({ ...current, description: event.target.value }))}
                  />
                  <button type="submit" className="btn-white" disabled={pending || !editing.name.trim()}>
                    Save
                  </button>
                </form>
              ) : null}

              {open ? (
                playlist.tracks.length === 0 ? (
                  <p className="plist-empty">This playlist is empty.</p>
                ) : (
                  <ol className="plist-tracks">
                    {playlist.tracks.map((track, index) => (
                      <li key={`${track.title}-${index}`}>
                        <span className="mono plist-num">{index + 1}</span>
                        <span className="plist-track">
                          <b>{track.title}</b>
                          <small>{track.author}</small>
                        </span>
                        <span className="mono plist-dur">{formatDuration(track.durationMs)}</span>
                      </li>
                    ))}
                  </ol>
                )
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="statblock-note">
        Only playlists shared with the whole server. Personal playlists belong to the member who made them and are not
        shown or editable here. Tracks are added and reordered in Discord with <code className="mono">/playlist</code>.
      </p>
    </>
  );
}
