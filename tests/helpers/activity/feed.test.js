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
  beginActivityAction,
  registerActivitySession,
  resetActivitySessions,
  touchActivitySession,
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

test("Activity feed describes chart picks and save actions with their outcome", () => {
  const guildId = "activity-feed-details";
  clearActivityEvents(guildId);

  recordActivityAction(guildId, { username: "Neko" }, "surprise_me", {}, null, {
    track: { info: { title: "Espresso", author: "Sabrina Carpenter" } },
  });
  recordActivityAction(guildId, { username: "Neko" }, "toggle_like", {}, null, { liked: true });
  const events = getActivityEvents(guildId);

  assert.match(events[0].detail, /saved a track to liked songs/i);
  assert.match(events[1].detail, /picked espresso from today’s chart/i);
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

test("recent Activity traffic preserves the player UI during a socket handoff", () => {
  resetActivitySessions();

  touchActivitySession("room-handoff");
  assert.equal(hasActiveActivitySession("room-handoff"), true);

  resetActivitySessions();
  assert.equal(hasActiveActivitySession("room-handoff"), false);
});

test("an in-flight Activity action keeps the legacy player suppressed through slow resolution", () => {
  resetActivitySessions();
  const startedAt = 1_000;
  const release = beginActivityAction("room-slow-action", startedAt);

  // This specifically covers a provider request taking longer than the
  // ordinary 15-second socket handoff grace.
  assert.equal(hasActiveActivitySession("room-slow-action", startedAt + 20_000), true);

  release(startedAt + 20_000);
  assert.equal(hasActiveActivitySession("room-slow-action", startedAt + 20_001), true);

  resetActivitySessions();
  assert.equal(hasActiveActivitySession("room-slow-action"), false);
});

test("an abandoned Activity action lease expires instead of hiding the legacy player forever", () => {
  resetActivitySessions();
  const startedAt = 1_000;
  beginActivityAction("room-expired-action", startedAt);

  assert.equal(hasActiveActivitySession("room-expired-action", startedAt + 120_000), false);
  resetActivitySessions();
});
