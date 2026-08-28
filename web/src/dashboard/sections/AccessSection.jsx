import { useCallback, useEffect, useState } from "react";
import { getAccess, putAccess } from "../../api.js";

function formatWhen(value) {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "—";
  return at.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* The trail stores section and field keys; these are the names the rest of the
   dashboard already uses for the same things. */
const FIELD_NAMES = {
  playerChannel: "Player channel",
  autoplay: "Autoplay",
  radio247: "24/7 radio",
  defaultSource: "Default search source",
  announcementChannel: "Announcement channel",
  announcementsEnabled: "Announcements",
  enabled: "Enabled",
  roleId: "DJ role",
  skipMode: "Skip mode",
  voteThreshold: "Vote threshold",
  strictMode: "Strict mode",
  categories: "Log categories",
  channels: "Log channels",
  accessRoles: "Log readers",
  channelId: "Ticket channel",
  preset: "Equalizer preset",
  bands: "Equalizer bands",
  operator: "Dashboard access",
};

const SECTION_NAMES = {
  player: "Player",
  source: "Source",
  dj: "DJ",
  announcements: "Announcements",
  logs: "Server logs",
  tickets: "Tickets",
  equalizer: "Equalizer",
  access: "Access",
};

/**
 * Who may use this dashboard, and what has been changed here.
 *
 * The access list and the trail live together deliberately: the question "who
 * can change things" and the question "who did" are the same question asked
 * before and after the fact.
 */
export default function AccessSection({ guildId }) {
  const [state, setState] = useState({ status: "loading", access: null, log: [] });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [candidate, setCandidate] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    getAccess(guildId)
      .then((payload) => {
        if (!cancelled) setState({ status: "ready", access: payload.access, log: payload.log || [] });
      })
      .catch((apiError) => {
        if (!cancelled) setState({ status: "error", access: null, log: [] });
        if (!cancelled) setError(apiError.message);
      });
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  useEffect(load, [load]);

  async function save(operators) {
    setPending(true);
    setError(null);
    try {
      const payload = await putAccess(guildId, operators);
      setState({ status: "ready", access: payload.access, log: payload.log || [] });
      setCandidate("");
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setPending(false);
    }
  }

  if (state.status === "loading") {
    return (
      <div aria-busy="true">
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line is-short" />
      </div>
    );
  }

  if (state.status === "error") return <p className="panel-error">{error}</p>;

  const { access, log } = state;
  const ids = access.operators.map((operator) => operator.id);

  return (
    <>
      {error ? <p className="panel-error">{error}</p> : null}

      <div className="field">
        <div className="field-label">
          <span>Server owner</span>
        </div>
        <p className="field-describe">
          <b className="owner-name">{access.ownerName}</b> always has access, and is the only person who can change
          this list. That cannot be turned off.
        </p>
      </div>

      <div className="field is-wide">
        <div className="field-label">
          <span>People who may use this dashboard</span>
        </div>
        <p className="field-describe">
          Everyone named here can change every setting for this server.
        </p>
        {access.viewerIsOwner ? (
          <p className="field-note is-danger">
            They do not need Administrator in Discord — naming someone grants them settings access the slash commands
            would refuse them. Add only people you would trust with the server itself.
          </p>
        ) : (
          <p className="field-note is-muted">You can see this list, but only the owner can change it.</p>
        )}

        <div className="field-control">
          {access.operators.length === 0 ? (
            <p className="checklist-empty">Nobody yet — only {access.ownerName} can use this dashboard.</p>
          ) : (
            <ul className="people">
              {access.operators.map((operator) => (
                <li className={operator.present ? "person" : "person is-gone"} key={operator.id}>
                  <span className="person-text">
                    <b>{operator.name}</b>
                    <small className="mono">{operator.id}</small>
                    {operator.present ? null : <small>Has left the server — access already ended.</small>}
                  </span>
                  {access.viewerIsOwner ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={pending}
                      onClick={() => save(ids.filter((id) => id !== operator.id))}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {access.viewerIsOwner ? (
            <form
              className="addrow"
              onSubmit={(event) => {
                event.preventDefault();
                const id = candidate.trim();
                if (id && !ids.includes(id)) save([...ids, id]);
              }}
            >
              <input
                className="input mono"
                value={candidate}
                onChange={(event) => setCandidate(event.target.value)}
                placeholder="Discord user ID"
                inputMode="numeric"
                aria-label="Discord user ID to grant access"
              />
              <button type="submit" className="btn-white" disabled={pending || !candidate.trim()}>
                Grant access
              </button>
            </form>
          ) : null}

          {access.viewerIsOwner ? (
            <p className="addrow-hint">
              Turn on Developer Mode in Discord, then right-click a member and choose Copy User ID. Up to{" "}
              {access.maxOperators} people.
            </p>
          ) : null}
        </div>
      </div>

      <div className="statblock">
        <h3>What has been changed here</h3>
        {log.length === 0 ? (
          <p className="checklist-empty">Nothing yet. Every change made through this dashboard is recorded.</p>
        ) : (
          <ol className="trail">
            {log.map((entry, index) => (
              <li className="trail-item" key={`${entry.at}-${index}`}>
                <span className="mono trail-when">{formatWhen(entry.at)}</span>
                <span className="trail-what">
                  <b>{entry.username}</b> changed{" "}
                  <b>{FIELD_NAMES[entry.field] || entry.field}</b>
                  {SECTION_NAMES[entry.section] ? ` in ${SECTION_NAMES[entry.section]}` : null}
                  <small>
                    {entry.from} → {entry.to}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="statblock-note">
          The 50 most recent changes. Changes made with slash commands in Discord are not recorded here.
        </p>
      </div>
    </>
  );
}
