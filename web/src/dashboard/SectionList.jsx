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

export default function SectionList({ guildId }) {
  return (
    <nav className="sections" aria-label="Settings sections">
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
