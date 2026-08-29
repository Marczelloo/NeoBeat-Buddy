import SectionRule from "../landing/SectionRule.jsx";
import SiteFooter from "../landing/SiteFooter.jsx";
import "../landing/landing.css";
import TopBar from "./TopBar.jsx";

/**
 * The reference pages sit on the same ground as the landing page — same gutter,
 * same three wide washes, same closing rule and footer — so moving between them
 * is moving through one site rather than arriving somewhere else.
 *
 * There is no hero plate here. The landing page earns a figure because it has
 * to say what MewBit is; a page you opened to look something up does not.
 */
export default function PageShell({ title, lead, children }) {
  return (
    <main className="landing">
      <div className="wrap">
        <TopBar />

        <header className="page-head">
          <h1>{title}</h1>
          {lead ? <p>{lead}</p> : null}
        </header>

        {children}

        <SectionRule seed="c" />
        <SiteFooter />
      </div>
    </main>
  );
}
