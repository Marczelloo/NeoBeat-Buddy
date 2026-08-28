import { ArrowUpRight } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { repoUrl } from "../api.js";
import Mark from "./Mark.jsx";

export default function SiteFooter() {
  return (
    <footer className="foot">
      <div className="foot-close">
        <h2>Clone it and run it.</h2>
        <p>
          Docker Compose brings up the bot and a Lavalink node together. Add a Discord token, invite
          the bot, and configure the rest from the dashboard.
        </p>
        <div className="foot-actions">
          <a className="btn-white" href={repoUrl} target="_blank" rel="noreferrer noopener">
            View on GitHub
            <ArrowUpRight size={15} weight="bold" />
          </a>
          <Link className="btn-ghost" to="/dashboard">
            Open the dashboard
          </Link>
        </div>
      </div>

      <div className="foot-base">
        <span className="mark">
          <Mark size={22} />
          MewBit
        </span>
        <span className="foot-legal mono">
          Educational &amp; Research Licence — private and educational use. Not licensed for public
          Discord servers, commercial use, or distribution as a service. See LICENSE.
        </span>
      </div>
    </footer>
  );
}
