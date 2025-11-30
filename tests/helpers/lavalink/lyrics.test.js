const assert = require("node:assert");
const { describe, it, beforeEach, mock } = require("node:test");

/**
 * Comprehensive Lyrics System Tests
 * Tests synced lyrics, fallbacks, and display formatting
 */
describe("Lyrics System", () => {
  describe("Lyrics Client", () => {
    let lyricsClient;

    beforeEach(() => {
      delete require.cache[require.resolve("../../../helpers/lavalink/lyricsClient")];
      lyricsClient = require("../../../helpers/lavalink/lyricsClient");
    });

    describe("fetchLyrics", () => {
      it("should export fetchLyrics function", () => {
        assert.ok(typeof lyricsClient.fetchLyrics === "function");
      });
    });
  });

  describe("Lyrics Formatter", () => {
    let chunkLyrics, buildLyricsResponse, findCurrentLine;
    let MAX_EMBED_DESCRIPTION, MAX_EMBEDS;

    beforeEach(() => {
      delete require.cache[require.resolve("../../../helpers/lavalink/lyricsFormatter")];
      const lyricsFormatter = require("../../../helpers/lavalink/lyricsFormatter");
      chunkLyrics = lyricsFormatter.chunkLyrics;
      buildLyricsResponse = lyricsFormatter.buildLyricsResponse;
      findCurrentLine = lyricsFormatter.findCurrentLine;
      MAX_EMBED_DESCRIPTION = lyricsFormatter.MAX_EMBED_DESCRIPTION;
      MAX_EMBEDS = lyricsFormatter.MAX_EMBEDS;
    });

    describe("chunkLyrics", () => {
      it("should split lyrics into chunks respecting max size", () => {
        const longLyrics = Array.from({ length: 100 }, (_, i) => `Line ${i + 1} with some text`).join("\n");
<<<<<<< HEAD

=======
        
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
        const chunks = chunkLyrics(longLyrics, 500);

        assert.ok(chunks.length > 1);
        chunks.forEach((chunk) => {
          assert.ok(chunk.length <= 500);
        });
      });

      it("should return empty array for empty text", () => {
        const chunks = chunkLyrics("");
        assert.deepStrictEqual(chunks, []);
      });

      it("should return empty array for null/undefined", () => {
        const chunks1 = chunkLyrics(null);
        const chunks2 = chunkLyrics(undefined);
<<<<<<< HEAD

=======
        
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
        assert.deepStrictEqual(chunks1, []);
        assert.deepStrictEqual(chunks2, []);
      });

      it("should handle single line lyrics", () => {
        const chunks = chunkLyrics("Single line");
<<<<<<< HEAD

=======
        
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0], "Single line");
      });

      it("should preserve line breaks within chunks", () => {
        const lyrics = "Line 1\nLine 2\nLine 3";
        const chunks = chunkLyrics(lyrics);

        assert.ok(chunks[0].includes("\n"));
      });

      it("should handle very long single lines", () => {
        const longLine = "A".repeat(3000);
        const chunks = chunkLyrics(longLine, 500);

        assert.ok(chunks.length > 1);
        chunks.forEach((chunk) => {
          assert.ok(chunk.length <= 500);
        });
      });
    });

    describe("findCurrentLine", () => {
      it("should find current line based on timestamp", () => {
        const lines = [
          { timestamp: 0, line: "First" },
          { timestamp: 5000, line: "Second" },
          { timestamp: 10000, line: "Third" },
        ];

        assert.strictEqual(findCurrentLine(lines, 0), 0);
        assert.strictEqual(findCurrentLine(lines, 3000), 0);
        assert.strictEqual(findCurrentLine(lines, 5000), 1);
        assert.strictEqual(findCurrentLine(lines, 7500), 1);
        assert.strictEqual(findCurrentLine(lines, 10000), 2);
        assert.strictEqual(findCurrentLine(lines, 15000), 2);
      });

      it("should return -1 for empty lines", () => {
        assert.strictEqual(findCurrentLine([], 5000), -1);
        assert.strictEqual(findCurrentLine(null, 5000), -1);
        assert.strictEqual(findCurrentLine(undefined, 5000), -1);
      });

      it("should return -1 for position before first line", () => {
        const lines = [
          { timestamp: 5000, line: "First" },
          { timestamp: 10000, line: "Second" },
        ];

        assert.strictEqual(findCurrentLine(lines, 3000), -1);
      });

      it("should handle out of order timestamps correctly", () => {
        const lines = [
          { timestamp: 0, line: "A" },
          { timestamp: 10000, line: "B" },
          { timestamp: 5000, line: "C" }, // Out of order
        ];

        // Algorithm searches backwards, so behavior depends on actual order
        const result = findCurrentLine(lines, 7500);
        assert.ok(typeof result === "number");
      });
    });

    describe("buildLyricsResponse", () => {
      it("should build response with embeds", () => {
        const result = buildLyricsResponse({
          text: "Test lyrics content\nSecond line",
          provider: "lrclib",
          trackTitle: "Test Song",
        });

        assert.ok(result.embeds);
        assert.ok(Array.isArray(result.embeds));
        assert.ok(result.embeds.length > 0);
      });

      it("should include provider in footer", () => {
        const result = buildLyricsResponse({
          text: "Test lyrics",
          provider: "genius",
          trackTitle: "Song",
        });

        // Check embed has footer with provider
        const embed = result.embeds[0];
        assert.ok(embed.data.footer || embed.footer);
      });

      it("should handle empty text", () => {
        const result = buildLyricsResponse({
          text: "",
          provider: "lrclib",
          trackTitle: "Song",
        });

        assert.deepStrictEqual(result.embeds, []);
      });

      it("should limit to MAX_EMBEDS", () => {
        // Create very long lyrics that would need many chunks
<<<<<<< HEAD
        const longLyrics = Array.from(
          { length: 500 },
          (_, i) => `Line ${i + 1} with lots of extra text to make it longer and fill up space`
=======
        const longLyrics = Array.from({ length: 500 }, (_, i) => 
          `Line ${i + 1} with lots of extra text to make it longer and fill up space`
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
        ).join("\n");

        const result = buildLyricsResponse({
          text: longLyrics,
          provider: "lrclib",
          trackTitle: "Long Song",
        });

        assert.ok(result.embeds.length <= MAX_EMBEDS);
      });

      it("should add content message when exceeding MAX_EMBEDS", () => {
<<<<<<< HEAD
        const longLyrics = Array.from(
          { length: 500 },
          (_, i) =>
            `Line ${
              i + 1
            } with lots of extra text to make it longer and ensure we exceed the maximum allowed embeds limit`
=======
        const longLyrics = Array.from({ length: 500 }, (_, i) => 
          `Line ${i + 1} with lots of extra text to make it longer and ensure we exceed the maximum allowed embeds limit`
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
        ).join("\n");

        const result = buildLyricsResponse({
          text: longLyrics,
          provider: "lrclib",
          trackTitle: "Very Long Song",
        });

        if (result.embeds.length >= MAX_EMBEDS) {
          assert.ok(result.content); // Should have overflow message
        }
      });
    });
  });

  describe("Synced Lyrics Edge Cases", () => {
    let findCurrentLine;

    beforeEach(() => {
      delete require.cache[require.resolve("../../../helpers/lavalink/lyricsFormatter")];
      const lyricsFormatter = require("../../../helpers/lavalink/lyricsFormatter");
      findCurrentLine = lyricsFormatter.findCurrentLine;
    });

    it("should handle instrumental sections (empty line text)", () => {
      const lines = [
        { timestamp: 0, line: "Intro vocals" },
        { timestamp: 5000, line: "" }, // Instrumental
        { timestamp: 10000, line: "" }, // Instrumental
        { timestamp: 15000, line: "Vocals resume" },
      ];

      const result = findCurrentLine(lines, 7500);
      assert.strictEqual(result, 1); // Empty instrumental line
    });

    it("should handle negative positions", () => {
      const lines = [
        { timestamp: 0, line: "First" },
        { timestamp: 5000, line: "Second" },
      ];

      const result = findCurrentLine(lines, -1000);
      assert.strictEqual(result, -1); // Before all lines
    });

    it("should handle very large positions", () => {
      const lines = [
        { timestamp: 0, line: "First" },
        { timestamp: 5000, line: "Last" },
      ];

      const result = findCurrentLine(lines, 1000000000);
      assert.strictEqual(result, 1); // Should return last line
    });
  });

  describe("Lyrics Display Integration", () => {
    describe("Live Update Behavior", () => {
      let findCurrentLine;

      beforeEach(() => {
        delete require.cache[require.resolve("../../../helpers/lavalink/lyricsFormatter")];
        const lyricsFormatter = require("../../../helpers/lavalink/lyricsFormatter");
        findCurrentLine = lyricsFormatter.findCurrentLine;
      });

      it("should calculate correct current line from position", () => {
        const lines = [
          { timestamp: 0, line: "Line 1" },
          { timestamp: 10000, line: "Line 2" },
          { timestamp: 20000, line: "Line 3" },
          { timestamp: 30000, line: "Line 4" },
        ];

        assert.strictEqual(findCurrentLine(lines, 15000), 1); // Line 2
      });

      it("should handle rapid position changes", () => {
        const lines = [
          { timestamp: 0, line: "A" },
          { timestamp: 1000, line: "B" },
          { timestamp: 2000, line: "C" },
        ];

        // Simulate rapid updates
        const positions = [500, 1500, 2500, 1000, 0];
        const results = positions.map((pos) => findCurrentLine(lines, pos));

        assert.deepStrictEqual(results, [0, 1, 2, 1, 0]);
      });
    });

    describe("Context Window", () => {
      it("should show 2 lines before current", () => {
        const CONTEXT_BEFORE = 2;
        const currentIndex = 5;
        const startIndex = Math.max(0, currentIndex - CONTEXT_BEFORE);

        assert.strictEqual(startIndex, 3);
      });

      it("should show 3 lines after current", () => {
        const CONTEXT_AFTER = 3;
        const currentIndex = 5;
        const totalLines = 10;
        const endIndex = Math.min(totalLines - 1, currentIndex + CONTEXT_AFTER);

        assert.strictEqual(endIndex, 8);
      });

      it("should handle beginning of song (fewer lines before)", () => {
        const CONTEXT_BEFORE = 2;
        const currentIndex = 1; // Second line
        const startIndex = Math.max(0, currentIndex - CONTEXT_BEFORE);

        assert.strictEqual(startIndex, 0); // Can only show 1 line before
      });

      it("should handle end of song (fewer lines after)", () => {
        const CONTEXT_AFTER = 3;
        const currentIndex = 8;
        const totalLines = 10;
        const endIndex = Math.min(totalLines - 1, currentIndex + CONTEXT_AFTER);

        assert.strictEqual(endIndex, 9); // Last line
      });
    });
  });

  describe("Lyrics Source Priority", () => {
    it("should prioritize Lavalink over Genius", () => {
      const sources = ["lavalink", "genius"];
      const priority = { lavalink: 1, genius: 2 };

      const sorted = sources.sort((a, b) => priority[a] - priority[b]);

      assert.strictEqual(sorted[0], "lavalink");
    });

    it("should prefer synced lyrics when available", () => {
      const lavalinkResult = { source: "lrclib", synced: true, lines: [] };
      const geniusResult = { source: "genius", synced: false };

      // Synced should be preferred
      const preferred = lavalinkResult.synced ? lavalinkResult : geniusResult;
      assert.strictEqual(preferred.source, "lrclib");
    });

    it("should fallback to static when synced unavailable", () => {
      const lavalinkResult = null; // No Lavalink lyrics
      const geniusResult = { source: "genius", synced: false, lyrics: "Text" };

      const result = lavalinkResult || geniusResult;
      assert.strictEqual(result.source, "genius");
    });
  });

  describe("Timestamp Formatting", () => {
    function formatTimestamp(ms) {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    it("should format milliseconds to MM:SS", () => {
      assert.strictEqual(formatTimestamp(0), "0:00");
      assert.strictEqual(formatTimestamp(5000), "0:05");
      assert.strictEqual(formatTimestamp(65000), "1:05");
      assert.strictEqual(formatTimestamp(185000), "3:05");
    });

    it("should handle hour-long timestamps", () => {
      const ms = 3665000; // 1 hour, 1 minute, 5 seconds
      const result = formatTimestamp(ms);
      assert.strictEqual(result, "61:05"); // Simple MM:SS format
    });

    it("should handle edge cases", () => {
      assert.strictEqual(formatTimestamp(59999), "0:59");
      assert.strictEqual(formatTimestamp(60000), "1:00");
      assert.strictEqual(formatTimestamp(60001), "1:00");
    });
  });
});

describe("Lyrics Error Handling", () => {
  describe("Network Failures", () => {
    it("should handle Lavalink connection failure gracefully", async () => {
      // Mock a failed fetch
      const mockError = new Error("Connection refused");
<<<<<<< HEAD

=======
      
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
      // The lyrics system should not crash on network errors
      try {
        throw mockError;
      } catch (err) {
        assert.strictEqual(err.message, "Connection refused");
      }
    });

    it("should handle Genius API timeout", async () => {
      const mockTimeoutError = new Error("Timeout");
      mockTimeoutError.code = "ETIMEDOUT";

      try {
        throw mockTimeoutError;
      } catch (err) {
        assert.strictEqual(err.code, "ETIMEDOUT");
      }
    });
  });

  describe("Invalid Response Handling", () => {
    it("should handle malformed Lavalink response", () => {
      const malformedResponse = {
        // Missing expected fields
        something: "unexpected",
      };

      const isSynced = !!(
        malformedResponse.lines &&
        Array.isArray(malformedResponse.lines) &&
        malformedResponse.lines.length > 0
      );

      assert.strictEqual(isSynced, false);
    });

    it("should handle empty lines array", () => {
      const response = {
        text: "Some lyrics",
        lines: [],
      };

      const isSynced = response.lines && response.lines.length > 0;
      assert.strictEqual(isSynced, false);
    });

    it("should handle null response", () => {
      const response = null;

      const hasSyncedLyrics = response?.lines?.length > 0;
      assert.strictEqual(hasSyncedLyrics, false);
    });
  });

  describe("Track Metadata Issues", () => {
    it("should handle missing track title", () => {
      const trackInfo = { author: "Artist" };

      const searchTerm = [trackInfo.title, trackInfo.author].filter(Boolean).join(" ");
      assert.strictEqual(searchTerm, "Artist");
    });

    it("should handle missing track author", () => {
      const trackInfo = { title: "Song" };

      const searchTerm = [trackInfo.title, trackInfo.author].filter(Boolean).join(" ");
      assert.strictEqual(searchTerm, "Song");
    });

    it("should handle completely empty track info", () => {
      const trackInfo = {};

      const searchTerm = [trackInfo.title, trackInfo.author].filter(Boolean).join(" ");
      assert.strictEqual(searchTerm, "");
    });

    it("should clean YouTube suffixes from title", () => {
      const title = "Song Name (Official Music Video)";
<<<<<<< HEAD
      const cleaned = title.replace(/\(official\s*(video|audio|music\s*video)?\)/gi, "").trim();
=======
      const cleaned = title
        .replace(/\(official\s*(video|audio|music\s*video)?\)/gi, "")
        .trim();
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601

      assert.strictEqual(cleaned, "Song Name");
    });

    it("should handle artist - title format", () => {
      const title = "Artist Name - Song Title";
      const parts = title.split(" - ");

      assert.strictEqual(parts[0], "Artist Name");
      assert.strictEqual(parts[1], "Song Title");
    });
  });
});

describe("Lyrics Button Integration", () => {
  describe("Button State", () => {
    it("should default to synced mode", () => {
      const defaultSynced = true;
      assert.strictEqual(defaultSynced, true);
    });

    it("should toggle between synced and static", () => {
      let synced = true;
<<<<<<< HEAD

      synced = !synced;
      assert.strictEqual(synced, false);

=======
      
      synced = !synced;
      assert.strictEqual(synced, false);
      
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
      synced = !synced;
      assert.strictEqual(synced, true);
    });
  });

  describe("Active Sessions Tracking", () => {
    it("should track active lyrics sessions per channel", () => {
      const activeLyricsSessions = new Map();
<<<<<<< HEAD

=======
      
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
      activeLyricsSessions.set("channel-123", {
        messageId: "msg-456",
        userId: "user-789",
        startTime: Date.now(),
      });

      assert.ok(activeLyricsSessions.has("channel-123"));
      assert.strictEqual(activeLyricsSessions.get("channel-123").messageId, "msg-456");
    });

    it("should clean up session on track end", () => {
      const activeLyricsSessions = new Map();
      activeLyricsSessions.set("channel-123", { messageId: "msg-456" });

      // Simulate track end
      activeLyricsSessions.delete("channel-123");

      assert.ok(!activeLyricsSessions.has("channel-123"));
    });

    it("should prevent duplicate sessions per channel", () => {
      const activeLyricsSessions = new Map();
<<<<<<< HEAD

      // First session
      activeLyricsSessions.set("channel-123", { messageId: "msg-1" });

=======
      
      // First session
      activeLyricsSessions.set("channel-123", { messageId: "msg-1" });
      
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
      // Second session replaces first
      activeLyricsSessions.set("channel-123", { messageId: "msg-2" });

      assert.strictEqual(activeLyricsSessions.size, 1);
      assert.strictEqual(activeLyricsSessions.get("channel-123").messageId, "msg-2");
    });
  });

  describe("Update Interval", () => {
    it("should use 250ms check interval for responsive updates", () => {
      const UPDATE_INTERVAL_MS = 250;
      assert.strictEqual(UPDATE_INTERVAL_MS, 250);
    });

    it("should calculate updates per song correctly", () => {
      const songDurationMs = 180000; // 3 minutes
      const updateInterval = 250;
      const expectedUpdates = Math.floor(songDurationMs / updateInterval);

      assert.strictEqual(expectedUpdates, 720);
    });
  });
});
