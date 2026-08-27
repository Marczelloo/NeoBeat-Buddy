import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings, patchSettings } from "../api.js";
import SaveState from "./SaveState.jsx";
import Field from "./controls/Field.jsx";
import { Select, Slider, Toggle } from "./controls/Inputs.jsx";

const SOURCE_OPTIONS = [
  { value: "deezer", label: "Deezer — FLAC quality" },
  { value: "youtube", label: "YouTube — widest catalogue" },
  { value: "spotify", label: "Spotify — resolved through other sources" },
  { value: "soundcloud", label: "SoundCloud — independent uploads" },
];

const SKIP_OPTIONS = [
  { value: "dj", label: "DJ only — only the DJ role can skip" },
  { value: "vote", label: "Vote — listeners vote to skip" },
  { value: "hybrid", label: "Hybrid — DJ skips outright, others vote" },
];

const SECTION_COPY = {
  player: {
    title: "Player",
    lead: "Where MewBit posts its player and how it behaves when the queue runs dry.",
  },
  source: {
    title: "Source",
    lead: "Which provider a bare search resolves against. Members can override this for themselves.",
  },
  dj: {
    title: "DJ",
    lead: "Who is allowed to change playback for everyone else.",
  },
  announcements: {
    title: "Announcements",
    lead: "Where MewBit posts update notes when the bot version changes.",
  },
};

