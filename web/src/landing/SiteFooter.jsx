import { ArrowUpRight } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { repoUrl } from "../api.js";
import Mark from "./Mark.jsx";
import "./footer.css";

const PRODUCT = [
  ["Discord Activity", "A shared visual player inside the voice channel"],
  ["Player embed", "Full transport in the text channel"],
  ["Server dashboard", "Per-server settings, for the owner and whoever they trust"],
];

const SOURCES = ["Deezer", "Spotify", "SoundCloud", "YouTube"];

const BUILT_ON = [
  ["Lavalink", "https://lavalink.dev"],
  ["Poru", "https://poru.dev"],
  ["discord.js", "https://discord.js.org"],
  ["Phosphor Icons", "https://phosphoricons.com"],
];

export default function SiteFooter() {
  return (
    <footer className="foot">
      <div className="foot-close">
        <div className="foot-close-text">
          <h2>Clone it and run it.</h2>
          <p>
            Docker Compose brings up the bot and a Lavalink node together. Add a Discord token,
            invite the bot to your own server, and configure the rest from the dashboard.
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

        <div className="foot-close-art" aria-hidden="true" />
      </div>

      <div className="foot-cols">
        <div className="foot-brand">
          <span className="mark is-lg">
            <Mark size={30} />
            MewBit
          </span>
          <p>
            A self-hosted Discord music bot. Multi-source search, FLAC playback, DJ controls, a
            fifteen-band equalizer, synced lyrics and playlists.
          </p>
        </div>

        <div className="foot-col">
          <h3>Product</h3>
          <ul>
            {PRODUCT.map(([name, detail]) => (
              <li key={name}>
                <b>{name}</b>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="foot-col">
          <h3>Sources</h3>
          <ul className="is-plain">
            {SOURCES.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>

        <div className="foot-col">
          <h3>Built on</h3>
          <ul className="is-plain">
            {BUILT_ON.map(([name, href]) => (
              <li key={name}>
                <a href={href} target="_blank" rel="noreferrer noopener">
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="foot-legal">
        <p>
          <b>Educational &amp; Research Licence.</b> MewBit is provided as an educational example and
          proof of concept. It is licensed for learning, research and private testing — not for
          public Discord servers, commercial use, or distribution as a service. See{" "}
          <a href={`${repoUrl}/blob/main/LICENSE`} target="_blank" rel="noreferrer noopener">
            LICENSE
          </a>{" "}
          for the full terms.
        </p>
        <p>
          MewBit resolves audio through third-party services whose terms it may conflict with. The
          author does not endorse violating any service&rsquo;s terms, and anyone running an
          instance is solely responsible for their own compliance. The software is provided
          &ldquo;as is&rdquo;, without warranty of any kind.
        </p>
        <p>
          Not affiliated with or endorsed by Discord, Deezer, Spotify, SoundCloud or YouTube. All
          trademarks and cover artwork belong to their respective owners.
        </p>
      </div>

      <div className="foot-base">
        <span className="mono">© {new Date().getFullYear()} Marczelloo</span>
        <span className="mono foot-links">
          <a href={repoUrl} target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
          <a href={`${repoUrl}/blob/main/LICENSE`} target="_blank" rel="noreferrer noopener">
            Licence
          </a>
          <a href={`${repoUrl}/issues`} target="_blank" rel="noreferrer noopener">
            Report an issue
          </a>
        </span>
      </div>
    </footer>
  );
}
