import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings, patchSettings } from "../api.js";
import SaveState from "./SaveState.jsx";
import AccessSection from "./sections/AccessSection.jsx";
import EmbedSection from "./sections/EmbedSection.jsx";
import EqualizerSection from "./sections/EqualizerSection.jsx";
import LogsSection from "./sections/LogsSection.jsx";
import { AnnouncementsSection, DjSection, PlayerSection, SourceSection } from "./sections/MusicSections.jsx";
import StatsSection from "./sections/StatsSection.jsx";
import TicketsSection from "./sections/TicketsSection.jsx";

const SECTION_COPY = {
  player: {
    title: "Player",
    lead: "Where MewBit posts its player and how it behaves when the queue runs dry.",
  },
  source: {
    title: "Source",
    lead: "Which provider a bare search resolves against. Members can override this for themselves.",
  },
  equalizer: {
    title: "Equalizer",
    lead: "The sound shaping this server keeps. It is restored every time MewBit starts playing.",
  },
  dj: {
    title: "DJ",
    lead: "Who is allowed to change playback for everyone else.",
  },
  announcements: {
    title: "Announcements",
    lead: "Where MewBit posts update notes when the bot version changes.",
  },
  logs: {
    title: "Server logs",
    lead: "What MewBit records about this server, and which roles are allowed to read it.",
  },
  tickets: {
    title: "Tickets",
    lead: "How members report bugs, request features, and send feedback.",
  },
  embed: {
    title: "Embeds",
    lead: "Compose a message and post it to a channel as MewBit. Nothing is sent until you press Send.",
  },
  access: {
    title: "Access",
    lead: "Who may change this server's settings here, and what they have changed.",
  },
  stats: {
    title: "Statistics",
    lead: "What this server has listened to. Nothing here can be changed.",
  },
};

const SECTION_COMPONENTS = {
  player: PlayerSection,
  source: SourceSection,
  equalizer: EqualizerSection,
  dj: DjSection,
  announcements: AnnouncementsSection,
  logs: LogsSection,
  tickets: TicketsSection,
  embed: EmbedSection,
  access: AccessSection,
  stats: StatsSection,
};

export default function SettingsPanel({ guildId, section, sectionLabel, guildName }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [saveState, setSaveState] = useState("idle");
  const [savedField, setSavedField] = useState(null);
  const savedTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setSettings(null);
    setError(null);
    setWarnings([]);

    getSettings(guildId)
      .then((payload) => {
        if (!cancelled) setSettings(payload.settings);
      })
      .catch((apiError) => {
        if (!cancelled) setError(apiError.message);
      });

    return () => {
      cancelled = true;
    };
  }, [guildId]);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const commit = useCallback(
    async (patch, fieldKey) => {
      const previous = settings;
      // Optimistic, one level deep into each group so a control responds now.
      setSettings((current) => {
        const next = { ...current };
        for (const [group, values] of Object.entries(patch)) {
          next[group] = { ...next[group], ...values };
        }
        return next;
      });
      setSaveState("saving");
      setError(null);
      setWarnings([]);

      try {
        const payload = await patchSettings(guildId, patch);
        // Replace wholesale: a slash command may have changed something else,
        // and a nested group like logs.categories cannot be merged shallowly.
        setSettings(payload.settings);
        // A patch can partly succeed — a log role Discord refused, say — so a
        // warning is shown alongside the save rather than instead of it.
        setWarnings(payload.warnings || []);
        setSaveState("saved");
        setSavedField(fieldKey);
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => {
          setSaveState("idle");
          setSavedField(null);
        }, 2200);
      } catch (apiError) {
        setSettings(previous);
        setSaveState("idle");
        setError(apiError.message);
      }
    },
    [guildId, settings]
  );

  if (error && !settings) {
    return (
      <section className="panel">
        <div className="panel-scroll">
          <p className="panel-error">{error}</p>
        </div>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className="panel" aria-busy="true">
        <div className="panel-scroll">
          <span className="visually-hidden">Loading {sectionLabel} settings</span>
          <span className="skeleton skeleton-title" />
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line is-short" />
        </div>
      </section>
    );
  }

  const copy = SECTION_COPY[section];
  const Section = SECTION_COMPONENTS[section];
  const channelOptions = settings.options.channels.map((channel) => ({
    value: channel.id,
    label: `#${channel.name}`,
  }));
  const roleOptions = settings.options.roles.map((role) => ({
    value: role.id,
    label: `@${role.name}`,
  }));

  return (
    <section className="panel">
      <div className="panel-scroll">
        <div className="panel-head">
          <h2>{copy.title}</h2>
          <p>{copy.lead}</p>
        </div>

        {error ? <p className="panel-error">{error}</p> : null}
        {warnings.map((warning) => (
          <p className="panel-warning" key={warning}>
            {warning}
          </p>
        ))}

        <Section
          guildId={guildId}
          settings={settings}
          commit={commit}
          savedField={savedField}
          channelOptions={channelOptions}
          roleOptions={roleOptions}
        />
      </div>

      <SaveState state={saveState} guildName={guildName} />
    </section>
  );
}
