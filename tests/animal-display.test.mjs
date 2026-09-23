import test from "node:test";
import assert from "node:assert/strict";
import { formatAnimalPercentile, hasAnimalValue } from "../lib/animal-display.ts";

test("percentiles read as a Top percentage, without inventing a progress bar", () => {
  assert.equal(formatAnimalPercentile("5%"), "Top 5%");
  assert.equal(formatAnimalPercentile("20"), "Top 20%");
  assert.equal(formatAnimalPercentile("top 2,5%"), "Top 2.5%");
  assert.equal(formatAnimalPercentile("Top 10%"), "Top 10%");
  assert.equal(formatAnimalPercentile(""), "");
});

test("missing data is hidden while zero remains a valid value", () => {
  for (const value of [null, undefined, "", "  ", "—", "-", "Sin dato", "Sin cargar"]) {
    assert.equal(hasAnimalValue(value), false);
  }
  assert.equal(hasAnimalValue("0"), true);
  assert.equal(hasAnimalValue(0), true);
  assert.equal(hasAnimalValue("0%"), true);
});
