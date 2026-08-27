import { Link } from "react-router-dom";

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function ServerRail({ guilds, activeGuildId, section }) {
  return (
    <nav className="rail" aria-label="Your servers">
      <ul>
        {guilds.map((guild) => {
          const active = guild.id === activeGuildId;
          return (
            <li key={guild.id}>
              <Link
                to={`/dashboard/${guild.id}/${section}`}
                className={active ? "rail-item is-active" : "rail-item"}
                aria-label={guild.name}
                aria-current={active ? "true" : undefined}
                title={guild.name}
              >
                {guild.icon ? (
                  <img src={guild.icon} alt="" width="44" height="44" />
                ) : (
                  <span aria-hidden="true">{initials(guild.name)}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
