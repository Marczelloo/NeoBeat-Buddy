const MAX_ACTIVITY_EVENTS = 32;
const eventsByGuild = new Map();

function text(value, max = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function pushActivityEvent(guildId, event = {}) {
  const key = String(guildId || "");
  if (!key) return null;

  const entry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    level: ["error", "warning", "success", "info"].includes(event.level) ? event.level : "info",
    title: text(event.title, 90) || "MewBit update",
    detail: text(event.detail, 220),
    actor: text(event.actor, 80) || null,
  };

  const events = eventsByGuild.get(key) || [];
  events.unshift(entry);
  if (events.length > MAX_ACTIVITY_EVENTS) events.length = MAX_ACTIVITY_EVENTS;
  eventsByGuild.set(key, events);
  return entry;
}

function getActivityEvents(guildId, limit = 20) {
  return (eventsByGuild.get(String(guildId || "")) || []).slice(0, Math.max(0, limit));
}

function clearActivityEvents(guildId) {
  eventsByGuild.delete(String(guildId || ""));
}

function actionDetail(action, payload, beforeTrack) {
  const trackTitle = text(beforeTrack?.title || payload?.track?.title || payload?.query, 100);
  switch (action) {
    case "play": return trackTitle ? `queued ${trackTitle}` : "started playback";
    case "surprise_me": return "started a freestyle";
    case "pause": return "paused playback";
    case "resume": return "resumed playback";
    case "stop": return "stopped playback and cleared the queue";
    case "skip": return trackTitle ? `skipped ${trackTitle}` : "skipped the current track";
    case "previous": return "returned to the previous track";
    case "loop": return `changed loop to ${text(payload?.mode, 24) || "the next mode"}`;
    case "shuffle": return "shuffled the queue";
    case "autoplay": return payload?.enabled ? "turned autoplay on" : "turned autoplay off";
    case "play_next": return "moved a track to play next";
    case "remove_queue": return "removed a queued track";
    case "clear_queue": return "cleared the queue";
    case "undo_queue": return "restored the queue";
    default: return null;
  }
}

function recordActivityAction(guildId, identity, action, payload, beforeTrack) {
  const detail = actionDetail(action, payload, beforeTrack);
  if (!detail) return null;
  return pushActivityEvent(guildId, {
    level: "info",
    title: "Room activity",
    detail,
    actor: text(identity?.username || identity?.tag, 80) || "Someone",
  });
}

function reportActivityIssue(guildId, title, detail, level = "error") {
  return pushActivityEvent(guildId, { level, title, detail });
}

module.exports = {
  pushActivityEvent,
  getActivityEvents,
  clearActivityEvents,
  recordActivityAction,
  reportActivityIssue,
};
