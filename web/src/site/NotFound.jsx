import { Link, useLocation } from "react-router-dom";
import { repoUrl } from "../api.js";
import PageShell from "./PageShell.jsx";
import usePageMeta from "./usePageMeta.js";

const PAGES = [
  ["/", "Home", "What MewBit is, and the command line that demonstrates it"],
  ["/help", "Commands", "All 78 commands, searchable, read from this instance"],
  ["/changelog", "Changelog", "Every release, and which one is running here"],
  ["/dashboard", "Dashboard", "Per-server settings, for the owner and whoever they trust"],
];

/**
 * The site answers a bad URL the way the bot answers a bad command: it shows
 * you what you asked for and says it returned nothing. Redirecting quietly to
 * the home page — which is what this route used to do — loses the typo, so
 * nobody ever finds out what they got wrong.
 */
export default function NotFound() {
  const location = useLocation();
  usePageMeta("Page not found", "That page does not exist on this MewBit instance.");

  return (
    <PageShell
      title="No such page."
      lead="The address you asked for is not one this site serves. Here is everything it does."
    >
      <div className="nf-echo mono" role="status">
        <span className="nf-echo-prompt" aria-hidden="true">
          &gt;
        </span>
        <span className="nf-echo-path">{location.pathname}</span>
        <span className="nf-echo-verdict">not found</span>
      </div>

      <nav className="nf-pages" aria-label="Pages on this site">
        {PAGES.map(([to, name, blurb]) => (
          <Link className="nf-page" key={to} to={to}>
            <span className="mono nf-page-path">{to}</span>
            <span className="nf-page-text">
              <b>{name}</b>
              <small>{blurb}</small>
            </span>
          </Link>
        ))}
      </nav>

      <p className="nf-note">
        If you followed a link from somewhere and expected a page here,{" "}
        <a href={`${repoUrl}/issues`} target="_blank" rel="noreferrer noopener">
          say so in the issues
        </a>
        .
      </p>
    </PageShell>
  );
}
