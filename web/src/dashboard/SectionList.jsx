import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";

export const SECTIONS = [
  { id: "player", label: "Player", hint: "Channel, autoplay, 24/7" },
  { id: "source", label: "Source", hint: "Default search provider" },
  { id: "dj", label: "DJ", hint: "Role gating and skip votes" },
  { id: "announcements", label: "Announcements", hint: "Update posts" },
];

export const DEFAULT_SECTION = "player";

export function isSection(value) {
  return SECTIONS.some((section) => section.id === value);
}

export default function SectionList({ guildId, activeSection }) {
  const navRef = useRef(null);

  // Below 900px the list is a horizontal scroller; the active section can
  // start out past the right edge.
  useEffect(() => {
    const active = navRef.current?.querySelector(".section-link.is-active");
    if (!active || navRef.current.scrollWidth <= navRef.current.clientWidth) return;
    active.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeSection]);

  return (
    <nav className="sections" aria-label="Settings sections" ref={navRef}>
      {SECTIONS.map((section) => (
        <NavLink
          key={section.id}
          to={`/dashboard/${guildId}/${section.id}`}
          className={({ isActive }) => (isActive ? "section-link is-active" : "section-link")}
        >
          <b>{section.label}</b>
          <small>{section.hint}</small>
        </NavLink>
      ))}
    </nav>
  );
}
