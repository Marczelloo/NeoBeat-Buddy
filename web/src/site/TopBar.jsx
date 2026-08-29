import { Link, NavLink } from "react-router-dom";
import { repoUrl } from "../api.js";
import Mark from "../landing/Mark.jsx";
import "./site.css";

/**
 * The site's one navigation bar.
 *
 * It lives here rather than inside the landing page because there are now four
 * surfaces wearing it, and three copies of a nav is three places to forget a
 * link. The brand mark animates only on the landing page: on a reference page
 * you are reading, and a moving thing in the corner is just a moving thing.
 */
export default function TopBar({ animated = false }) {
  return (
    <header className="topbar">
      <Link className="mark" to="/">
        <Mark size={26} animated={animated} />
        MewBit
      </Link>

      <nav className="topbar-links">
        <NavLink className={({ isActive }) => (isActive ? "toplink is-here" : "toplink")} to="/help">
          Commands
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "toplink is-here" : "toplink")} to="/changelog">
          Changelog
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "toplink is-here" : "toplink")} to="/dashboard">
          Dashboard
        </NavLink>
        <a className="toplink" href={repoUrl} target="_blank" rel="noreferrer noopener">
          GitHub
        </a>
      </nav>
    </header>
  );
}
