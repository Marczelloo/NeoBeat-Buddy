import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, getMe, logout } from "../api.js";
import SectionList, { DEFAULT_SECTION, SECTIONS, isSection } from "./SectionList.jsx";
import ServerRail from "./ServerRail.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import { GatewayDown, GuildGone, Loading, NoServers, SignedOut } from "./states/StateScreen.jsx";
import "./dashboard.css";

export default function Dashboard() {
  const { guildId, section } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", user: null, guilds: [] });

  const load = useCallback(() => {
    setState((current) => ({ ...current, status: "loading" }));

    getMe()
      .then((payload) => {
        setState({ status: "ready", user: payload.user, guilds: payload.guilds });
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          setState({ status: "signed-out", user: null, guilds: [] });
          return;
        }
        setState({ status: "down", user: null, guilds: [] });
      });
  }, []);

  useEffect(load, [load]);

  const activeSection = isSection(section) ? section : DEFAULT_SECTION;

  // With no guild in the URL, settle on the first server the admin manages.
  useEffect(() => {
    if (state.status !== "ready" || state.guilds.length === 0) return;
    if (guildId && state.guilds.some((guild) => guild.id === guildId)) {
      if (!isSection(section)) {
        navigate(`/dashboard/${guildId}/${DEFAULT_SECTION}`, { replace: true });
      }
      return;
    }
    if (!guildId) {
      navigate(`/dashboard/${state.guilds[0].id}/${DEFAULT_SECTION}`, { replace: true });
    }
  }, [state.status, state.guilds, guildId, section, navigate]);

  if (state.status === "loading") return <Loading />;
  if (state.status === "signed-out") return <SignedOut />;
  if (state.status === "down") return <GatewayDown onRetry={load} />;
  if (state.guilds.length === 0) return <NoServers />;

  const activeGuild = state.guilds.find((guild) => guild.id === guildId);

  if (guildId && !activeGuild) {
    return <GuildGone onChoose={() => navigate(`/dashboard/${state.guilds[0].id}/${DEFAULT_SECTION}`, { replace: true })} />;
  }

  if (!activeGuild) return <Loading />;

  async function signOut() {
    try {
      await logout();
    } catch {
      // Signing out locally is still the right outcome if the call fails.
    }
    navigate("/");
  }

  return (
    <div className="dash">
      <header className="dash-top">
        <Link className="mark" to="/">
          <span className="mark-signal" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          MewBit
        </Link>

        <div className="dash-account">
          <span className="dash-user">{state.user.username}</span>
          <button type="button" className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="dash-body">
        <ServerRail guilds={state.guilds} activeGuildId={activeGuild.id} section={activeSection} />

        <div className="dash-nav">
          <h1 className="dash-guild" title={activeGuild.name}>
            {activeGuild.name}
          </h1>
          <SectionList guildId={activeGuild.id} />
        </div>

        <SettingsPanel
          key={activeGuild.id}
          guildId={activeGuild.id}
          section={activeSection}
          sectionLabel={SECTIONS.find((entry) => entry.id === activeSection).label}
        />
      </div>
    </div>
  );
}
