const assert = require("node:assert/strict");
const test = require("node:test");
const {
  clearActivityEvents,
  getActivityEvents,
  recordActivityAction,
  reportActivityIssue,
} = require("../../../helpers/activity/feed");
const {
  hasActiveActivitySession,
  registerActivitySession,
  resetActivitySessions,
  unregisterActivitySession,
} = require("../../../helpers/activity/sessions");

test("Activity feed records attributable room actions without leaking raw payloads", () => {
  const guildId = "activity-feed-action";
  clearActivityEvents(guildId);

  recordActivityAction(guildId, { username: "Neko" }, "skip", {}, { title: "Tamagotchi" });
  const [event] = getActivityEvents(guildId);

  assert.equal(event.actor, "Neko");
  assert.equal(event.level, "info");
  assert.match(event.detail, /skipped Tamagotchi/i);
  clearActivityEvents(guildId);
});

test("Activity feed preserves playback issues for the shared player", () => {
  const guildId = "activity-feed-issue";
  clearActivityEvents(guildId);

  reportActivityIssue(guildId, "Playback error", "The provider did not return an audio stream.");
  const [event] = getActivityEvents(guildId);

  assert.equal(event.level, "error");
  assert.equal(event.title, "Playback error");
  assert.match(event.detail, /audio stream/i);
  clearActivityEvents(guildId);
});

test("Activity sessions are scoped to a guild and are released on disconnect", () => {
  resetActivitySessions();
  const socket = {};

  registerActivitySession("room-a", socket);
  assert.equal(hasActiveActivitySession("room-a"), true);
  assert.equal(hasActiveActivitySession("room-b"), false);

  unregisterActivitySession("room-a", socket);
  assert.equal(hasActiveActivitySession("room-a"), false);
});