export default function SettingsPanel({ guildId, section, sectionLabel, guildName }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [savedField, setSavedField] = useState(null);
  const savedTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setSettings(null);
    setError(null);

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
      // Optimistic: merge the patch into local state so the control responds now.
      setSettings((current) => {
        const next = { ...current };
        for (const [group, values] of Object.entries(patch)) {
          next[group] = { ...next[group], ...values };
        }
        return next;
      });
      setSaveState("saving");
      setError(null);

      try {
        const payload = await patchSettings(guildId, patch);
        // Replace wholesale: a slash command may have changed something else.
        setSettings(payload.settings);
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
  const channelOptions = settings.options.channels.map((channel) => ({
    value: channel.id,
    label: `#${channel.name}`,
  }));
  const roleOptions = settings.options.roles.map((role) => ({
    value: role.id,
    label: `@${role.name}`,
  }));

  const dj = settings.dj;
  const djOff = !dj.enabled;
  const strictWithoutRole = dj.enabled && dj.strictMode && !dj.roleId;
  const thresholdUnused = dj.enabled && dj.skipMode === "dj";

  return (
    <section className="panel">
      <div className="panel-scroll">
        <div className="panel-head">
          <h2>{copy.title}</h2>
          <p>{copy.lead}</p>
        </div>

        {error ? <p className="panel-error">{error}</p> : null}

        {section === "player" ? (
          <>
            <Field
              label="Player channel"
              describe="MewBit posts its player message here, and the Activity opens against this channel."
              saved={savedField === "playerChannel"}
            >
              <Select
                value={settings.player.playerChannel}
                onChange={(value) => commit({ player: { playerChannel: value } }, "playerChannel")}
                options={channelOptions}
                placeholder="Not set — posts wherever the command was used"
              />
            </Field>

            <Field
              label="Autoplay"
              describe="When the queue empties, MewBit keeps playing with tracks it picks from what you have been listening to."
              saved={savedField === "autoplay"}
            >
              <Toggle
                checked={settings.player.autoplay}
                onChange={(value) => commit({ player: { autoplay: value } }, "autoplay")}
              />
            </Field>

            <Field
              label="24/7 radio"
              describe="MewBit stays in the voice channel when everyone leaves instead of disconnecting after the idle timeout."
              saved={savedField === "radio247"}
            >
              <Toggle
                checked={settings.player.radio247}
                onChange={(value) => commit({ player: { radio247: value } }, "radio247")}
              />
            </Field>
          </>
        ) : null}

        {section === "source" ? (
          <Field
            label="Default search source"
            describe="Where a plain /play query resolves first. A member who sets their own preference overrides this."
            saved={savedField === "defaultSource"}
          >
            <Select
              value={settings.source.defaultSource}
              onChange={(value) => commit({ source: { defaultSource: value } }, "defaultSource")}
              options={SOURCE_OPTIONS}
            />
          </Field>
        ) : null}

        {section === "dj" ? (
          <>
            <Field
              label="DJ mode"
              describe="With DJ mode off, anyone in the voice channel can skip, stop, and reorder the queue."
              saved={savedField === "enabled"}
            >
              <Toggle
                checked={dj.enabled}
                onChange={(value) => commit({ dj: { enabled: value } }, "enabled")}
              />
            </Field>

            <Field
              label="DJ role"
              describe="Members with this role always control playback. The server owner always can."
              note={djOff ? "DJ mode is off — everyone can control playback." : null}
              saved={savedField === "roleId"}
            >
              <Select
                value={dj.roleId}
                disabled={djOff}
                onChange={(value) => commit({ dj: { roleId: value } }, "roleId")}
                options={roleOptions}
                placeholder="No role — administrators only"
              />
            </Field>

            <Field
              label="Skip mode"
              describe="How a track gets skipped when someone who is not a DJ asks for it."
              note={djOff ? "DJ mode is off — everyone can control playback." : null}
              saved={savedField === "skipMode"}
            >
              <Select
                value={dj.skipMode}
                disabled={djOff}
                onChange={(value) => commit({ dj: { skipMode: value } }, "skipMode")}
                options={SKIP_OPTIONS}
              />
            </Field>

            <Field
              label="Vote threshold"
              describe="The share of listeners in the voice channel who must vote before a track is skipped."
              note={
                djOff
                  ? "DJ mode is off — everyone can control playback."
                  : thresholdUnused
                    ? "Skip mode is DJ-only, so the vote threshold is unused."
                    : null
              }
              saved={savedField === "voteThreshold"}
            >
              <Slider
                value={dj.voteThreshold}
                disabled={djOff || thresholdUnused}
                min={0.1}
                max={1}
                step={0.05}
                format={(value) => `${Math.round(value * 100)}%`}
                onChange={(value) => commit({ dj: { voteThreshold: value } }, "voteThreshold")}
              />
            </Field>

            <Field
              label="Strict mode"
              describe="Only the DJ role and the server owner control playback. Administrators lose the implicit pass."
              note={
                djOff
                  ? "DJ mode is off — everyone can control playback."
                  : strictWithoutRole
                    ? "Strict mode does nothing until a DJ role is set. Only the server owner can control playback right now."
                    : null
              }
              tone={strictWithoutRole ? "danger" : "muted"}
              saved={savedField === "strictMode"}
            >
              <Toggle
                checked={dj.strictMode}
                disabled={djOff}
                onChange={(value) => commit({ dj: { strictMode: value } }, "strictMode")}
              />
            </Field>
          </>
        ) : null}

        {section === "announcements" ? (
          <>
            <Field
              label="Announcements"
              describe="MewBit posts a short note when the bot updates to a new version."
              saved={savedField === "announcementsEnabled"}
            >
              <Toggle
                checked={settings.announcements.announcementsEnabled}
                onChange={(value) =>
                  commit({ announcements: { announcementsEnabled: value } }, "announcementsEnabled")
                }
              />
            </Field>

            <Field
              label="Announcement channel"
              describe="Where those update notes are posted."
              note={
                settings.announcements.announcementsEnabled
                  ? null
                  : "Announcements are off, so nothing will be posted here."
              }
              saved={savedField === "announcementChannel"}
            >
              <Select
                value={settings.announcements.announcementChannel}
                disabled={!settings.announcements.announcementsEnabled}
                onChange={(value) =>
                  commit({ announcements: { announcementChannel: value } }, "announcementChannel")
                }
                options={channelOptions}
                placeholder="Not set — no update notes are posted"
              />
            </Field>
          </>
        ) : null}
      </div>

      <SaveState state={saveState} guildName={guildName} />
    </section>
  );
}
