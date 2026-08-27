import { Link } from "react-router-dom";
import { loginUrl } from "../../api.js";

/**
 * The five branches the dashboard can land on before it can show settings.
 * They share one shell: a heading, one sentence, at most one action.
 */
function StateScreen({ title, body, children }) {
  return (
    <main className="state">
      <div className="state-card">
        <h1>{title}</h1>
        <p>{body}</p>
        {children ? <div className="state-actions">{children}</div> : null}
      </div>
    </main>
  );
}

export function SignedOut() {
  return (
    <StateScreen
      title="Sign in to configure MewBit."
      body="You'll need Administrator permission on a server MewBit is already in."
    >
      <a className="btn-white" href={loginUrl}>
        Continue with Discord
      </a>
    </StateScreen>
  );
}

export function NoServers() {
  return (
    <StateScreen
      title="No servers to configure."
      body="You administer no servers that MewBit has been added to. Invite the bot to a server you administer, then come back."
    >
      <Link className="btn-ghost" to="/">
        Back to home
      </Link>
    </StateScreen>
  );
}

export function GuildGone({ onChoose }) {
  return (
    <StateScreen
      title="MewBit isn't in this server any more."
      body="It may have been removed while this page was open."
    >
      <button type="button" className="btn-ghost" onClick={onChoose}>
        Choose another server
      </button>
    </StateScreen>
  );
}

export function GatewayDown({ onRetry }) {
  return (
    <StateScreen
      title="Can't reach the bot."
      body="The MewBit gateway isn't responding. Settings can't be read or changed until it's back."
    >
      <button type="button" className="btn-ghost" onClick={onRetry}>
        Try again
      </button>
    </StateScreen>
  );
}

export function Loading() {
  return (
    <main className="state" aria-busy="true">
      <div className="state-card">
        <span className="visually-hidden">Loading your servers</span>
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line is-short" />
      </div>
    </main>
  );
}
