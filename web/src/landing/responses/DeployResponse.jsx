import { ArrowUpRight } from "@phosphor-icons/react";
import { repoUrl } from "../../api.js";

export default function DeployResponse() {
  return (
    <div>
      <p className="resp-lead">
        MewBit is deployed, not subscribed. You own the instance, the data files and the Lavalink
        nodes — there is no hosted tier to be rate-limited by and no paywall over audio quality.
      </p>

      <p className="resp-note">
        Licensed for private and educational use. Running it on a public Discord server, commercially,
        or as a service is outside the licence.
      </p>

      <pre className="codeblock">
        <code>
          <span className="p">$ </span>git clone https://github.com/Marczelloo/NeoBeat-Buddy.git{"\n"}
          <span className="p">$ </span>cp .env-example .env{"  "}
          <span className="c"># add your Discord token</span>
          {"\n"}
          <span className="p">$ </span>docker compose up -d --build
        </code>
      </pre>

      <div className="deploy-needs">
        <span className="mono">Node 20+</span>
        <span className="mono">Docker</span>
        <span className="mono">A Lavalink node</span>
        <span className="mono">A Discord application</span>
      </div>

      <a className="btn-white deploy-cta" href={repoUrl} target="_blank" rel="noreferrer noopener">
        Read the deploy guide
        <ArrowUpRight size={15} weight="bold" />
      </a>
    </div>
  );
}
