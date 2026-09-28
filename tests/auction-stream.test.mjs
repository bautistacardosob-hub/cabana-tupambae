import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("live auction player imports a centered responsive 16:9 frame", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/auction-stream.css", import.meta.url), "utf8");
  assert.match(page, /import "\.\/auction-stream\.css"/);
  assert.match(css, /width: min\(1120px, 90vw\)/);
  assert.match(css, /margin: 0 auto/);
  assert.match(css, /aspect-ratio: 16 \/ 9/);
  assert.match(css, /height: 100%/);
  assert.match(css, /max-width: 700px/);
});
