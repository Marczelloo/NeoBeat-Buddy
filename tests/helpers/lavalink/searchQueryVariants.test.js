const assert = require("node:assert");
const { describe, it } = require("node:test");

const { buildSearchQueries, buildSearchQueryVariants } = require("../../../helpers/lavalink/searchQueryVariants");

describe("Search query variants", () => {
  it("adds a likely Polish spelling without replacing the original query", () => {
    const variants = buildSearchQueryVariants("kuki cieple dranie");

    assert.ok(variants.includes("kuki ciepłe dranie"));
    assert.deepStrictEqual(buildSearchQueries("kuki cieple dranie").slice(0, 1), ["kuki cieple dranie"]);
  });

  it("keeps an already accented word unchanged", () => {
    assert.deepStrictEqual(buildSearchQueryVariants("kuki ciepłe dranie"), []);
  });

  it("bounds generated variants so autocomplete remains responsive", () => {
    assert.ok(buildSearchQueryVariants("zolc szczesliwy").length <= 3);
  });
});
